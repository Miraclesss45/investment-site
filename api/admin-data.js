import admin from "firebase-admin";
import fs from "node:fs";

const CHILD_COLLECTIONS = {
  deposits: ["deposits"],
  withdrawals: ["withdrawals"],
  support: ["supportTickets"],
  transactions: ["transactions", "investments"],
  referrals: ["referralRewards"],
};
const REVIEWABLE = new Set(["deposits", "withdrawals", "support"]);
const STATUSES = new Set(["pending", "approved", "rejected", "cancelled", "on-hold", "open", "closed", "resolved"]);
const STATUS_TRANSITIONS = {
  pending: new Set(["approved", "rejected", "cancelled", "on-hold"]),
  "on-hold": new Set(["pending", "approved", "rejected", "cancelled"]),
  open: new Set(["closed", "resolved", "on-hold"]),
  approved: new Set(["cancelled"]),
  rejected: new Set([]),
  cancelled: new Set([]),
  closed: new Set([]),
  resolved: new Set([]),
};
const RECENT_AUTH_SECONDS = 10 * 60;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,120}$/;

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function parseBody(body) {
  if (body === undefined || body === null || body === "") return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

function getFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  let serviceAccount = raw;
  if (!serviceAccount && filePath) {
    try {
      serviceAccount = fs.readFileSync(filePath, "utf8");
    } catch (error) {
      throw new Error(`Firebase service account file could not be read: ${error.message}`);
    }
  }
  if (!serviceAccount) throw new Error("Firebase service account is not configured.");
  try {
    return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccount)) });
  } catch {
    throw new Error("Firebase service account credentials are invalid.");
  }
}

function serialize(value) {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

async function authenticate(req, app) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }
  const token = await app.auth().verifyIdToken(authorization.slice(7));
  if (token.admin !== true) {
    const error = new Error("Administrator privileges are required.");
    error.statusCode = 403;
    throw error;
  }
  return token;
}

function requireRecentAuth(token) {
  const authTime = Number(token.auth_time);
  if (!Number.isFinite(authTime) || Math.floor(Date.now() / 1000) - authTime > RECENT_AUTH_SECONDS) {
    throw Object.assign(new Error("Recent administrator authentication is required. Sign in again before continuing."), {
      statusCode: 401,
      code: "recent-auth-required",
    });
  }
}

function requireReason(payload) {
  const reason = String(payload?.reason || "").trim();
  if (reason.length < 10 || reason.length > 500) {
    throw Object.assign(new Error("Provide a reason between 10 and 500 characters."), { statusCode: 400 });
  }
  return reason;
}

async function aggregate(db, auth, resource) {
  if (resource === "packages" || resource === "audit") {
    const snapshot = await db.collection(resource).orderBy("createdAt", "desc").limit(100).get().catch(() => db.collection(resource).limit(100).get());
    return snapshot.docs.map((item) => ({ id: item.id, ...serialize(item.data()) }));
  }
  if (resource === "users") {
    const snapshot = await db.collection("users").limit(100).get();
    const authUsers = [];
    let pageToken;
    do {
      const page = await auth.listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken);
    const authByUid = new Map(authUsers.map((item) => [item.uid, item]));
    const authByEmail = new Map(authUsers.filter((item) => item.email).map((item) => [item.email.toLowerCase(), item]));
    return snapshot.docs.map((item) => {
      const profile = item.data();
      const authUser = authByUid.get(item.id) || (profile.email && authByEmail.get(String(profile.email).toLowerCase()));
      return {
        id: item.id,
        ...serialize(profile),
        authAccount: Boolean(authUser),
        authUid: authUser?.uid || null,
        authDisabled: authUser?.disabled === true,
        emailVerified: authUser?.emailVerified === true || profile.emailVerified === true,
      };
    });
  }
  const collections = CHILD_COLLECTIONS[resource];
  if (!collections) throw Object.assign(new Error("Unknown admin resource."), { statusCode: 400 });
  const users = await db.collection("users").limit(100).get();
  const rows = [];
  const userBatches = [];
  for (let index = 0; index < users.docs.length; index += 10) {
    userBatches.push(users.docs.slice(index, index + 10));
  }

  for (const userBatch of userBatches) {
    const batchRows = await Promise.all(
      userBatch.map(async (user) => {
        const recordsByCollection = await Promise.all(
          collections.map(async (childCollection) => ({
            childCollection,
            records: await user.ref.collection(childCollection).limit(100).get(),
          })),
        );

        return recordsByCollection.flatMap(({ childCollection, records }) =>
          records.docs.map((item) => ({
            id: item.id,
            userId: user.id,
            profileEmail: user.data().email || null,
            profileUsername: user.data().username || null,
            collection: childCollection,
            ...serialize(item.data()),
          })),
        );
      }),
    );
    rows.push(...batchRows.flat());
  }
  return rows;
}

async function audit(db, token, action, details) {
  await db.collection("audit").add({
    action,
    adminId: token.uid,
    adminEmail: token.email || null,
    details: JSON.parse(JSON.stringify(details)),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function getActiveDeposit(db, profileId) {
  const profileSnapshot = await db.collection("users").doc(profileId).get();
  if (!profileSnapshot.exists) return 0;
  const profile = profileSnapshot.data();
  const transactions = await db.collection("users").doc(profileId).collection("transactions").limit(100).get();
  let deposits = 0;
  let withdrawals = 0;
  for (const item of transactions.docs) {
    const data = item.data();
    if (!["completed", "complete", "approved", "settled", "success"].includes(String(data.status || "completed").toLowerCase())) continue;
    const amount = Math.max(Number(data.amount) || 0, 0);
    const type = String(data.type || "").toLowerCase();
    if (type.includes("deposit") || type.includes("credit") || type.includes("investment")) deposits += amount;
    if (type.includes("withdraw") || type.includes("debit") || type.includes("payout")) withdrawals += amount;
  }
  return Math.max(
    (deposits || Number(profile.totalDeposit) || 0)
      - (withdrawals || Number(profile.totalWithdrawal) || 0)
      + (Number(profile.paperTradingProfit) || 0),
    0,
  );
}

async function performAction(db, token, action, payload = {}) {
  const sensitive = new Set(["create", "update-package", "set-paper-trading", "review", "disable-user", "set-role", "delete-user", "ledger", "settle-deposit"]);
  if (sensitive.has(action)) requireRecentAuth(token);

  if (action === "create") {
    if (!payload.name || typeof payload.name !== "string") throw Object.assign(new Error("Package name is required."), { statusCode: 400 });
    const reason = requireReason(payload);
    const allowed = ["name", "description", "minimum", "maximum", "returnRate", "duration"];
    const data = Object.fromEntries(allowed.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    const currencies = ["BTC", "ETH", "LTC", "BNB"];
    const allocations = Object.fromEntries(
      currencies
        .map((currency) => [currency, Number(payload.paperTrading?.allocations?.[currency]) || 0])
        .filter(([, amount]) => amount > 0),
    );
    if (!Object.keys(allocations).length) {
      throw Object.assign(new Error("Assign at least one paper-trading currency and amount to this package."), { statusCode: 400 });
    }
    data.paperTrading = {
      allocations,
      totalCapital: Object.values(allocations).reduce((sum, amount) => sum + amount, 0),
      mode: Object.keys(allocations).length === 1 ? "single" : "multiple",
    };
    data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection("packages").add(data);
    await audit(db, token, action, { resource: "packages", id: ref.id, reason });
    return { id: ref.id };
  }
  if (action === "update-package") {
    const packageId = String(payload.id || "");
    if (!SAFE_ID.test(packageId)) throw Object.assign(new Error("A valid package is required."), { statusCode: 400 });
    const currencies = ["BTC", "ETH", "LTC", "BNB"];
    const allocations = Object.fromEntries(
      currencies
        .map((currency) => [currency, Number(payload.paperTrading?.allocations?.[currency]) || 0])
        .filter(([, amount]) => amount > 0),
    );
    if (!payload.name || !Object.keys(allocations).length) {
      throw Object.assign(new Error("Package name and at least one paper-trading allocation are required."), { statusCode: 400 });
    }
    const ref = db.collection("packages").doc(packageId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("The selected package was not found."), { statusCode: 404 });
    const updated = {
      name: String(payload.name).trim(),
      description: String(payload.description || "").trim(),
      minimum: Number(payload.minimum) || 0,
      maximum: Number(payload.maximum) || 0,
      returnRate: Number(payload.returnRate) || 0,
      duration: String(payload.duration || "").trim(),
      paperTrading: {
        allocations,
        totalCapital: Object.values(allocations).reduce((sum, amount) => sum + amount, 0),
        mode: Object.keys(allocations).length === 1 ? "single" : "multiple",
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.update(updated);
    await audit(db, token, action, { resource: "packages", id: packageId, reason });
    return { updated: true, id: packageId };
  }
  if (action === "set-paper-trading") {
    const profileId = String(payload.profileId || "");
    if (!SAFE_ID.test(profileId)) throw Object.assign(new Error("A valid member profile is required."), { statusCode: 400 });
    const currencies = ["BTC", "ETH", "LTC", "BNB"];
    const allocations = Object.fromEntries(
      currencies
        .map((currency) => [currency, Number(payload.allocations?.[currency]) || 0])
        .filter(([, amount]) => amount > 0),
    );
    const totalCapital = Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
    const activeDeposit = await getActiveDeposit(db, profileId);
    const reason = requireReason(payload);
    if (!totalCapital || totalCapital > activeDeposit) {
      throw Object.assign(new Error(`Paper-trading capital must be greater than zero and cannot exceed the member's active deposit of ${activeDeposit.toFixed(2)}.`), { statusCode: 400 });
    }
    const ref = db.collection("users").doc(profileId);
    const previous = (await ref.get()).data()?.paperTrading || null;
    const paperTrading = {
      enabled: true,
      mode: Object.keys(allocations).length === 1 ? "single" : "multiple",
      allocations,
      totalCapital,
      packageName: String(payload.packageName || "").trim() || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: token.uid,
    };
    await ref.set({ paperTrading }, { merge: true });
    await audit(db, token, action, { profileId, packageName: paperTrading.packageName, previous, paperTrading: { ...paperTrading, updatedAt: undefined }, activeDeposit, reason });
    return {
      updated: true,
      paperTrading: {
        ...paperTrading,
        updatedAt: null,
      },
    };
  }
  if (action !== "review") throw Object.assign(new Error("Unsupported admin action."), { statusCode: 400 });
  const resource = payload.resource || (payload.collection === "supportTickets" ? "support" : payload.collection);
  if (!REVIEWABLE.has(resource) || !SAFE_ID.test(String(payload.userId || "")) || !SAFE_ID.test(String(payload.id || ""))) {
    throw Object.assign(new Error("A reviewable resource, userId and record id are required."), { statusCode: 400 });
  }
  const collectionName = resource === "support" ? "supportTickets" : resource;
  const ref = db.doc(`users/${payload.userId}/${collectionName}/${payload.id}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The requested record was not found."), { statusCode: 404 });
  const status = String(payload.nextStatus || payload.status || "").toLowerCase();
  if (!STATUSES.has(status)) throw Object.assign(new Error("A safe review status is required."), { statusCode: 400 });
  const previousStatus = String(snapshot.data().status || "pending").toLowerCase();
  if (previousStatus !== status && !STATUS_TRANSITIONS[previousStatus]?.has(status)) {
    throw Object.assign(new Error(`Illegal status transition from ${previousStatus} to ${status}.`), { statusCode: 409 });
  }
  const reason = requireReason(payload);
  await ref.update({
    status,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: token.uid,
  });
  await audit(db, token, "review", { resource, userId: payload.userId, id: payload.id, previousStatus, newStatus: status, reason });
  return { updated: true };
}

async function deleteDocumentTree(ref) {
  const collections = await ref.listCollections();
  for (const collectionRef of collections) {
    const snapshot = await collectionRef.get();
    for (const document of snapshot.docs) {
      await deleteDocumentTree(document.ref);
    }
  }
  await ref.delete();
}

async function getTargetAuthUser(auth, targetId) {
  try {
    return await auth.getUser(targetId);
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      throw Object.assign(new Error("The selected user does not have a Firebase Authentication account and cannot be managed here."), {
        statusCode: 404,
        code: "user-not-found",
      });
    }
    throw error;
  }
}

async function performSensitiveAction(db, token, action, payload) {
  requireRecentAuth(token);
  const reason = requireReason(payload);
  if (action === "delete-deposit") {
    const profileId = String(payload.profileId || payload.userId || "");
    const depositId = String(payload.depositId || payload.id || "");
    if (!SAFE_ID.test(profileId) || !SAFE_ID.test(depositId)) {
      throw Object.assign(new Error("A valid deposit and user profile are required."), { statusCode: 400 });
    }
    if (String(payload.confirmation || "") !== "DELETE DEPOSIT") {
      throw Object.assign(new Error("Type DELETE DEPOSIT to confirm request deletion."), { statusCode: 400 });
    }
    const profileRef = db.collection("users").doc(profileId);
    const depositRef = profileRef.collection("deposits").doc(depositId);
    const snapshot = await depositRef.get();
    if (!snapshot.exists) {
      throw Object.assign(new Error("The selected deposit request was not found."), { statusCode: 404 });
    }
    const deposit = snapshot.data();
    const status = String(deposit.status || "pending").toLowerCase();
    if (["approved", "completed", "settled", "credited"].includes(status) || deposit.settlementId) {
      throw Object.assign(new Error("Approved or credited deposit requests cannot be deleted."), { statusCode: 409, code: "deposit-delete-locked" });
    }
    await depositRef.delete();
    await audit(db, token, "delete-deposit", {
      profileId,
      depositId,
      profileEmail: payload.profileEmail || null,
      profileUsername: payload.profileUsername || null,
      previousStatus: status,
      reason,
    });
    return { deleted: true, profileId, depositId };
  }
  if (action === "settle-deposit") {
    const profileId = String(payload.profileId || payload.userId || "");
    const depositId = String(payload.depositId || payload.id || "");
    const currency = String(payload.currency || "").trim().toUpperCase();
    const amount = Number(payload.amount);
    if (!SAFE_ID.test(profileId) || !SAFE_ID.test(depositId)) {
      throw Object.assign(new Error("A valid deposit and user profile are required."), { statusCode: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      throw Object.assign(new Error("The credited amount must be a positive finite number."), { statusCode: 400 });
    }
    if (currency !== "USD") {
      throw Object.assign(new Error("Manual deposits must be credited in USD."), { statusCode: 400 });
    }
    const profileRef = db.collection("users").doc(profileId);
    const depositRef = profileRef.collection("deposits").doc(depositId);
    const transactionRef = profileRef.collection("transactions").doc(`manual-deposit-${depositId}`);
    const depositRequest = await depositRef.get();
    const packageName = String(depositRequest.data()?.plan || depositRequest.data()?.packageName || "").trim();
    const packageSnapshot = packageName
      ? await db.collection("packages").where("name", "==", packageName).limit(1).get()
      : { empty: true };
    const packageData = packageSnapshot.empty ? null : packageSnapshot.docs[0].data();
    const packagePaperTrading = packageData?.paperTrading || null;
    const settlement = await db.runTransaction(async (transaction) => {
      const [profileSnapshot, depositSnapshot, transactionSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(depositRef),
        transaction.get(transactionRef),
      ]);
      if (!profileSnapshot.exists || !depositSnapshot.exists) {
        throw Object.assign(new Error("The selected deposit request was not found."), { statusCode: 404 });
      }
      const deposit = depositSnapshot.data();
      const status = String(deposit.status || "pending").toLowerCase();
      if (transactionSnapshot.exists || deposit.settlementId || ["completed", "settled", "credited"].includes(status)) {
        throw Object.assign(new Error("This deposit has already been credited and cannot be settled again."), { statusCode: 409, code: "deposit-already-settled" });
      }
      if (status !== "pending" && status !== "approved") {
        throw Object.assign(new Error(`This deposit cannot be credited while it is ${status}.`), { statusCode: 409 });
      }
      const requestedCurrency = String(deposit.currency || "USD").toUpperCase();
      if (requestedCurrency !== currency) {
        throw Object.assign(new Error(`Currency mismatch: this request is configured for ${requestedCurrency}.`), { statusCode: 400 });
      }
      const settlementId = `manual-${depositId}`;
      const profile = profileSnapshot.data();
      const previousAvailable = Number(profile.availableBalance) || 0;
      const previousTotalDeposit = Number(profile.totalDeposit) || 0;
      const activeDepositAfterSettlement = Math.max(
        previousTotalDeposit + amount - (Number(profile.totalWithdrawal) || 0),
        0,
      );
      if (packagePaperTrading) {
        if (Number(packagePaperTrading.totalCapital) > activeDepositAfterSettlement) {
          throw Object.assign(new Error(`The package paper-trading allocation exceeds the member's active deposit after settlement (${activeDepositAfterSettlement.toFixed(2)}).`), { statusCode: 400 });
        }
        transaction.update(profileRef, {
          paperTrading: {
            enabled: true,
            mode: packagePaperTrading.mode,
            allocations: packagePaperTrading.allocations,
            totalCapital: packagePaperTrading.totalCapital,
            packageName,
            assignedAt: admin.firestore.FieldValue.serverTimestamp(),
            assignedBy: token.uid,
          },
        });
      }
      transaction.update(profileRef, {
        availableBalance: previousAvailable + amount,
        totalDeposit: previousTotalDeposit + amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.create(transactionRef, {
        type: "deposit",
        source: "manual-offline-settlement",
        amount,
        currency,
        status: "completed",
        depositId,
        settlementId,
        paymentMethod: deposit.method || deposit.asset || null,
        reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(depositRef, {
        status: "completed",
        settlementId,
        receivedAmount: amount,
        creditedAmount: amount,
        currency,
        settledBy: token.uid,
        settlementReason: reason,
        settledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { settlementId, amount, currency, profileId, depositId };
    });
    await audit(db, token, "settle-deposit", { ...settlement, offlineConfirmed: true, reason });
    return { settled: true, ...settlement };
  }
  const targetId = String(payload.userId || "");
  const profileId = String(payload.profileId || targetId);
  if (!SAFE_ID.test(targetId)) throw Object.assign(new Error("A valid target user is required."), { statusCode: 400 });
  if (!SAFE_ID.test(profileId)) throw Object.assign(new Error("A valid profile is required."), { statusCode: 400 });
  if (targetId === token.uid) throw Object.assign(new Error("Administrators cannot change their own access."), { statusCode: 400 });
  const userRef = db.collection("users").doc(profileId);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) throw Object.assign(new Error("The target user was not found."), { statusCode: 404 });
  const auth = getFirebaseAdmin().auth();

  if (action === "delete-user") {
    if (String(payload.confirmation || "") !== "DELETE USER") {
      throw Object.assign(new Error("Type DELETE USER to confirm permanent deletion."), { statusCode: 400 });
    }
    const targetAuth = await getTargetAuthUser(auth, targetId);
    if (targetAuth.customClaims?.admin === true || userSnapshot.data().role === "admin") {
      let administratorCount = 0;
      let pageToken;
      do {
        const page = await auth.listUsers(1000, pageToken);
        administratorCount += page.users.filter((account) => account.customClaims?.admin === true).length;
        pageToken = page.pageToken;
      } while (pageToken);
      if (administratorCount <= 1) {
        throw Object.assign(new Error("The last administrator cannot be deleted."), { statusCode: 409 });
      }
    }
    await audit(db, token, action, {
      userId: targetId,
      email: targetAuth.email || null,
      reason,
      phase: "started",
    });
    await auth.deleteUser(targetId);
    try {
      await deleteDocumentTree(userRef);
    } catch (error) {
      console.error("User authentication deleted but Firestore cleanup failed", { targetId, error });
      throw Object.assign(new Error("The Firebase account was deleted, but some profile data could not be cleaned up. Review the audit log and remove the remaining data manually."), {
        statusCode: 500,
        code: "partial-user-deletion",
      });
    }
    await audit(db, token, action, {
      userId: targetId,
      email: targetAuth.email || null,
      reason,
      phase: "completed",
      profileDeleted: true,
      authDeleted: true,
    });
    return { deleted: true, userId: targetId };
  }

  if (action === "disable-user") {
    await getTargetAuthUser(auth, targetId);
    const disabled = payload.disabled !== false;
    try {
      await auth.updateUser(targetId, { disabled });
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        throw Object.assign(new Error("The selected user does not have a Firebase Authentication account and cannot be managed here."), {
          statusCode: 404,
          code: "user-not-found",
        });
      }
      throw error;
    }
    await userRef.set({
      status: disabled ? "Disabled" : "Active",
      disabled,
      disabledAt: disabled ? admin.firestore.FieldValue.serverTimestamp() : null,
      disabledBy: disabled ? token.uid : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await audit(db, token, action, { userId: targetId, disabled, reason });
    return { updated: true, disabled };
  }

  if (action === "set-role") {
    const role = String(payload.role || "").toLowerCase();
    if (!["member", "admin"].includes(role)) throw Object.assign(new Error("Role must be member or admin."), { statusCode: 400 });
    const existing = userSnapshot.data();
    if (existing.role === "admin" && role !== "admin" && existing.lastAdminId === targetId) {
      throw Object.assign(new Error("The last administrator cannot be removed."), { statusCode: 409 });
    }

    const targetAuth = await getTargetAuthUser(auth, targetId);
    await auth.setCustomUserClaims(targetId, { ...(targetAuth.customClaims || {}), admin: role === "admin", role });
    await userRef.set({ role, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await audit(db, token, action, { userId: targetId, previousRole: existing.role || "member", newRole: role, reason });
    return { updated: true, role };
  }
  if (action === "ledger") {
    const kind = String(payload.kind || "").toLowerCase();
    if (!["credit", "debit", "reversal"].includes(kind)) throw Object.assign(new Error("Ledger action must be credit, debit, or reversal."), { statusCode: 400 });
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) throw Object.assign(new Error("Ledger amount must be a positive finite number."), { statusCode: 400 });
    const key = String(payload.idempotencyKey || "");
    if (!IDEMPOTENCY_KEY.test(key)) throw Object.assign(new Error("A valid idempotency key is required."), { statusCode: 400 });
    if (kind === "reversal" && !IDEMPOTENCY_KEY.test(String(payload.reversalOf || ""))) {
      throw Object.assign(new Error("A reversal must reference the original ledger id."), { statusCode: 400 });
    }
    const ledgerRef = db.collection("ledger").doc(key);
    const entry = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ledgerRef);
      if (existing.exists) return { id: existing.id, ...existing.data(), idempotent: true };
      const data = {
        userId: targetId, kind, amount, currency: String(payload.currency || "USD").toUpperCase(),
        reason, adminId: token.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
        reversalOf: payload.reversalOf ? String(payload.reversalOf) : null,
      };
      transaction.create(ledgerRef, data);
      return { id: key, ...data };
    });
    if (!entry.idempotent) await audit(db, token, "ledger", { ...entry, idempotencyKey: key });
    return { entry };
  }
  throw Object.assign(new Error("Unsupported admin action."), { statusCode: 400 });
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const app = getFirebaseAdmin();
    const token = await authenticate(req, app);
    const db = app.firestore();
    if (req.method === "GET") {
      const resource = String(req.query?.resource || "users");
      return sendJson(res, 200, { items: await aggregate(db, app.auth(), resource) });
    }
    let body;
    try { body = parseBody(req.body); } catch { return sendJson(res, 400, { error: "Invalid request body." }); }
    const result = ["disable-user", "set-role", "delete-user", "ledger", "settle-deposit", "delete-deposit"].includes(body.action)
      ? await performSensitiveAction(db, token, body.action, body.payload || {})
      : await performAction(db, token, body.action, body.payload || {});
    return sendJson(res, 200, result);
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") return sendJson(res, 503, { error: error.message, code: "firebase-not-configured" });
    if (error?.code === "user-not-found") return sendJson(res, 404, { error: error.message, code: "user-not-found" });
    if (error?.code === "recent-auth-required") return sendJson(res, 401, { error: error.message, code: error.code });
    if (error?.code?.startsWith("auth/")) return sendJson(res, 401, { error: "Authentication token is invalid or expired.", code: "auth-invalid" });
    console.error("admin-data failed", error);
    return sendJson(res, error.statusCode || 500, { error: error.message || "The admin request failed." });
  }
}
