import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { requireVerifiedUser } from "../server/auth.js";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";

const PAGE_SIZE = 25;
const SOURCE_NAMES = ["transactions", "ledger", "referralRewards"];

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

function parseBody(body) {
  if (body === undefined || body === null || body === "") return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

function serialize(value) {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function validCursorId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeTransaction(source, document) {
  const data = document.data();
  if (source === "ledger") {
    const kind = String(data.kind || "").toLowerCase();
    return {
      ...data,
      id: `ledger-${document.id}`,
      type: data.type || (kind === "credit" ? "Admin credit" : kind === "debit" ? "Admin debit" : "Admin adjustment"),
      category: data.category || "admin-adjustment",
      historySource: source,
      historyId: document.id,
    };
  }
  if (source === "referralRewards") {
    const status = String(data.status || "pending").toLowerCase();
    return {
      ...data,
      id: `referral-reward-${document.id}`,
      type: data.recipientRole === "referrer" ? "Referral reward" : "Referral signup reward",
      category: "promotional-credit",
      source: "referral-reward",
      rewardStatus: status,
      status: status === "promotional" ? "completed" : status,
      historySource: source,
      historyId: document.id,
    };
  }
  return { ...data, id: document.id, historySource: source, historyId: document.id };
}

async function getTransactionPage(db, uid, cursor = {}) {
  const refs = {
    transactions: { collection: db.collection("users").doc(uid).collection("transactions") },
    ledger: { collection: db.collection("ledger"), baseQuery: db.collection("ledger").where("userId", "==", uid) },
    referralRewards: { collection: db.collection("users").doc(uid).collection("referralRewards") },
  };
  const snapshots = await Promise.all(SOURCE_NAMES.map(async (source) => {
    const { collection, baseQuery } = refs[source];
    let q = (baseQuery || collection).orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
    const cursorId = cursor[source];
    if (cursorId) {
      if (!validCursorId(cursorId)) throw Object.assign(new Error("The activity cursor is invalid. Refresh your history."), { statusCode: 400 });
      const cursorSnapshot = await collection.doc(cursorId).get();
      if (!cursorSnapshot.exists) throw Object.assign(new Error("The activity cursor has expired. Refresh your history."), { statusCode: 400 });
      if (source === "ledger" && String(cursorSnapshot.data()?.userId || "") !== uid) {
        throw Object.assign(new Error("The activity cursor is invalid. Refresh your history."), { statusCode: 400 });
      }
      q = q.startAfter(cursorSnapshot);
    }
    return [source, await q.limit(PAGE_SIZE + 1).get()];
  }));
  const bySource = Object.fromEntries(snapshots);
  const merged = SOURCE_NAMES.flatMap((source) => bySource[source].docs.map((document) => normalizeTransaction(source, document)))
    .sort((left, right) => {
      const leftTime = timestampMillis(left.createdAt);
      const rightTime = timestampMillis(right.createdAt);
      return rightTime - leftTime || String(right.historyId).localeCompare(String(left.historyId));
    });
  const items = merged.slice(0, PAGE_SIZE);
  const nextCursor = { ...cursor, hasMore: false };
  const consumed = new Map();
  for (const item of items) {
    nextCursor[item.historySource] = item.historyId;
    consumed.set(item.historySource, (consumed.get(item.historySource) || 0) + 1);
  }
  nextCursor.hasMore = SOURCE_NAMES.some((source) => bySource[source].size > (consumed.get(source) || 0));
  return { items: items.map(serialize), nextCursor: nextCursor.hasMore ? nextCursor : null };
}

async function getInvestmentPage(db, uid, cursor = {}) {
  const investments = db.collection("users").doc(uid).collection("investments");
  let q = investments.orderBy("startedAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (cursor.investmentId) {
    if (!validCursorId(cursor.investmentId)) throw Object.assign(new Error("The investment cursor is invalid. Refresh your investments."), { statusCode: 400 });
    const cursorSnapshot = await investments.doc(cursor.investmentId).get();
    if (!cursorSnapshot.exists) throw Object.assign(new Error("The investment cursor has expired. Refresh your investments."), { statusCode: 400 });
    q = q.startAfter(cursorSnapshot);
  }
  const snapshot = await q.limit(PAGE_SIZE + 1).get();
  const hasMore = snapshot.size > PAGE_SIZE;
  const items = snapshot.docs.slice(0, PAGE_SIZE).map((document) => ({ id: document.id, ...serialize(document.data()) }));
  const nextCursor = hasMore && items.length ? { investmentId: items.at(-1).id, hasMore: true } : null;
  return { items, nextCursor };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  let token;
  try {
    const app = getFirebaseAdminApp();
    token = await requireVerifiedUser(req, app);
  } catch (error) {
    return sendJson(res, error.statusCode || 401, { error: error.message || "Authentication token is invalid or expired." });
  }
  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return sendJson(res, 400, { error: "Invalid request body." });
  }
  const kind = String(body.kind || "");
  const cursor = body.cursor && typeof body.cursor === "object" && !Array.isArray(body.cursor) ? body.cursor : {};
  if (!["transactions", "investments"].includes(kind)) return sendJson(res, 400, { error: "Choose a valid history type." });
  try {
    const db = getFirestore(getFirebaseAdminApp());
    const page = kind === "transactions"
      ? await getTransactionPage(db, token.uid, cursor)
      : await getInvestmentPage(db, token.uid, cursor);
    return sendJson(res, 200, page);
  } catch (error) {
    if (error?.statusCode) return sendJson(res, error.statusCode, { error: error.message });
    console.error("member-history failed", { uid: token.uid, kind, error });
    return sendJson(res, 500, { error: "The requested account history could not be loaded." });
  }
}
