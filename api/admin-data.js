import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import fs from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { deliverDepositEmail } from "../server/deposit-mailer.js";
import { deliverWithdrawalEmail } from "../server/withdrawal-mailer.js";
import { calculateWithdrawableBalance, getPaperTradingCapital } from "../src/lib/financialMath.js";

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
const RESOURCE_STATUS_TRANSITIONS = {
  deposits: {
    pending: new Set(["approved", "rejected", "cancelled", "on-hold"]),
    approved: new Set(["cancelled"]),
    "on-hold": new Set(["pending", "approved", "rejected", "cancelled"]),
    rejected: new Set([]),
    cancelled: new Set([]),
  },
  withdrawals: {
    pending: new Set(["rejected", "cancelled", "on-hold"]),
    approved: new Set([]),
    "on-hold": new Set(["pending", "rejected", "cancelled"]),
    rejected: new Set([]),
    cancelled: new Set([]),
  },
  support: {
    open: new Set(["closed", "resolved", "on-hold"]),
    "on-hold": new Set(["open", "closed", "resolved"]),
    closed: new Set([]),
    resolved: new Set([]),
  },
};
const RECENT_AUTH_SECONDS = 10 * 60;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,120}$/;
const READ_BATCH_SIZE = 500;
const ADMIN_PAGE_SIZE = 50;
const PAPER_TRADING_ASSETS = ["BTC", "ETH", "LTC", "BNB"];

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
  if (getApps().length) return getApp();
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
    let parsed = JSON.parse(serviceAccount);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object") throw new Error("Service account is not an object.");
    return initializeApp({ credential: cert(parsed) });
  } catch {
    try {
      const decoded = Buffer.from(serviceAccount, "base64").toString("utf8");
      return initializeApp({ credential: cert(JSON.parse(decoded)) });
    } catch {
    throw new Error("Firebase service account credentials are invalid.");
    }
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

async function getAllDocuments(collectionRef) {
  const documents = [];
  let lastDocument = null;
  while (true) {
    let query = collectionRef.orderBy(FieldPath.documentId()).limit(READ_BATCH_SIZE);
    if (lastDocument) query = query.startAfter(lastDocument);
    const snapshot = await query.get();
    documents.push(...snapshot.docs);
    if (snapshot.size < READ_BATCH_SIZE) return documents;
    lastDocument = snapshot.docs[snapshot.docs.length - 1];
  }
}

async function getAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function countOutstandingQueueItems(db, collectionName, statuses) {
  const collectionGroup = db.collectionGroup(collectionName);
  const [allSnapshot, closedSnapshot, emptyStatusSnapshot] = await Promise.all([
    collectionGroup.count().get(),
    collectionGroup.where("status", "not-in", statuses).count().get(),
    collectionGroup.where("status", "==", "").count().get(),
  ]);
  // Missing and empty legacy statuses default to pending/open in the UI.
  return Math.max(
    allSnapshot.data().count - closedSnapshot.data().count + emptyStatusSnapshot.data().count,
    0,
  );
}

async function aggregateAdminQueueCounts(db) {
  const [deposits, withdrawals, support, referrals] = await Promise.all([
    countOutstandingQueueItems(db, "deposits", ["pending", "approved"]),
    countOutstandingQueueItems(db, "withdrawals", ["pending", "on-hold", "approved"]),
    countOutstandingQueueItems(db, "supportTickets", ["open", "on-hold"]),
    countOutstandingQueueItems(db, "referralRewards", ["pending", "open", "on-hold", "review"]),
  ]);
  return { deposits, withdrawals, support, referrals };
}

function decodePageCursor(value) {
  if (!value) return {};
  try {
    const decoded = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error();
    return decoded;
  } catch {
    throw Object.assign(new Error("The page cursor is invalid. Refresh the list and try again."), { statusCode: 400 });
  }
}

function encodePageCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function getPagedAdmins(db, auth, cursor) {
  let pageToken = typeof cursor.adminPageToken === "string" && cursor.adminPageToken
    ? cursor.adminPageToken
    : undefined;
  let offset = Number.isInteger(cursor.adminOffset) && cursor.adminOffset >= 0 ? cursor.adminOffset : 0;
  const rows = [];
  let boundaryCursor = null;

  while (rows.length <= ADMIN_PAGE_SIZE) {
    const page = await auth.listUsers(1000, pageToken);
    const admins = page.users.filter((authUser) => authUser.customClaims?.admin === true
      || String(authUser.customClaims?.role || "").trim().toLowerCase() === "admin");
    for (let index = offset; index < admins.length; index += 1) {
      const authUser = admins[index];
      if (rows.length === ADMIN_PAGE_SIZE) {
        rows.push(authUser);
        break;
      }
      rows.push(authUser);
      if (rows.length === ADMIN_PAGE_SIZE) {
        boundaryCursor = index + 1 < admins.length
          ? { adminPageToken: pageToken || "", adminOffset: index + 1 }
          : page.pageToken
            ? { adminPageToken: page.pageToken, adminOffset: 0 }
            : null;
      }
    }
    if (rows.length > ADMIN_PAGE_SIZE || !page.pageToken) break;
    pageToken = page.pageToken;
    offset = 0;
  }

  const hasMore = rows.length > ADMIN_PAGE_SIZE;
  const pageAdmins = rows.slice(0, ADMIN_PAGE_SIZE);
  const items = await Promise.all(pageAdmins.map(async (authUser) => {
    const profileSnapshot = await db.doc(`users/${authUser.uid}`).get();
    const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
    return {
      id: authUser.uid,
      email: authUser.email || profile.email || null,
      displayName: authUser.displayName || profile.displayName || profile.fullName || profile.username || null,
      username: profile.username || null,
      emailVerified: authUser.emailVerified === true,
      disabled: authUser.disabled === true,
      role: "admin",
      lastSignInTime: authUser.metadata?.lastSignInTime || null,
      creationTime: authUser.metadata?.creationTime || null,
    };
  }));
  return {
    items,
    nextCursor: hasMore && boundaryCursor ? encodePageCursor(boundaryCursor) : null,
    hasMore,
  };
}

async function getPagedAdminResource(db, auth, resource, cursorValue) {
  const cursor = decodePageCursor(cursorValue);
  if (resource === "admins") return getPagedAdmins(db, auth, cursor);

  if (resource === "users" || resource === "packages" || resource === "audit") {
    const collectionName = resource;
    let query = db.collection(collectionName).orderBy(FieldPath.documentId());
    const lastPath = cursor[collectionName];
    if (lastPath) {
      const lastDocument = await db.doc(lastPath).get();
      if (!lastDocument.exists || lastDocument.ref.parent.id !== collectionName) {
        throw Object.assign(new Error("The page cursor is no longer valid. Refresh the list."), { statusCode: 400 });
      }
      query = query.startAfter(lastDocument);
    }
    const snapshot = await query.limit(ADMIN_PAGE_SIZE + 1).get();
    const hasMore = snapshot.size > ADMIN_PAGE_SIZE;
    const pageDocuments = snapshot.docs.slice(0, ADMIN_PAGE_SIZE);
    let items;
    if (resource === "users") {
      const profilesWithAuth = await Promise.all(pageDocuments.map(async (item) => {
        try {
          const authUser = await auth.getUser(item.id);
          const profile = item.data();
          return {
            id: item.id,
            ...serialize(profile),
            authAccount: true,
            authUid: authUser.uid,
            authDisabled: authUser.disabled === true,
            emailVerified: authUser.emailVerified === true || profile.emailVerified === true,
          };
        } catch (error) {
          if (error?.code === "auth/user-not-found") return null;
          throw error;
        }
      }));
      items = profilesWithAuth.filter(Boolean);
    } else {
      items = pageDocuments.map((item) => ({ id: item.id, ...serialize(item.data()) }));
    }
    const nextCursor = hasMore && pageDocuments.length
      ? encodePageCursor({ [collectionName]: pageDocuments[pageDocuments.length - 1].ref.path })
      : null;
    return { items, nextCursor, hasMore };
  }

  const childCollections = resource === "withdrawal-decisions"
    ? ["withdrawals"]
    : CHILD_COLLECTIONS[resource];
  if (!childCollections) throw Object.assign(new Error("Unknown admin resource."), { statusCode: 400 });

  const snapshots = await Promise.all(childCollections.map(async (collectionName) => {
    let query = db.collectionGroup(collectionName).orderBy(FieldPath.documentId());
    if (resource === "withdrawal-decisions") {
      query = db.collectionGroup(collectionName)
        .where("status", "in", ["pending", "on-hold", "approved"])
        .orderBy(FieldPath.documentId());
    }
    const lastPath = cursor[collectionName];
    if (lastPath) {
      const lastDocument = await db.doc(lastPath).get();
      if (!lastDocument.exists || lastDocument.ref.parent.id !== collectionName) {
        throw Object.assign(new Error("The page cursor is no longer valid. Refresh the list."), { statusCode: 400 });
      }
      query = query.startAfter(lastDocument);
    }
    return { collectionName, snapshot: await query.limit(ADMIN_PAGE_SIZE + 1).get() };
  }));
  const merged = snapshots.flatMap(({ collectionName, snapshot }) => snapshot.docs.map((document) => ({
    collectionName,
    document,
  }))).sort((left, right) => left.document.ref.path.localeCompare(right.document.ref.path));
  const pageDocuments = merged.slice(0, ADMIN_PAGE_SIZE);
  const hasMore = merged.length > ADMIN_PAGE_SIZE || snapshots.some(({ snapshot }) => snapshot.size > ADMIN_PAGE_SIZE);
  const nextCursor = { ...cursor };
  for (const { collectionName, document } of pageDocuments) nextCursor[collectionName] = document.ref.path;

  const userIds = [...new Set(pageDocuments.map(({ document }) => document.ref.parent.parent?.id).filter(Boolean))];
  const profiles = new Map(await Promise.all(userIds.map(async (userId) => {
    const profile = await db.doc(`users/${userId}`).get();
    return [userId, profile.exists ? profile.data() : {}];
  })));
  const items = pageDocuments.map(({ collectionName, document }) => {
    const userId = document.ref.parent.parent?.id;
    const profile = profiles.get(userId) || {};
    return {
      ...serialize(document.data()),
      id: document.id,
      userId,
      profileEmail: profile.email || null,
      profileUsername: profile.username || null,
      collection: collectionName,
    };
  });
  return {
    items,
    nextCursor: hasMore ? encodePageCursor(nextCursor) : null,
    hasMore,
  };
}

async function getAdminRecord(db, resource, userId, recordId, collectionName) {
  if (!SAFE_ID.test(userId) || !SAFE_ID.test(recordId)) {
    throw Object.assign(new Error("A valid user and record are required."), { statusCode: 400 });
  }
  const allowedCollections = CHILD_COLLECTIONS[resource];
  if (!allowedCollections?.includes(collectionName)) {
    throw Object.assign(new Error("The requested record type is invalid."), { statusCode: 400 });
  }
  const snapshot = await db.doc(`users/${userId}/${collectionName}/${recordId}`).get();
  if (!snapshot.exists) throw Object.assign(new Error("The requested record could not be found."), { statusCode: 404 });
  const profile = await db.doc(`users/${userId}`).get();
  return {
    ...serialize(snapshot.data()),
    id: snapshot.id,
    userId,
    profileEmail: profile.data()?.email || null,
    profileUsername: profile.data()?.username || null,
    collection: collectionName,
  };
}

async function authenticate(req, app) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authentication is required.");
    error.statusCode = 401;
    throw error;
  }
  const token = await getAuth(app).verifyIdToken(authorization.slice(7));
  if (token.admin !== true && String(token.role || "").trim().toLowerCase() !== "admin") {
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
  if (resource === "admin-queue-counts") return aggregateAdminQueueCounts(db);
  if (resource === "packages" || resource === "audit") {
    const documents = await getAllDocuments(db.collection(resource));
    return documents.map((item) => ({ id: item.id, ...serialize(item.data()) }));
  }
  if (resource === "users") {
    const userDocuments = await getAllDocuments(db.collection("users"));
    const authUsers = await getAuthUsers(auth);
    const authByUid = new Map(authUsers.map((item) => [item.uid, item]));
    return userDocuments.flatMap((item) => {
      const profile = item.data();
      const authUser = authByUid.get(item.id);
      if (!authUser) return [];
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
  if (resource === "admins") {
    const [authUsers, profileDocuments] = await Promise.all([
      getAuthUsers(auth),
      getAllDocuments(db.collection("users")),
    ]);
    const profiles = new Map(profileDocuments.map((item) => [item.id, item.data()]));
    return authUsers
      .filter((authUser) => authUser.customClaims?.admin === true
        || String(authUser.customClaims?.role || "").trim().toLowerCase() === "admin")
      .map((authUser) => {
        const profile = profiles.get(authUser.uid) || {};
        return {
          id: authUser.uid,
          email: authUser.email || profile.email || null,
          displayName: authUser.displayName || profile.displayName || profile.fullName || profile.username || null,
          username: profile.username || null,
          emailVerified: authUser.emailVerified === true,
          disabled: authUser.disabled === true,
          role: "admin",
          lastSignInTime: authUser.metadata?.lastSignInTime || null,
          creationTime: authUser.metadata?.creationTime || null,
        };
      });
  }
  const collections = CHILD_COLLECTIONS[resource];
  if (!collections) throw Object.assign(new Error("Unknown admin resource."), { statusCode: 400 });
  const authByUid = new Map((await getAuthUsers(auth)).map((item) => [item.uid, item]));
  const users = (await getAllDocuments(db.collection("users"))).filter((user) => authByUid.has(user.id));
  const rows = [];
  const userBatches = [];
  for (let index = 0; index < users.length; index += 10) {
    userBatches.push(users.slice(index, index + 10));
  }

  for (const userBatch of userBatches) {
    const batchRows = await Promise.all(
      userBatch.map(async (user) => {
        const recordsByCollection = await Promise.all(
          collections.map(async (childCollection) => ({
            childCollection,
            records: { docs: await getAllDocuments(user.ref.collection(childCollection)) },
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
    createdAt: FieldValue.serverTimestamp(),
  });
}

function getWithdrawableBalance(profile) {
  const totalEarnings = (Number(profile.totalEarnings) || 0) + (Number(profile.paperTradingProfit) || 0);
  return calculateWithdrawableBalance({
    totalDeposit: profile.totalDeposit,
    totalEarnings,
    totalWithdrawal: profile.totalWithdrawal,
    commission: profile.commission,
    paperTradingWithdrawals: profile.paperTradingWithdrawals,
    paperTradingCapital: getPaperTradingCapital(profile),
  });
}

function roundToEight(value) {
  return Number(Number(value).toFixed(8));
}

async function performAction(db, token, action, payload = {}) {
  const sensitive = new Set(["create", "update-package", "set-paper-trading", "review", "disable-user", "set-role", "delete-user", "ledger", "settle-deposit"]);
  if (sensitive.has(action)) requireRecentAuth(token);

  if (action === "create") {
    if (!payload.name || typeof payload.name !== "string") throw Object.assign(new Error("Package name is required."), { statusCode: 400 });
    const reason = requireReason(payload);
    const minimum = Number(payload.minimum);
    const maximum = Number(payload.maximum);
    const returnRate = Number(payload.returnRate);
    if (!Number.isFinite(minimum) || minimum < 0 || !Number.isFinite(maximum) || maximum < minimum || !Number.isFinite(returnRate) || returnRate < 0) {
      throw Object.assign(new Error("Package amounts and return rate must be valid non-negative values, with maximum at least minimum."), { statusCode: 400 });
    }
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
    data.createdAt = FieldValue.serverTimestamp();
    const ref = await db.collection("packages").add(data);
    await audit(db, token, action, { resource: "packages", id: ref.id, reason });
    return { id: ref.id };
  }
  if (action === "update-package") {
    const reason = requireReason(payload);
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
    const minimum = Number(payload.minimum);
    const maximum = Number(payload.maximum);
    const returnRate = Number(payload.returnRate);
    if (!Number.isFinite(minimum) || minimum < 0 || !Number.isFinite(maximum) || maximum < minimum || !Number.isFinite(returnRate) || returnRate < 0) {
      throw Object.assign(new Error("Package amounts and return rate must be valid non-negative values, with maximum at least minimum."), { statusCode: 400 });
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
      updatedAt: FieldValue.serverTimestamp(),
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

    const profileRef = db.collection("users").doc(profileId);
    if (!(await profileRef.get()).exists) {
      throw Object.assign(new Error("The selected member profile no longer exists."), { statusCode: 404, code: "user-not-found" });
    }
    await getTargetAuthUser(getAuth(getFirebaseAdmin()), profileId);
    if (!totalCapital) {
      throw Object.assign(new Error("Paper-trading capital must be greater than zero."), { statusCode: 400 });
    }
    const ref = profileRef;
    const previous = (await ref.get()).data()?.paperTrading || null;
    const paperTrading = {
      enabled: true,
      mode: Object.keys(allocations).length === 1 ? "single" : "multiple",
      allocations,
      totalCapital,
      packageName: String(payload.packageName || "").trim() || null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: token.uid,
    };
    await ref.set({ paperTrading }, { merge: true });
    await audit(db, token, action, { profileId, packageName: paperTrading.packageName, previous, paperTrading: { ...paperTrading, updatedAt: undefined }, reason });
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
  await getTargetAuthUser(getAuth(getFirebaseAdmin()), String(payload.userId));
  const collectionName = resource === "support" ? "supportTickets" : resource;
  const ref = db.doc(`users/${payload.userId}/${collectionName}/${payload.id}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw Object.assign(new Error("The requested record was not found."), { statusCode: 404 });
  const status = String(payload.nextStatus || payload.status || "").toLowerCase();
  if (!STATUSES.has(status)) throw Object.assign(new Error("A safe review status is required."), { statusCode: 400 });
  if (resource === "withdrawals" && status === "approved") {
    throw Object.assign(new Error("Use the withdrawal approval action to complete settlement and notify the member."), { statusCode: 409 });
  }
  const previousStatus = String(snapshot.data().status || "pending").toLowerCase();
  const transitions = RESOURCE_STATUS_TRANSITIONS[resource] || STATUS_TRANSITIONS;
  if (previousStatus !== status && !transitions[previousStatus]?.has(status)) {
    throw Object.assign(new Error(`Illegal status transition from ${previousStatus} to ${status}.`), { statusCode: 409 });
  }
  const reason = resource === "withdrawals" ? "" : requireReason(payload);
  await ref.update({
    status,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: token.uid,
  });
  await audit(db, token, "review", {
    resource,
    userId: payload.userId,
    id: payload.id,
    previousStatus,
    newStatus: status,
    ...(reason ? { reason } : {}),
  });
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
  const isDeletion = ["delete-user", "delete-deposit", "delete-withdrawal"].includes(action);
  const reason = isDeletion || action === "approve-withdrawal" ? "" : requireReason(payload);
  if (action === "retry-deposit-email") {
    const profileId = String(payload.profileId || payload.userId || "");
    const depositId = String(payload.depositId || payload.id || "");
    if (!SAFE_ID.test(profileId) || !SAFE_ID.test(depositId)) {
      throw Object.assign(new Error("A valid deposit and user profile are required."), { statusCode: 400 });
    }
    const email = await deliverDepositEmail({
      db,
      profileId,
      depositId,
      kind: "successful",
      retryOnly: true,
    });
    await audit(db, token, "retry-deposit-email", { profileId, depositId, reason });
    return { email, profileId, depositId };
  }
  if (action === "delete-withdrawal") {
    const profileId = String(payload.profileId || payload.userId || "");
    const withdrawalId = String(payload.withdrawalId || payload.id || "");
    if (!SAFE_ID.test(profileId) || !SAFE_ID.test(withdrawalId)) {
      throw Object.assign(new Error("A valid withdrawal and user profile are required."), { statusCode: 400 });
    }
    if (String(payload.confirmation || "") !== "DELETE WITHDRAWAL") {
      throw Object.assign(new Error("Type DELETE WITHDRAWAL to confirm request deletion."), { statusCode: 400 });
    }

    const profileRef = db.collection("users").doc(profileId);
    const withdrawalRef = profileRef.collection("withdrawals").doc(withdrawalId);
    const transactionRef = profileRef.collection("transactions").doc(`manual-withdrawal-${withdrawalId}`);
    const deleted = await db.runTransaction(async (transaction) => {
      const [profileSnapshot, withdrawalSnapshot, transactionSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(withdrawalRef),
        transaction.get(transactionRef),
      ]);
      if (!profileSnapshot.exists || !withdrawalSnapshot.exists) {
        throw Object.assign(new Error("The selected withdrawal request was not found."), { statusCode: 404 });
      }

      const withdrawal = withdrawalSnapshot.data();
      const status = String(withdrawal.status || "pending").toLowerCase();
      if (
        withdrawal.settlementId
        || withdrawal.settledAt
        || withdrawal.completedAt
        || withdrawal.paidAt
        || transactionSnapshot.exists
        || ["complete", "completed", "settled", "paid", "success"].includes(status)
      ) {
        throw Object.assign(new Error("Paid or settled withdrawal requests cannot be deleted."), {
          statusCode: 409,
          code: "withdrawal-delete-locked",
        });
      }

      transaction.delete(withdrawalRef);
      return { previousStatus: status };
    });
    await audit(db, token, "delete-withdrawal", {
      profileId,
      withdrawalId,
      previousStatus: deleted.previousStatus,
    });
    return { deleted: true, profileId, withdrawalId };
  }
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
      if (packagePaperTrading) {
        transaction.update(profileRef, {
          paperTrading: {
            enabled: true,
            mode: packagePaperTrading.mode,
            allocations: packagePaperTrading.allocations,
            totalCapital: packagePaperTrading.totalCapital,
            packageName,
            assignedAt: FieldValue.serverTimestamp(),
            assignedBy: token.uid,
          },
        });
      }
      transaction.update(profileRef, {
        availableBalance: previousAvailable + amount,
        totalDeposit: previousTotalDeposit + amount,
        updatedAt: FieldValue.serverTimestamp(),
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
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(depositRef, {
        status: "completed",
        settlementId,
        receivedAmount: amount,
        creditedAmount: amount,
        currency,
        settledBy: token.uid,
        settlementReason: reason,
        settledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { settlementId, amount, currency, profileId, depositId };
    });
    await audit(db, token, "settle-deposit", { ...settlement, offlineConfirmed: true, reason });
    let email;
    try {
      email = await deliverDepositEmail({
        db,
        profileId,
        depositId,
        kind: "successful",
      });
    } catch (error) {
      console.error("Deposit was credited but its success email could not be sent", {
        profileId,
        depositId,
        error,
      });
      email = { status: "failed", error: "The deposit was credited, but its confirmation email could not be sent." };
    }
    return { settled: true, ...settlement, email };
  }
  if (action === "approve-withdrawal") {
    const profileId = String(payload.profileId || payload.userId || "");
    const withdrawalId = String(payload.withdrawalId || payload.id || "");
    if (!SAFE_ID.test(profileId) || !SAFE_ID.test(withdrawalId)) {
      throw Object.assign(new Error("A valid withdrawal and user profile are required."), { statusCode: 400 });
    }
    if (payload.payoutSent !== true) {
      throw Object.assign(new Error("Confirm that the payout has already been sent to the saved wallet address."), { statusCode: 400 });
    }
    const profileRef = db.collection("users").doc(profileId);
    const withdrawalRef = profileRef.collection("withdrawals").doc(withdrawalId);
    const transactionRef = profileRef.collection("transactions").doc(`manual-withdrawal-${withdrawalId}`);
    const settlement = await db.runTransaction(async (transaction) => {
      const [profileSnapshot, withdrawalSnapshot, transactionSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(withdrawalRef),
        transaction.get(transactionRef),
      ]);
      if (!profileSnapshot.exists || !withdrawalSnapshot.exists) {
        throw Object.assign(new Error("The selected withdrawal request was not found."), { statusCode: 404 });
      }
      const withdrawal = withdrawalSnapshot.data();
      const status = String(withdrawal.status || "pending").toLowerCase();
      if (status === "completed" && (transactionSnapshot.exists || withdrawal.settlementId)) {
        return {
          settlementId: withdrawal.settlementId || transactionSnapshot.data()?.settlementId,
          amount: Number(withdrawal.amount),
          profileId,
          withdrawalId,
          alreadyCompleted: true,
        };
      }
      if (transactionSnapshot.exists || withdrawal.settlementId || ["completed", "settled", "paid"].includes(status)) {
        throw Object.assign(new Error("This withdrawal has already been completed."), { statusCode: 409, code: "withdrawal-already-settled" });
      }
      if (!["pending", "on-hold", "approved"].includes(status)) {
        throw Object.assign(new Error("Only pending, on-hold, or previously approved withdrawals can be completed."), { statusCode: 409 });
      }
      const amount = Number(withdrawal.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw Object.assign(new Error("The withdrawal amount is invalid."), { statusCode: 400 });
      }
      const profile = profileSnapshot.data();
      const currentWithdrawal = Math.max(Number(profile.totalWithdrawal) || 0, 0);
      const previousCapitalWithdrawals = Math.max(Number(profile.paperTradingWithdrawals) || 0, 0);
      const baseBalance = calculateWithdrawableBalance({
        totalDeposit: profile.totalDeposit,
        totalEarnings: (Number(profile.totalEarnings) || 0) + (Number(profile.paperTradingProfit) || 0),
        totalWithdrawal: currentWithdrawal,
        commission: profile.commission,
        paperTradingWithdrawals: previousCapitalWithdrawals,
        paperTradingCapital: 0,
      });
      const withdrawableBalance = getWithdrawableBalance(profile);
      if (amount > withdrawableBalance) {
        throw Object.assign(new Error("The member no longer has enough transferable balance for this withdrawal. Promotional and referral credits are not withdrawable."), { statusCode: 409 });
      }
      const capitalWithdrawal = Math.max(amount - baseBalance, 0);
      const tradingCapital = getPaperTradingCapital(profile);
      let paperTradingUpdate;
      let nextPaperTradingProfit;
      if (capitalWithdrawal > 0) {
        const paperTrading = profile.paperTrading || {};
        const allocationEntries = PAPER_TRADING_ASSETS
          .map((asset) => [asset, Math.max(Number(paperTrading.allocations?.[asset]) || 0, 0)])
          .filter(([, allocation]) => allocation > 0);
        const allocationTotal = allocationEntries.reduce((sum, [, allocation]) => sum + allocation, 0);
        if (!paperTrading.enabled || allocationTotal <= 0 || capitalWithdrawal > tradingCapital) {
          throw Object.assign(new Error("The paper-trading capital could not be safely reduced. Ask an administrator to review the member's allocations."), { statusCode: 409 });
        }
        const remainingCapital = roundToEight(Math.max(tradingCapital - capitalWithdrawal, 0));
        const allocationScale = remainingCapital / allocationTotal;
        const allocations = { ...paperTrading.allocations };
        for (const [asset, allocation] of allocationEntries) {
          allocations[asset] = roundToEight(allocation * allocationScale);
        }
        const roundedTotal = allocationEntries.reduce((sum, [asset]) => sum + allocations[asset], 0);
        const allocationRemainder = roundToEight(remainingCapital - roundedTotal);
        if (allocationEntries.length && allocationRemainder !== 0) {
          const [lastAsset] = allocationEntries[allocationEntries.length - 1];
          allocations[lastAsset] = roundToEight(allocations[lastAsset] + allocationRemainder);
        }
        const remainingRatio = tradingCapital > 0 ? remainingCapital / tradingCapital : 0;
        nextPaperTradingProfit = roundToEight((Number(profile.paperTradingProfit) || 0) * remainingRatio);
        paperTradingUpdate = {
          ...paperTrading,
          enabled: remainingCapital > 0,
          allocations,
          totalCapital: remainingCapital,
          lastMarketValue: roundToEight((Number(paperTrading.lastMarketValue) || 0) * remainingRatio),
          paperTradingProfit: nextPaperTradingProfit,
          updatedAt: FieldValue.serverTimestamp(),
        };
      }
      const settlementId = `manual-${withdrawalId}`;
      const profileUpdate = {
        availableBalance: Math.max((Number(profile.availableBalance) || 0) - amount, 0),
        totalWithdrawal: currentWithdrawal + amount,
        paperTradingWithdrawals: previousCapitalWithdrawals + capitalWithdrawal,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (paperTradingUpdate) {
        profileUpdate.paperTrading = paperTradingUpdate;
        profileUpdate.paperTradingProfit = nextPaperTradingProfit;
      }
      transaction.update(profileRef, profileUpdate);
      transaction.create(transactionRef, {
        type: "withdrawal",
        source: "manual-withdrawal-settlement",
        amount,
        currency: "USD",
        status: "completed",
        withdrawalId,
        settlementId,
        paymentMethod: withdrawal.method || withdrawal.asset || null,
        reason,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(withdrawalRef, {
        status: "completed",
        settlementId,
        settledBy: token.uid,
        approvedBy: token.uid,
        payoutSentBeforeApproval: true,
        settlementReason: reason,
        settledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { settlementId, amount, profileId, withdrawalId };
    });
    if (!settlement.alreadyCompleted) {
      await audit(db, token, "approve-withdrawal", {
        ...settlement,
        payoutSentBeforeApproval: true,
      });
    }
    let email;
    try {
      email = await deliverWithdrawalEmail({
        db,
        profileId,
        withdrawalId,
        kind: "completed",
      });
    } catch (error) {
      console.error("Withdrawal was settled but its completion email status could not be confirmed", {
        profileId,
        withdrawalId,
        error,
      });
      email = {
        status: "failed",
        error: "The payout was recorded, but the completion email status could not be confirmed. Refresh the withdrawal record before retrying.",
      };
    }
    return { settled: true, ...settlement, email };
  }
  const targetId = String(payload.userId || "");
  const profileId = String(payload.profileId || targetId);
  if (!SAFE_ID.test(targetId)) throw Object.assign(new Error("A valid target user is required."), { statusCode: 400 });
  if (!SAFE_ID.test(profileId)) throw Object.assign(new Error("A valid profile is required."), { statusCode: 400 });
  if (targetId !== profileId) {
    throw Object.assign(new Error("The Firebase Authentication account and Firestore profile must use the same UID."), {
      statusCode: 409,
      code: "profile-auth-mismatch",
    });
  }
  if (targetId === token.uid) throw Object.assign(new Error("Administrators cannot change their own access."), { statusCode: 400 });
  const userRef = db.collection("users").doc(profileId);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) throw Object.assign(new Error("The target user was not found."), { statusCode: 404 });
  const auth = getAuth(getFirebaseAdmin());

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
      disabledAt: disabled ? FieldValue.serverTimestamp() : null,
      disabledBy: disabled ? token.uid : null,
      updatedAt: FieldValue.serverTimestamp(),
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
    await userRef.set({ role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await audit(db, token, action, { userId: targetId, previousRole: existing.role || "member", newRole: role, reason });
    return { updated: true, role };
  }
  if (action === "ledger") {
    await getTargetAuthUser(auth, targetId);
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
        reason, adminId: token.uid, createdAt: FieldValue.serverTimestamp(),
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
    const db = getFirestore(app);
    if (req.method === "GET") {
      const resource = String(req.query?.resource || "users");
      if (String(req.query?.record || "") === "1") {
        const collectionName = String(req.query?.collection || (resource === "support" ? "supportTickets" : resource));
        const item = await getAdminRecord(db, resource, String(req.query?.userId || ""), String(req.query?.id || ""), collectionName);
        return sendJson(res, 200, { item });
      }
      if (String(req.query?.page || "") === "1") {
        const page = await getPagedAdminResource(db, getAuth(app), resource, req.query?.cursor);
        return sendJson(res, 200, page);
      }
      return sendJson(res, 200, { items: await aggregate(db, getAuth(app), resource) });
    }
    let body;
    try { body = parseBody(req.body); } catch { return sendJson(res, 400, { error: "Invalid request body." }); }
    const result = ["disable-user", "set-role", "delete-user", "ledger", "settle-deposit", "retry-deposit-email", "approve-withdrawal", "delete-deposit", "delete-withdrawal"].includes(body.action)
      ? await performSensitiveAction(db, token, body.action, body.payload || {})
      : await performAction(db, token, body.action, body.payload || {});
    return sendJson(res, 200, result);
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") return sendJson(res, 503, { error: error.message, code: "firebase-not-configured" });
    if (error?.code === "user-not-found") return sendJson(res, 404, { error: error.message, code: "user-not-found" });
    if (error?.code === "recent-auth-required") return sendJson(res, 401, { error: error.message, code: error.code });
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) return sendJson(res, 401, { error: "Authentication token is invalid or expired.", code: "auth-invalid" });
    console.error("admin-data failed", error);
    return sendJson(res, error.statusCode || 500, { error: error.message || "The admin request failed." });
  }
}
