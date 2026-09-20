import admin from "firebase-admin";

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
  if (!raw) throw new Error("Firebase service account is not configured.");
  return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
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

async function aggregate(db, resource) {
  if (resource === "packages" || resource === "audit") {
    const snapshot = await db.collection(resource).orderBy("createdAt", "desc").limit(100).get().catch(() => db.collection(resource).limit(100).get());
    return snapshot.docs.map((item) => ({ id: item.id, ...serialize(item.data()) }));
  }
  if (resource === "users") {
    const snapshot = await db.collection("users").limit(100).get();
    return snapshot.docs.map((item) => ({ id: item.id, ...serialize(item.data()) }));
  }
  const collections = CHILD_COLLECTIONS[resource];
  if (!collections) throw Object.assign(new Error("Unknown admin resource."), { statusCode: 400 });
  const users = await db.collection("users").limit(100).get();
  const rows = [];
  for (const user of users.docs) {
    for (const childCollection of collections) {
      const records = await user.ref.collection(childCollection).limit(100).get();
      records.forEach((item) => rows.push({
        id: item.id,
        userId: user.id,
        collection: childCollection,
        ...serialize(item.data()),
      }));
    }
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

async function performAction(db, token, action, payload = {}) {
  const sensitive = new Set(["create", "review", "disable-user", "set-role", "ledger"]);
  if (sensitive.has(action)) requireRecentAuth(token);

  if (action === "create") {
    if (!payload.name || typeof payload.name !== "string") throw Object.assign(new Error("Package name is required."), { statusCode: 400 });
    const reason = requireReason(payload);
    const allowed = ["name", "description", "minimum", "maximum", "returnRate", "duration"];
    const data = Object.fromEntries(allowed.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    data.createdAt = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection("packages").add(data);
    await audit(db, token, action, { resource: "packages", id: ref.id, reason });
    return { id: ref.id };
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

async function performSensitiveAction(db, token, action, payload) {
  const reason = requireReason(payload);
  const targetId = String(payload.userId || "");
  if (!SAFE_ID.test(targetId)) throw Object.assign(new Error("A valid target user is required."), { statusCode: 400 });
  if (targetId === token.uid) throw Object.assign(new Error("Administrators cannot change their own access."), { statusCode: 400 });
  const userRef = db.collection("users").doc(targetId);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) throw Object.assign(new Error("The target user was not found."), { statusCode: 404 });
  const auth = getFirebaseAdmin().auth();

  if (action === "disable-user") {
    const disabled = payload.disabled !== false;
    await auth.updateUser(targetId, { disabled });
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
    const targetAuth = await auth.getUser(targetId);
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
      return sendJson(res, 200, { items: await aggregate(db, resource) });
    }
    let body;
    try { body = parseBody(req.body); } catch { return sendJson(res, 400, { error: "Invalid request body." }); }
    const result = ["disable-user", "set-role", "ledger"].includes(body.action)
      ? await performSensitiveAction(db, token, body.action, body.payload || {})
      : await performAction(db, token, body.action, body.payload || {});
    return sendJson(res, 200, result);
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") return sendJson(res, 503, { error: error.message, code: "firebase-not-configured" });
    if (error?.code === "recent-auth-required") return sendJson(res, 401, { error: error.message, code: error.code });
    if (error?.code?.startsWith("auth/")) return sendJson(res, 401, { error: "Authentication token is invalid or expired.", code: "auth-invalid" });
    console.error("admin-data failed", error);
    return sendJson(res, error.statusCode || 500, { error: error.message || "The admin request failed." });
  }
}
