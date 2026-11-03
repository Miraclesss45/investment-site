import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { AggregateField, FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { deliverDepositEmail } from "../server/deposit-mailer.js";
import { deliverWithdrawalEmail } from "../server/withdrawal-mailer.js";
import { loadFirebaseServiceAccount } from "../server/firebase-service-account.js";
import { getAdminAccountAccessState, isActiveAdminProfile as isActiveAdminProfileRecord } from "../server/admin-access.js";
import { isValidDailyReturnRate, MAX_DAILY_RETURN_RATE } from "../server/package-catalog.js";
import { parseInvestmentDurationHours } from "../server/investment-accrual.js";
import { allocateInvestmentPrincipalWithdrawal, hasStoredNonNegativeInteger, nonNegativeMoney, roundMoney } from "../src/lib/financialMath.js";
import { isSuccessfulReferral } from "../src/lib/referralRewards.js";
import { conversationMatchesSupportSearch, getSupportSearchQueryTerms } from "../src/lib/supportSearch.js";
import { processAccountDeletionJob } from "../server/account-deletion.js";
import { getFinancialTotalsForProfile, getPendingWithdrawalAmountForProfile, getWithdrawableBalanceForProfile } from "../server/financial-balance.js";

const CHILD_COLLECTIONS = {
  deposits: ["deposits"],
  withdrawals: ["withdrawals"],
  support: ["supportTickets"],
  // Admin-created ledger entries live at the root and are queried separately.
  transactions: ["transactions", "investments", "referralRewards"],
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
const ACTIVE_STATUSES = new Set(["pending", "on-hold", "approved"]);
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
const ADMIN_PAGE_SIZE = 50;
const ADMIN_SUPPORT_PAGE_SIZE = 50;
const ADMIN_SUPPORT_SCAN_LIMIT = 500;
const ADMIN_SUPPORT_BATCH_SIZE = 250;

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
  return initializeApp({ credential: cert(loadFirebaseServiceAccount()) });
}

function serialize(value) {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

async function countOutstandingQueueItems(db, collectionName, statuses) {
  const collectionGroup = db.collectionGroup(collectionName);
  const [allSnapshot, closedSnapshot] = await Promise.all([
    collectionGroup.count().get(),
    collectionGroup.where("status", "not-in", statuses).count().get(),
  ]);
  // not-in excludes documents with a missing status, so those legacy records
  // remain in the outstanding count. Explicit empty status already matches.
  return Math.max(allSnapshot.data().count - closedSnapshot.data().count, 0);
}

async function aggregateAdminQueueCounts(db) {
  const [deposits, withdrawals, support] = await Promise.all([
    countOutstandingQueueItems(db, "deposits", ["pending", "approved"]),
    countOutstandingQueueItems(db, "withdrawals", ["pending", "on-hold", "approved"]),
    countOutstandingQueueItems(db, "supportTickets", ["open", "on-hold"]),
  ]);
  // Referral credits are automatic after email verification; they are not an admin action queue.
  return { deposits, withdrawals, support, referrals: 0 };
}

async function aggregateAdminOverview(db, auth) {
  const users = db.collection("users");
  const disabledStatuses = ["disabled", "Disabled", "suspended", "Suspended", "blocked", "Blocked", "blacklisted", "Blacklisted"];
  const pendingStatuses = ["pending", "Pending", "review", "Review"];
  const [totalSnapshot, disabledFlagSnapshot, disabledStatusSnapshot, disabledOverlapSnapshot, pendingSnapshot, pendingDisabledOverlapSnapshot, recentProfiles, accessSyncSnapshot] = await Promise.all([
    users.count().get(),
    users.where("disabled", "==", true).count().get(),
    users.where("status", "in", disabledStatuses).count().get(),
    users.where("disabled", "==", true).where("status", "in", disabledStatuses).count().get(),
    users.where("status", "in", pendingStatuses).count().get(),
    users.where("disabled", "==", true).where("status", "in", pendingStatuses).count().get(),
    users.orderBy("createdAt", "desc").limit(5).get(),
    db.doc("systemJobs/accountStatusReconcile").get(),
  ]);
  const statusFor = (profile, authUser) => {
    const status = String(profile.status || "").trim().toLowerCase();
    if (profile.disabled === true || authUser?.disabled === true
      || ["disabled", "suspended", "blocked", "blacklisted"].includes(status)) return "disabled";
    if (["pending", "review"].includes(status)) return "pending";
    return authUser ? "active" : "orphaned";
  };
  const totalUsers = Math.max(Number(totalSnapshot.data().count) || 0, 0);
  const disabledUsers = Math.max(
    (Number(disabledFlagSnapshot.data().count) || 0)
      + (Number(disabledStatusSnapshot.data().count) || 0)
      - (Number(disabledOverlapSnapshot.data().count) || 0),
    0,
  );
  const pendingUsers = Math.max(
    (Number(pendingSnapshot.data().count) || 0)
      - (Number(pendingDisabledOverlapSnapshot.data().count) || 0),
    0,
  );
  const recentUsers = await Promise.all(recentProfiles.docs.map(async (document) => {
    const profile = document.data();
    let authUser = null;
    try {
      authUser = await auth.getUser(document.id);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    return {
      id: document.id,
      displayName: profile.fullName || authUser?.displayName || "",
      username: profile.username || "",
      email: profile.email || authUser?.email || "",
      status: statusFor(profile, authUser),
    };
  }));
  return [{
    totalUsers,
    disabledUsers,
    activeUsers: Math.max(totalUsers - disabledUsers - pendingUsers, 0),
    pendingUsers,
    recentUsers,
    accountStatusSyncComplete: Boolean(accessSyncSnapshot.data()?.lastCompletedAt),
    accountStatusSyncedAt: serialize(accessSyncSnapshot.data()?.lastCompletedAt || null),
  }];
}

async function getReferralAttributionPage(db, cursor) {
  let query = db.collection("users")
    .where("referredBy", "!=", "")
    .orderBy("referredBy", "asc");
  const lastPath = cursor.referrals;
  if (lastPath) {
    const lastDocument = await db.doc(lastPath).get();
    if (!lastDocument.exists || lastDocument.ref.parent.id !== "users") {
      throw Object.assign(new Error("The page cursor is no longer valid. Refresh the list."), { statusCode: 400 });
    }
    query = query.startAfter(lastDocument);
  }
  const snapshot = await query.limit(ADMIN_PAGE_SIZE + 1).get();
  const hasMore = snapshot.size > ADMIN_PAGE_SIZE;
  const pageDocuments = snapshot.docs.slice(0, ADMIN_PAGE_SIZE);
  const usernames = [...new Set(pageDocuments.map((document) => (
    String(document.data().referredBy || "").trim().toLowerCase()
  )).filter((username) => /^[a-z0-9._-]{3,30}$/.test(username)))];
  const usernameSnapshots = usernames.length
    ? await db.getAll(...usernames.map((username) => db.doc(`usernames/${username}`)))
    : [];
  const referrerIdsByUsername = new Map(usernameSnapshots.map((document) => [
    document.id,
    String(document.data()?.uid || ""),
  ]));
  const referrerIds = [...new Set([...referrerIdsByUsername.values()].filter((id) => SAFE_ID.test(id)))];
  const profileIds = [...new Set([...referrerIds, ...pageDocuments.map((document) => document.id)])];
  const profileSnapshots = profileIds.length
    ? await db.getAll(...profileIds.map((id) => db.doc(`users/${id}`)))
    : [];
  const profiles = new Map(profileSnapshots.map((document) => [
    document.id,
    document.exists ? document.data() : {},
  ]));
  const rewardRefs = pageDocuments.flatMap((document) => {
    const username = String(document.data().referredBy || "").trim().toLowerCase();
    const referrerId = referrerIdsByUsername.get(username) || "";
    return SAFE_ID.test(referrerId) && SAFE_ID.test(document.id)
      ? [{ key: `${referrerId}:${document.id}`, ref: db.doc(`users/${referrerId}/referralRewards/${document.id}`) }]
      : [];
  });
  const rewardSnapshots = rewardRefs.length ? await db.getAll(...rewardRefs.map(({ ref }) => ref)) : [];
  const rewardsByKey = new Map(rewardRefs.map(({ key }, index) => [
    key,
    rewardSnapshots[index]?.exists ? rewardSnapshots[index].data() : null,
  ]));
  const items = pageDocuments.flatMap((document) => {
    const referredProfile = document.data();
    const referredBy = String(referredProfile.referredBy || "").trim().toLowerCase();
    const referrerId = referrerIdsByUsername.get(referredBy) || "";
    if (!SAFE_ID.test(referrerId) || referrerId === document.id) return [];
    const referrer = profiles.get(referrerId) || {};
    const referredUserId = document.id;
    const reward = rewardsByKey.get(`${referrerId}:${referredUserId}`);
    return [{
      id: `${referrerId}-${referredUserId}`,
      userId: referrerId,
      referrerId,
      profileUsername: referrer.username || referredBy,
      profileEmail: referrer.email || null,
      referredUserId,
      referredUsername: referredProfile.username || null,
      referredEmail: referredProfile.email || null,
      createdAt: serialize(referredProfile.createdAt || null),
      amount: reward?.amount != null && Number.isFinite(Number(reward.amount)) ? Number(reward.amount) : null,
      referralCredit: String(reward?.status || "promotional").toLowerCase() === "promotional" ? Number(reward?.amount) || 0 : 0,
      rewardStatus: String(reward?.status || "pending").toLowerCase(),
      rewardCreatedAt: serialize(reward?.creditedAt || reward?.createdAt || null),
      referralSuccessful: reward && isSuccessfulReferral(reward.status),
      status: "attributed",
      collection: "referralAttributions",
    }];
  });
  const nextCursor = hasMore && pageDocuments.length
    ? encodePageCursor({ referrals: pageDocuments[pageDocuments.length - 1].ref.path })
    : null;
  return { items, nextCursor, hasMore };
}

async function getTopReferrers(db) {
  const snapshot = await db.collection("users")
    .where("referralCount", ">", 0)
    .orderBy("referralCount", "desc")
    .limit(10)
    .get();
  return Promise.all(snapshot.docs.map(async (document) => {
    const { referralCredit } = await getReferralRewardTotals(document.ref.collection("referralRewards"));
    return {
      ...serialize(document.data()),
      id: document.id,
      userId: document.id,
      referralCount: Math.max(Number(document.data().referralCount) || 0, 0),
      referralCredit,
    };
  }));
}

function supportConversationMatches(data, { search, filter, archived }) {
  if (Boolean(data.archived === true) !== archived) return false;
  const status = String(data.status || "open").toLowerCase();
  if (!archived && filter === "unread" && Number(data.unreadForAgent || 0) <= 0) return false;
  if (!archived && filter !== "all" && filter !== "unread" && status !== filter) return false;
  if (!search) return true;
  const queryTerms = getSupportSearchQueryTerms(search);
  if (queryTerms.length) return conversationMatchesSupportSearch(data, queryTerms);
  return [data.userName, data.userEmail, data.userId, data.lastMessage]
    .filter(Boolean).join(" ").toLowerCase().includes(search);
}

async function getAdminSupportHistoryPage(db, cursorValue, options = {}) {
  const cursor = decodePageCursor(cursorValue);
  const search = String(options.search || "").trim().slice(0, 160).toLowerCase();
  const searchTerms = getSupportSearchQueryTerms(search);
  const rawFilter = String(options.filter || "all").toLowerCase();
  const allowedFilters = new Set(["all", "unread", "open", "in_progress", "waiting", "resolved", "closed"]);
  if (!allowedFilters.has(rawFilter)) {
    throw Object.assign(new Error("Choose a valid support inbox filter."), { statusCode: 400 });
  }
  const archived = String(options.archived || "") === "1";
  let baseConversationsQuery = db.collection("supportConversations")
    .orderBy("updatedAt", "desc");
  if (searchTerms.length) {
    baseConversationsQuery = db.collection("supportConversations")
      .where("searchTokens", "array-contains", searchTerms[0])
      .orderBy("updatedAt", "desc");
  }
  let conversationsQuery = baseConversationsQuery;
  const lastPath = cursor.supportConversations;
  if (lastPath) {
    const lastDocument = await db.doc(lastPath).get();
    if (!lastDocument.exists || lastDocument.ref.parent.id !== "supportConversations") {
      throw Object.assign(new Error("The support inbox cursor is no longer valid. Refresh the inbox."), { statusCode: 400 });
    }
    conversationsQuery = conversationsQuery.startAfter(lastDocument);
  }

  const items = [];
  let lastScanned = null;
  let scanned = 0;
  let sourceExhausted = false;
  while (items.length < ADMIN_SUPPORT_PAGE_SIZE && scanned < ADMIN_SUPPORT_SCAN_LIMIT) {
    const batchSize = Math.min(ADMIN_SUPPORT_BATCH_SIZE, ADMIN_SUPPORT_SCAN_LIMIT - scanned);
    const snapshot = await conversationsQuery.limit(batchSize).get();
    if (snapshot.empty) {
      sourceExhausted = true;
      break;
    }
    for (const document of snapshot.docs) {
      lastScanned = document;
      scanned += 1;
      const data = document.data();
      if (supportConversationMatches(data, { search, filter: rawFilter, archived })) {
        const conversationData = { ...data };
        delete conversationData.searchTokens;
        items.push({ ...serialize(conversationData), id: document.id, serverSearchMatch: searchTerms.length > 0 });
        if (items.length === ADMIN_SUPPORT_PAGE_SIZE) break;
      }
    }
    if (items.length === ADMIN_SUPPORT_PAGE_SIZE) break;
    if (snapshot.size < batchSize) {
      sourceExhausted = true;
      break;
    }
    conversationsQuery = conversationsQuery.startAfter(snapshot.docs[snapshot.docs.length - 1]);
  }

  let hasMore = !sourceExhausted && Boolean(lastScanned);
  if (hasMore && lastScanned) {
    const nextDocument = await baseConversationsQuery
      .startAfter(lastScanned)
      .limit(1)
      .get();
    hasMore = !nextDocument.empty;
  }
  const [indexSnapshot, truncatedIndexSnapshot] = searchTerms.length
    ? await Promise.all([
      db.doc("systemJobs/supportSearchIndex").get(),
      db.collection("supportConversations").where("searchIndexTruncated", "==", true).count().get(),
    ])
    : [null, null];
  return {
    items,
    nextCursor: hasMore ? encodePageCursor({ supportConversations: lastScanned.ref.path }) : null,
    hasMore,
    scanned,
    searchIndexComplete: !searchTerms.length || Boolean(indexSnapshot?.data()?.completedAt),
    searchIndexTruncatedCount: Math.max(Number(truncatedIndexSnapshot?.data()?.count) || 0, 0),
  };
}

async function aggregateAdminSupportChatCounts(db) {
  const conversations = db.collection("supportConversations");
  const archived = conversations.where("archived", "==", true);
  const [allSnapshot, inactiveSnapshot, archivedTotalSnapshot, archivedInactiveSnapshot, unreadSnapshot, archivedUnreadSnapshot] = await Promise.all([
    conversations.count().get(),
    conversations.where("status", "not-in", ["open", "in_progress", "waiting"]).count().get(),
    archived.count().get(),
    archived.where("status", "not-in", ["open", "in_progress", "waiting"]).count().get(),
    conversations.where("unreadForAgent", ">", 0).aggregate({ unread: AggregateField.sum("unreadForAgent") }).get(),
    archived.where("unreadForAgent", ">", 0).aggregate({ unread: AggregateField.sum("unreadForAgent") }).get(),
  ]);
  let activeCount = Math.max(allSnapshot.data().count - inactiveSnapshot.data().count, 0);
  const archivedActiveCount = Math.max(
    archivedTotalSnapshot.data().count - archivedInactiveSnapshot.data().count,
    0,
  );
  activeCount = Math.max(activeCount - archivedActiveCount, 0);
  const unreadMessageCount = Math.max(
    (Number(unreadSnapshot.data().unread) || 0) - (Number(archivedUnreadSnapshot.data().unread) || 0),
    0,
  );
  return [{ activeCount, unreadMessageCount }];
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

async function getPagedAdminResource(db, auth, resource, cursorValue, options = {}) {
  if (resource === "admin-support-history") {
    return getAdminSupportHistoryPage(db, cursorValue, options);
  }
  const cursor = decodePageCursor(cursorValue);
  if (resource === "admins") return getPagedAdmins(db, auth, cursor);

  if (resource === "referrals") return getReferralAttributionPage(db, cursor);
  if (resource === "top-referrals") {
    return { items: await getTopReferrers(db), nextCursor: null, hasMore: false };
  }

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
          const referralTotals = await getReferralRewardTotals(item.ref.collection("referralRewards"));
          const financialFields = await getAdminFinancialFields(db, item.id, profile, referralTotals);
          return {
            id: item.id,
            ...serialize(profile),
            ...financialFields,
            authAccount: true,
            authUid: authUser.uid,
            authDisabled: authUser.disabled === true,
            emailVerified: authUser.emailVerified === true || profile.emailVerified === true,
            creationTime: authUser.metadata?.creationTime || null,
            lastSignInTime: authUser.metadata?.lastSignInTime || null,
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
    : resource === "transactions"
      ? [...CHILD_COLLECTIONS.transactions, "ledger"]
      : CHILD_COLLECTIONS[resource];
  if (!childCollections) throw Object.assign(new Error("Unknown admin resource."), { statusCode: 400 });

  const snapshots = await Promise.all(childCollections.map(async (collectionName) => {
    let query = (collectionName === "ledger"
      ? db.collection("ledger")
      : db.collectionGroup(collectionName))
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
    if (resource === "withdrawal-decisions") {
      query = db.collectionGroup(collectionName)
        .where("status", "in", ["pending", "on-hold", "approved"])
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId(), "desc");
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
  }))).sort((left, right) => {
    const leftCreatedAt = left.document.get("createdAt");
    const rightCreatedAt = right.document.get("createdAt");
    const leftTime = typeof leftCreatedAt?.toMillis === "function"
      ? leftCreatedAt.toMillis()
      : new Date(leftCreatedAt || 0).getTime();
    const rightTime = typeof rightCreatedAt?.toMillis === "function"
      ? rightCreatedAt.toMillis()
      : new Date(rightCreatedAt || 0).getTime();
    return rightTime - leftTime || right.document.ref.path.localeCompare(left.document.ref.path);
  });
  const pageDocuments = merged.slice(0, ADMIN_PAGE_SIZE);
  const hasMore = merged.length > ADMIN_PAGE_SIZE || snapshots.some(({ snapshot }) => snapshot.size > ADMIN_PAGE_SIZE);
  const nextCursor = { ...cursor };
  for (const { collectionName, document } of pageDocuments) nextCursor[collectionName] = document.ref.path;

  const userIds = [...new Set(pageDocuments.flatMap(({ document }) => {
    const data = document.data();
    return [
      document.ref.parent.parent?.id || data.userId,
      data.referrerId,
      data.referredUserId,
    ];
  }).filter((userId) => typeof userId === "string" && SAFE_ID.test(userId)))];
  const profiles = new Map(await Promise.all(userIds.map(async (userId) => {
    const profile = await db.doc(`users/${userId}`).get();
    return [userId, profile.exists ? profile.data() : {}];
  })));
  const items = pageDocuments.map(({ collectionName, document }) => {
    const data = serialize(document.data());
    const userId = document.ref.parent.parent?.id || data.userId || null;
    const profile = profiles.get(userId) || {};
    const referrerId = data.referrerId || userId;
    const referrerProfile = profiles.get(referrerId) || profile;
    const referredProfile = profiles.get(data.referredUserId) || {};
    return {
      ...data,
      id: document.id,
      userId,
      referrerId,
      profileEmail: referrerProfile.email || null,
      profileUsername: referrerProfile.username || null,
      referredUsername: data.referredUsername || referredProfile.username || null,
      referredEmail: data.referredEmail || referredProfile.email || null,
      ...(resource === "transactions" && collectionName === "referralRewards"
        ? {
          type: data.recipientRole === "referrer" ? "Referral reward" : "Referral signup reward",
          category: "referral",
          source: "referral-reward",
        }
        : {}),
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
  if (resource === "referrals" && collectionName === "referralAttributions") {
    const [referrerSnapshot, referredSnapshot, rewardSnapshot] = await Promise.all([
      db.doc(`users/${userId}`).get(),
      db.doc(`users/${recordId}`).get(),
      db.doc(`users/${userId}/referralRewards/${recordId}`).get(),
    ]);
    if (!referrerSnapshot.exists || !referredSnapshot.exists) {
      throw Object.assign(new Error("The requested referral attribution could not be found."), { statusCode: 404 });
    }
    const referrer = referrerSnapshot.data();
    const referred = referredSnapshot.data();
    const referredBy = String(referred.referredBy || "").trim().toLowerCase();
    if (!referrer.username || referredBy !== String(referrer.username).trim().toLowerCase()) {
      throw Object.assign(new Error("The requested referral attribution could not be found."), { statusCode: 404 });
    }
    return {
      id: recordId,
      userId,
      referrerId: userId,
      profileUsername: referrer.username || null,
      profileEmail: referrer.email || null,
      referredUserId: recordId,
      referredUsername: referred.username || null,
      referredEmail: referred.email || null,
      referredBy,
      createdAt: serialize(referred.createdAt || null),
      amount: rewardSnapshot.exists ? Number(rewardSnapshot.data().amount) || 0 : null,
      referralCredit: String(rewardSnapshot.data()?.status || "promotional").toLowerCase() === "promotional" ? Number(rewardSnapshot.data()?.amount) || 0 : 0,
      rewardStatus: String(rewardSnapshot.data()?.status || "pending").toLowerCase(),
      rewardCreatedAt: serialize(rewardSnapshot.data()?.creditedAt || rewardSnapshot.data()?.createdAt || null),
      status: "attributed",
      collection: "referralAttributions",
    };
  }
  const allowedCollections = CHILD_COLLECTIONS[resource] || [];
  const allowedRootLedger = resource === "transactions" && collectionName === "ledger";
  if (!allowedCollections.includes(collectionName) && !allowedRootLedger) {
    throw Object.assign(new Error("The requested record type is invalid."), { statusCode: 400 });
  }
  const snapshot = collectionName === "ledger"
    ? await db.collection("ledger").doc(recordId).get()
    : await db.doc(`users/${userId}/${collectionName}/${recordId}`).get();
  if (!snapshot.exists) throw Object.assign(new Error("The requested record could not be found."), { statusCode: 404 });
  if (collectionName === "ledger" && snapshot.data()?.userId !== userId) {
    throw Object.assign(new Error("The requested record could not be found."), { statusCode: 404 });
  }
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
  const token = await getAuth(app).verifyIdToken(authorization.slice(7), true);
  if (token.admin !== true && String(token.role || "").trim().toLowerCase() !== "admin") {
    const error = new Error("Administrator privileges are required.");
    error.statusCode = 403;
    throw error;
  }
  const profileSnapshot = await getFirestore(app).collection("users").doc(token.uid).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
  const accessState = getAdminAccountAccessState(profile);
  if (accessState === "active" && !isActiveAdminProfileRecord(profile)) {
    throw Object.assign(new Error("Administrator access is no longer active for this account."), {
      statusCode: 403,
      code: "admin-role-not-active",
    });
  }
  if (accessState !== "active" || !isActiveAdminProfileRecord(profile)) {
    const messages = {
      "missing-profile": "The administrator profile is missing. Contact the project owner to restore it safely.",
      "deletion-pending": "This account has a pending deletion and cannot access the admin panel.",
      disabled: "Administrator access is disabled for this account. Contact the project owner to restore it.",
    };
    throw Object.assign(new Error(messages[accessState] || "Administrator access is not active."), {
      statusCode: 403,
      code: `admin-${accessState}`,
    });
  }
  return token;
}

function isActiveProfileAdmin(profile) {
  return isActiveAdminProfileRecord(profile);
}

async function updateProfileAdminRole(db, userRef, role, targetIsAdmin) {
  const lockRef = db.doc("systemSecurity/adminRoleLock");
  return db.runTransaction(async (transaction) => {
    const [lockSnapshot, adminsSnapshot, targetSnapshot] = await Promise.all([
      transaction.get(lockRef),
      transaction.get(db.collection("users").where("role", "==", "admin")),
      transaction.get(userRef),
    ]);
    if (!targetSnapshot.exists) throw Object.assign(new Error("The target user was not found."), { statusCode: 404 });
    if (targetSnapshot.data().disabled === true || targetSnapshot.data().deletionStatus) {
      throw Object.assign(new Error("Disabled or deleting accounts cannot be promoted or assigned a role."), { statusCode: 409 });
    }
    const activeAdmins = adminsSnapshot.docs.filter((document) => isActiveProfileAdmin(document.data()));
    if (targetIsAdmin && role !== "admin" && activeAdmins.length <= 1) {
      throw Object.assign(new Error("At least one active administrator must remain."), { statusCode: 409, code: "last-admin" });
    }
    transaction.set(lockRef, {
      revision: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      ...(lockSnapshot.exists ? {} : { initializedAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    transaction.set(userRef, { role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return targetSnapshot.data();
  });
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

function optionalReason(payload) {
  return String(payload?.reason || "").trim().slice(0, 500);
}

async function aggregate(db, auth, resource) {
  if (resource === "admin-queue-counts") return aggregateAdminQueueCounts(db);
  if (resource === "admin-support-chat-counts") return aggregateAdminSupportChatCounts(db);
  if (resource === "investment-accrual-status") {
    const [snapshot, failuresSnapshot, recentFailuresSnapshot] = await Promise.all([
      db.doc("systemJobs/investmentAccrual").get(),
      db.collection("investmentAccrualFailures").where("status", "==", "open").count().get(),
      db.collection("investmentAccrualFailures").where("status", "==", "open").orderBy("lastFailedAt", "desc").limit(5).get(),
    ]);
    if (!snapshot.exists) return [{ configured: true, hasRun: false, resumable: false, openFailureCount: failuresSnapshot.data().count, recentFailures: recentFailuresSnapshot.docs.map((item) => ({ id: item.id, ...serialize(item.data()) })) }];
    const job = snapshot.data();
    return [{
      configured: true,
      hasRun: Boolean(job.lastCompletedAt || job.lastPartialAt || job.lastErrorAt),
      resumable: Boolean(job.cursorPath),
      leaseActive: Number(job.leaseUntil) > Date.now(),
      lastCompletedCount: Math.max(Number(job.lastCompletedCount) || 0, 0),
      lastPartialCount: Math.max(Number(job.lastPartialCount) || 0, 0),
      lastCompletedAt: serialize(job.lastCompletedAt || null),
      lastPartialAt: serialize(job.lastPartialAt || null),
      lastErrorAt: serialize(job.lastErrorAt || null),
      openFailureCount: Math.max(Number(failuresSnapshot.data().count) || 0, 0),
      recentFailures: recentFailuresSnapshot.docs.map((item) => ({ id: item.id, ...serialize(item.data()) })),
    }];
  }
  if (resource === "admin-overview") return aggregateAdminOverview(db, auth);
  if (resource === "top-referrals") return getTopReferrers(db);
  if (resource === "packages") {
    const snapshot = await db.collection("packages").limit(500).get();
    return snapshot.docs.map((item) => ({ id: item.id, ...serialize(item.data()) }));
  }
  throw Object.assign(new Error("This admin resource must be loaded through its paginated endpoint."), { statusCode: 400 });
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

async function getReferralRewardTotals(rewardCollection) {
  const successfulReferralStatuses = ["promotional", "approved", "paid", "completed", "complete", "settled", "recorded"];
  const [promotionalSnapshot, referralCreditSnapshot, successfulReferralCountSnapshot] = await Promise.all([
    rewardCollection.where("status", "==", "promotional")
      .aggregate({ amount: AggregateField.sum("amount"), recordCount: AggregateField.count() })
      .get(),
    rewardCollection.where("status", "==", "promotional")
      .where("recipientRole", "==", "referrer")
      .aggregate({ amount: AggregateField.sum("amount") })
      .get(),
    rewardCollection.where("recipientRole", "==", "referrer")
      .where("status", "in", successfulReferralStatuses)
      .aggregate({ recordCount: AggregateField.count() })
      .get(),
  ]);
  const promotionalTotals = promotionalSnapshot.data();
  return {
    allReferralPromotionalCredit: nonNegativeMoney(promotionalTotals.amount),
    referralRewardCount: Math.max(Number(promotionalTotals.recordCount) || 0, 0),
    referralCredit: nonNegativeMoney(referralCreditSnapshot.data().amount),
    successfulReferralCount: Math.max(Number(successfulReferralCountSnapshot.data().recordCount) || 0, 0),
  };
}

async function getAdminFinancialFields(db, userId, profile, referralTotals = {}) {
  const referralCredit = nonNegativeMoney(referralTotals.referralCredit);
  const allReferralPromotionalCredit = nonNegativeMoney(referralTotals.allReferralPromotionalCredit);
  const [ledgerTotals, pendingWithdrawalAmount] = await Promise.all([
    getWithdrawableBalanceForProfile(db, userId, profile),
    getPendingWithdrawalAmountForProfile(db, userId, profile),
  ]);
  const withdrawableBalance = roundMoney(Math.max(ledgerTotals.balance - pendingWithdrawalAmount, 0));
  const promotionalCredit = allReferralPromotionalCredit;
  return {
    totalDeposit: ledgerTotals.totalDeposit,
    totalEarnings: ledgerTotals.totalEarnings,
    totalWithdrawal: ledgerTotals.totalWithdrawal,
    withdrawableBalance,
    promotionalCredit,
    referralCredit,
    referralCount: hasStoredNonNegativeInteger(profile.referralCount)
      ? Number(profile.referralCount)
      : Math.max(Number(referralTotals.successfulReferralCount) || 0, 0),
    availableBalance: roundMoney(withdrawableBalance + promotionalCredit),
    pendingWithdrawalAmount,
    activeInvestmentPrincipal: ledgerTotals.activeInvestmentPrincipal,
  };
}

async function getInvestmentDailyRate(db, packageName) {
  const normalizedName = String(packageName || "").trim().toUpperCase();
  if (normalizedName === "PROMO MINI PLAN" || normalizedName === "PROMO MEGA PLAN") return null;
  const namedRate = String(packageName || "").match(/^\s*(\d+(?:\.\d+)?)\s*%\s*Daily\s+for\s+14\s+Days\s*$/i);
  const packagesRef = db.collection("packages");
  const [packageSnapshot, catalogSnapshot] = await Promise.all([
    packagesRef.where("name", "==", String(packageName || "").trim()).limit(1).get(),
    packagesRef.limit(1).get(),
  ]);
  if (!packageSnapshot.empty) {
    const packageData = packageSnapshot.docs[0].data();
    if (packageData.enabled === false || ["disabled", "inactive", "hidden"].includes(String(packageData.status || "active").toLowerCase())) return null;
    const rate = namedRate ? Number(namedRate[1]) : Number(packageData.returnRate ?? packageData.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }
  if (!catalogSnapshot.empty || !namedRate) return null;
  const rate = Number(namedRate[1]);
  if (![2.5, 10, 20, 35].includes(rate)) return null;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function getInvestmentDurationHours(db, packageName) {
  const normalizedName = String(packageName || "").trim().toUpperCase();
  if (normalizedName === "PROMO MINI PLAN" || normalizedName === "PROMO MEGA PLAN") return 24;

  const packageSnapshot = await db.collection("packages")
    .where("name", "==", String(packageName || "").trim())
    .limit(1)
    .get();
  const configuredDuration = packageSnapshot.empty
    ? ""
    : String(packageSnapshot.docs[0].data().duration || "").trim();
  const durationFromName = String(packageName || "").match(/(\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|days?|d|weeks?|w|months?|mos?))\s*$/i)?.[1];
  const durationHours = configuredDuration
    ? parseInvestmentDurationHours(configuredDuration)
    : parseInvestmentDurationHours(durationFromName);
  if (!durationHours) {
    throw Object.assign(new Error("This package has no valid duration. Set its duration in package settings before crediting the deposit."), {
      statusCode: 409,
      code: "package-duration-not-configured",
    });
  }
  return durationHours;
}

async function getInvestmentPackageLimits(db, packageName) {
  const normalizedName = String(packageName || "").trim().toUpperCase();
  const packagesRef = db.collection("packages");
  if (normalizedName === "PROMO MINI PLAN" || normalizedName === "PROMO MEGA PLAN") {
    const configuredPackages = await packagesRef.limit(500).get();
    const configuredPromo = configuredPackages.docs.find((document) => {
      const data = document.data();
      return String(data.name || data.title || "").trim().toUpperCase() === normalizedName;
    })?.data();
    if (configuredPromo?.enabled === false || ["disabled", "inactive", "hidden"].includes(String(configuredPromo?.status || "active").toLowerCase())) return null;
    return normalizedName === "PROMO MINI PLAN"
      ? { minimum: 1000, maximum: 4999.99 }
      : { minimum: 5000, maximum: null };
  }
  const [packageSnapshot, catalogSnapshot] = await Promise.all([
    packagesRef.where("name", "==", String(packageName || "").trim()).limit(1).get(),
    packagesRef.limit(1).get(),
  ]);
  if (!packageSnapshot.empty) {
    const packageData = packageSnapshot.docs[0].data();
    if (packageData.enabled === false || ["disabled", "inactive", "hidden"].includes(String(packageData.status || "active").toLowerCase())) return null;
    const minimum = Math.max(35, Number(packageData.minimum) || 0);
    const maximum = Number(packageData.maximum);
    return { minimum, maximum: Number.isFinite(maximum) && maximum > 0 ? maximum : null };
  }
  if (!catalogSnapshot.empty) return null;

  const isDefaultPackage = /^\s*(?:2\.5|10|20|35)\s*%\s*Daily\s+for\s+14\s+Days\s*$/i.test(String(packageName || ""));
  return isDefaultPackage ? { minimum: 35, maximum: null } : null;
}

async function assertUniquePackageName(db, packageName, excludedId = "") {
  const normalizedName = String(packageName || "").trim().toUpperCase();
  if (!normalizedName) throw Object.assign(new Error("Package name is required."), { statusCode: 400 });
  const packages = await db.collection("packages").get();
  const duplicate = packages.docs.find((document) => document.id !== excludedId
    && String(document.data().name || document.data().title || "").trim().toUpperCase() === normalizedName);
  if (duplicate) {
    throw Object.assign(new Error("A package with this name already exists. Choose a distinct name."), {
      statusCode: 409,
      code: "duplicate-package-name",
    });
  }
}

async function performAction(db, token, action, payload = {}) {
  const sensitive = new Set(["create", "update-package", "review", "disable-user", "set-role", "delete-user", "ledger", "settle-deposit"]);
  if (sensitive.has(action)) requireRecentAuth(token);

  if (action === "create") {
    if (!payload.name || typeof payload.name !== "string") throw Object.assign(new Error("Package name is required."), { statusCode: 400 });
    const packageName = String(payload.name).trim().slice(0, 120);
    await assertUniquePackageName(db, packageName);
    const reason = optionalReason(payload);
    const minimum = Number(payload.minimum);
    const maximum = Number(payload.maximum);
    const returnRate = Number(payload.returnRate);
    if (!Number.isFinite(minimum) || minimum < 0 || !Number.isFinite(maximum) || maximum < minimum || !isValidDailyReturnRate(packageName, returnRate)) {
      throw Object.assign(new Error(`Package amounts must be valid non-negative values and custom daily return rates cannot exceed ${MAX_DAILY_RETURN_RATE}%.`), { statusCode: 400 });
    }
    const allowed = ["name", "description", "minimum", "maximum", "returnRate", "duration"];
    const data = Object.fromEntries(allowed.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
    data.name = packageName;
    data.createdAt = FieldValue.serverTimestamp();
    const ref = await db.collection("packages").add(data);
    await audit(db, token, action, { resource: "packages", id: ref.id, reason });
    return { id: ref.id };
  }
  if (action === "update-package") {
    const reason = optionalReason(payload);
    const packageId = String(payload.id || "");
    if (!SAFE_ID.test(packageId)) throw Object.assign(new Error("A valid package is required."), { statusCode: 400 });
    if (!payload.name) throw Object.assign(new Error("Package name is required."), { statusCode: 400 });
    const packageName = String(payload.name).trim().slice(0, 120);
    await assertUniquePackageName(db, packageName, packageId);
    const minimum = Number(payload.minimum);
    const maximum = Number(payload.maximum);
    const returnRate = Number(payload.returnRate);
    if (!Number.isFinite(minimum) || minimum < 0 || !Number.isFinite(maximum) || maximum < minimum || !isValidDailyReturnRate(packageName, returnRate)) {
      throw Object.assign(new Error(`Package amounts must be valid non-negative values and custom daily return rates cannot exceed ${MAX_DAILY_RETURN_RATE}%.`), { statusCode: 400 });
    }
    const ref = db.collection("packages").doc(packageId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw Object.assign(new Error("The selected package was not found."), { statusCode: 404 });
    const updated = {
      name: packageName,
      description: String(payload.description || "").trim(),
      minimum: Number(payload.minimum) || 0,
      maximum: Number(payload.maximum) || 0,
      returnRate: Number(payload.returnRate) || 0,
      duration: String(payload.duration || "").trim(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.update(updated);
    await audit(db, token, action, { resource: "packages", id: packageId, reason });
    return { updated: true, id: packageId };
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
  const reason = optionalReason(payload);
  if (resource === "withdrawals") {
    const profileRef = db.collection("users").doc(String(payload.userId));
    await db.runTransaction(async (transaction) => {
      const [profileSnapshot, currentSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(ref),
      ]);
      if (!profileSnapshot.exists || !currentSnapshot.exists) {
        throw Object.assign(new Error("The withdrawal request or member profile could not be found."), { statusCode: 404 });
      }
      const currentStatus = String(currentSnapshot.data().status || "pending").toLowerCase();
      if (currentStatus !== status && !transitions[currentStatus]?.has(status)) {
        throw Object.assign(new Error(`Illegal status transition from ${currentStatus} to ${status}.`), { statusCode: 409 });
      }
      const currentAmount = Math.max(Number(currentSnapshot.data().amount) || 0, 0);
      const wasReserved = ACTIVE_STATUSES.has(currentStatus);
      const remainsReserved = ACTIVE_STATUSES.has(status);
      const currentReserved = await getPendingWithdrawalAmountForProfile(
        db,
        String(payload.userId),
        profileSnapshot.data(),
        transaction,
      );
      transaction.update(ref, {
        status,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: token.uid,
      });
      if (wasReserved && !remainsReserved) {
        transaction.update(profileRef, {
          pendingWithdrawalAmount: roundMoney(Math.max(currentReserved - currentAmount, 0)),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  } else {
    await ref.update({
      status,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: token.uid,
    });
  }
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
  const reason = isDeletion || ["approve-withdrawal", "retry-deposit-email", "retry-withdrawal-email"].includes(action)
    ? ""
    : optionalReason(payload);
  if (action === "retry-withdrawal-email") {
    const profileId = String(payload.profileId || payload.userId || "");
    const withdrawalId = String(payload.withdrawalId || payload.id || "");
    if (!SAFE_ID.test(profileId) || !SAFE_ID.test(withdrawalId)) {
      throw Object.assign(new Error("A valid withdrawal and user profile are required."), { statusCode: 400 });
    }
    const email = await deliverWithdrawalEmail({
      db,
      profileId,
      withdrawalId,
      kind: "completed",
      retryOnly: true,
    });
    await audit(db, token, "retry-withdrawal-email", { profileId, withdrawalId, status: email.status });
    return { email, profileId, withdrawalId };
  }
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

      const pendingWithdrawalAmount = ACTIVE_STATUSES.has(status)
        ? await getPendingWithdrawalAmountForProfile(db, profileId, profileSnapshot.data(), transaction)
        : 0;
      transaction.delete(withdrawalRef);
      if (ACTIVE_STATUSES.has(status)) {
        transaction.update(profileRef, {
          pendingWithdrawalAmount: roundMoney(Math.max(pendingWithdrawalAmount - nonNegativeMoney(withdrawal.amount), 0)),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
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
    const requestedAmount = Number(payload.amount);
    const amount = Math.round((requestedAmount + Number.EPSILON) * 100) / 100;
    if (!SAFE_ID.test(profileId) || !SAFE_ID.test(depositId)) {
      throw Object.assign(new Error("A valid deposit and user profile are required."), { statusCode: 400 });
    }
    if (!Number.isFinite(requestedAmount) || !Number.isFinite(amount) || amount !== requestedAmount || amount < 35 || amount > 100000000) {
      throw Object.assign(new Error("The credited deposit must be at least $35."), { statusCode: 400 });
    }
    if (currency !== "USD") {
      throw Object.assign(new Error("Manual deposits must be credited in USD."), { statusCode: 400 });
    }
    const profileRef = db.collection("users").doc(profileId);
    const depositRef = profileRef.collection("deposits").doc(depositId);
    const transactionRef = profileRef.collection("transactions").doc(`manual-deposit-${depositId}`);
    const depositRequest = await depositRef.get();
    if (!depositRequest.exists) throw Object.assign(new Error("The selected deposit request was not found."), { statusCode: 404 });
    const depositData = depositRequest.data();
    const termsSnapshot = depositData.packageTermsSnapshot;
    const snapshotValid = termsSnapshot?.version === 1
      && typeof termsSnapshot.packageId === "string"
      && termsSnapshot.packageId === String(depositData.packageId || "")
      && typeof termsSnapshot.name === "string"
      && termsSnapshot.name.trim() === String(depositData.plan || depositData.packageName || "").trim();
    const packageName = String(snapshotValid ? termsSnapshot.name : depositData.plan || depositData.packageName || "").trim();
    const packageLimits = snapshotValid
      ? {
        minimum: Math.max(35, Number(termsSnapshot.minimum) || 0),
        maximum: Number.isFinite(Number(termsSnapshot.maximum)) && Number(termsSnapshot.maximum) > 0
          ? Number(termsSnapshot.maximum)
          : null,
      }
      : await getInvestmentPackageLimits(db, packageName);
    if (!packageLimits) {
      throw Object.assign(new Error("The selected investment package is unavailable."), { statusCode: 409, code: "package-unavailable" });
    }
    if (amount < packageLimits.minimum || (packageLimits.maximum !== null && amount > packageLimits.maximum)) {
      const maximumGuidance = packageLimits.maximum !== null ? ` and no more than $${packageLimits.maximum.toFixed(2)}` : "";
      throw Object.assign(new Error(`The credited amount must be at least $${packageLimits.minimum.toFixed(2)}${maximumGuidance} for this package.`), { statusCode: 400, code: "package-amount-out-of-range" });
    }
    const normalizedPackageName = packageName.trim().toUpperCase();
    const snapshotProfitPercent = snapshotValid ? Number(termsSnapshot.profitPercent) : null;
    const profitPercent = Number.isFinite(snapshotProfitPercent) && snapshotProfitPercent > 0
      ? snapshotProfitPercent
      : normalizedPackageName === "PROMO MINI PLAN" ? 100
        : normalizedPackageName === "PROMO MEGA PLAN" ? 500 : null;
    if (normalizedPackageName === "PROMO MINI PLAN" && amount >= 5000) {
      throw Object.assign(new Error("Deposits of $5,000 or more use the Promo Mega Plan."), { statusCode: 400, code: "promo-tier-mismatch" });
    }
    const snapshotDailyRate = snapshotValid ? Number(termsSnapshot.dailyRate) : null;
    const dailyRate = profitPercent === null
      ? (Number.isFinite(snapshotDailyRate) && snapshotDailyRate > 0
        ? snapshotDailyRate
        : await getInvestmentDailyRate(db, packageName))
      : null;
    if (profitPercent === null && !dailyRate) {
      throw Object.assign(new Error("This package has no daily profit rate configured. Set a rate for this package before crediting the deposit."), { statusCode: 409, code: "package-rate-not-configured" });
    }
    const snapshotDurationHours = snapshotValid ? Number(termsSnapshot.durationHours) : null;
    const durationHours = Number.isFinite(snapshotDurationHours) && snapshotDurationHours > 0
      ? snapshotDurationHours
      : await getInvestmentDurationHours(db, packageName);
    const investmentId = `deposit-${depositId}`;
    const investmentRef = profileRef.collection("investments").doc(investmentId);
    const startAt = new Date();
    const durationDays = durationHours / 24;
    const maturityAt = new Date(startAt.getTime() + durationHours * 60 * 60 * 1000);
    const settlement = await db.runTransaction(async (transaction) => {
      const [profileSnapshot, depositSnapshot, transactionSnapshot, investmentSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(depositRef),
        transaction.get(transactionRef),
        transaction.get(investmentRef),
      ]);
      if (!profileSnapshot.exists || !depositSnapshot.exists) {
        throw Object.assign(new Error("The selected deposit request was not found."), { statusCode: 404 });
      }
      const deposit = depositSnapshot.data();
      const status = String(deposit.status || "pending").toLowerCase();
      if (transactionSnapshot.exists || investmentSnapshot.exists || deposit.settlementId || ["completed", "settled", "credited"].includes(status)) {
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
      const previousAvailable = nonNegativeMoney(profile.availableBalance);
      const priorTotals = await getFinancialTotalsForProfile(db, profileId, profile, transaction);
      const previousTotalDeposit = priorTotals.totalDeposit;
      const activeInvestmentPrincipal = priorTotals.activeInvestmentPrincipal;
      transaction.update(profileRef, {
        availableBalance: previousAvailable,
        totalDeposit: roundMoney(previousTotalDeposit + amount),
        activeInvestmentPrincipal: roundMoney(activeInvestmentPrincipal + amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(investmentRef, {
        depositId,
        packageId: String(termsSnapshot?.packageId || deposit.packageId || ""),
        ...(snapshotValid ? { packageTermsSnapshot: termsSnapshot } : {}),
        packageName,
        principal: amount,
        dailyRate,
        profitPercent,
        durationDays,
        durationHours,
        startedAt: Timestamp.fromDate(startAt),
        maturesAt: Timestamp.fromDate(maturityAt),
        accruedDays: 0,
        accruedProfit: 0,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(transactionRef, {
        type: "deposit",
        source: "manual-offline-settlement",
        amount,
        currency,
        status: "completed",
        depositId,
        packageId: String(termsSnapshot?.packageId || deposit.packageId || ""),
        settlementId,
        paymentMethod: deposit.method || deposit.asset || null,
        investmentId,
        packageName,
        reason,
        profitPercent,
        durationDays,
        durationHours,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(depositRef, {
        status: "completed",
        settlementId,
        receivedAmount: amount,
        creditedAmount: amount,
        investmentId,
        dailyRate,
        profitPercent,
        durationDays,
        durationHours,
        currency,
        settledBy: token.uid,
        settlementReason: reason,
        settledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { settlementId, investmentId, amount, currency, profileId, depositId, packageName, dailyRate, profitPercent, durationDays, durationHours };
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
      throw Object.assign(new Error("Confirm that the payout has already been completed through the offline process."), { statusCode: 400 });
    }
    const profileRef = db.collection("users").doc(profileId);
    const withdrawalRef = profileRef.collection("withdrawals").doc(withdrawalId);
    const transactionRef = profileRef.collection("transactions").doc(`manual-withdrawal-${withdrawalId}`);
    const investmentsRef = profileRef.collection("investments");
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
      const [ledgerTotals, pendingWithdrawalAmount] = await Promise.all([
        getWithdrawableBalanceForProfile(db, profileId, profile, transaction),
        getPendingWithdrawalAmountForProfile(db, profileId, profile, transaction),
      ]);
      const currentWithdrawal = ledgerTotals.totalWithdrawal;
      const withdrawableBalance = ledgerTotals.balance;
      if (amount > withdrawableBalance) {
        throw Object.assign(new Error("The member no longer has enough transferable balance for this withdrawal. Referral rewards are not withdrawable."), { statusCode: 409 });
      }
      const settlementId = `manual-${withdrawalId}`;
      const activeInvestmentsSnapshot = await transaction.get(
        investmentsRef.where("status", "==", "active"),
      );
      const principalAllocation = allocateInvestmentPrincipalWithdrawal(
        activeInvestmentsSnapshot.docs.map((document) => ({
          id: document.id,
          principal: document.data().principal,
          principalWithdrawn: document.data().principalWithdrawn,
          startedAt: document.data().startedAt,
          ref: document.ref,
        })),
        amount,
      );
      for (const allocation of principalAllocation.allocations) {
        const investment = activeInvestmentsSnapshot.docs.find((document) => document.id === allocation.id);
        transaction.update(investment.ref, {
          principalWithdrawn: allocation.principalWithdrawn,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      const profileUpdate = {
        availableBalance: roundMoney(Math.max(nonNegativeMoney(profile.availableBalance) - amount, 0)),
        totalWithdrawal: roundMoney(currentWithdrawal + amount),
        pendingWithdrawalAmount: roundMoney(Math.max(pendingWithdrawalAmount - amount, 0)),
        activeInvestmentPrincipal: roundMoney(Math.max(
          ledgerTotals.activeInvestmentPrincipal - principalAllocation.amountAllocated,
          0,
        )),
        updatedAt: FieldValue.serverTimestamp(),
      };
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
    const jobRef = db.collection("accountDeletionJobs").doc(targetId);
    const existingJob = await jobRef.get();
    if (existingJob.exists && existingJob.data().status !== "completed") {
      return { deletionQueued: true, complete: false, userId: targetId, jobId: jobRef.id };
    }
    let targetAuth = null;
    try {
      targetAuth = await auth.getUser(targetId);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    const targetIsAdmin = userSnapshot.data().role === "admin"
      || targetAuth?.customClaims?.admin === true
      || String(targetAuth?.customClaims?.role || "").trim().toLowerCase() === "admin";
    const lockRef = db.doc("systemSecurity/adminRoleLock");
    await db.runTransaction(async (transaction) => {
      const [jobSnapshot, lockSnapshot, adminsSnapshot, targetSnapshot] = await Promise.all([
        transaction.get(jobRef),
        transaction.get(lockRef),
        transaction.get(db.collection("users").where("role", "==", "admin")),
        transaction.get(userRef),
      ]);
      if (jobSnapshot.exists && jobSnapshot.data().status !== "completed") return;
      if (!targetSnapshot.exists) throw Object.assign(new Error("The target user was not found."), { statusCode: 404 });
      const activeAdmins = adminsSnapshot.docs.filter((document) => isActiveProfileAdmin(document.data()));
      if (targetIsAdmin && activeAdmins.length <= 1) {
        throw Object.assign(new Error("At least one active administrator must remain."), { statusCode: 409, code: "last-admin" });
      }
      transaction.set(lockRef, {
        revision: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        ...(lockSnapshot.exists ? {} : { initializedAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
      transaction.set(userRef, {
        role: "member",
        status: "Deleting",
        disabled: true,
        authDisabled: true,
        deletionStatus: "queued",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.create(jobRef, {
        userId: targetId,
        username: String(targetSnapshot.data().username || "").trim().toLowerCase(),
        requestedBy: token.uid,
        status: "queued",
        phase: "firestore",
        stack: [{ kind: "doc", path: userRef.path }],
        attempts: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    try {
      if (targetAuth) {
        await auth.setCustomUserClaims(targetId, { ...(targetAuth.customClaims || {}), admin: false, role: "member" });
        await auth.updateUser(targetId, { disabled: true });
        await auth.revokeRefreshTokens(targetId);
      }
    } catch (error) {
      console.error("Account deletion queued while Auth access sync is pending", { targetId, error });
    }
    await audit(db, token, action, { userId: targetId, email: targetAuth?.email || null, phase: "queued" });
    const result = await processAccountDeletionJob(db, auth, jobRef, 35);
    return result.complete
      ? { deleted: true, complete: true, userId: targetId, jobId: jobRef.id }
      : { deletionQueued: true, complete: false, userId: targetId, jobId: jobRef.id };
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
      authDisabled: disabled,
      authAccount: true,
      accessSyncedAt: FieldValue.serverTimestamp(),
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
    const targetAuth = await getTargetAuthUser(auth, targetId);
    const existing = await updateProfileAdminRole(
      db,
      userRef,
      role,
      userSnapshot.data().role === "admin"
        || targetAuth.customClaims?.admin === true
        || String(targetAuth.customClaims?.role || "").trim().toLowerCase() === "admin",
    );
    await auth.setCustomUserClaims(targetId, { ...(targetAuth.customClaims || {}), admin: role === "admin", role });
    await auth.revokeRefreshTokens(targetId);
    await audit(db, token, action, { userId: targetId, previousRole: existing.role || "member", newRole: role, reason });
    return { updated: true, role };
  }
  if (action === "ledger") {
    await getTargetAuthUser(auth, targetId);
    const kind = String(payload.kind || "").toLowerCase();
    if (!["credit", "debit"].includes(kind)) throw Object.assign(new Error("Ledger action must be a credit or debit."), { statusCode: 400 });
    const requestedAmount = Number(payload.amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > 100000000) throw Object.assign(new Error("Ledger amount must be a positive finite number."), { statusCode: 400 });
    const amount = Math.round((requestedAmount + Number.EPSILON) * 100) / 100;
    if (amount <= 0) throw Object.assign(new Error("Ledger amount must be at least one cent."), { statusCode: 400 });
    if (String(payload.currency || "USD").toUpperCase() !== "USD") {
      throw Object.assign(new Error("Member balance adjustments must use USD."), { statusCode: 400 });
    }
    const category = String(payload.category || "");
    if (!["promotional-credit", "admin-adjustment"].includes(category) || kind !== "credit") {
      throw Object.assign(new Error("This panel can only issue administrator credits."), { statusCode: 403 });
    }
    const key = String(payload.idempotencyKey || "");
    if (!IDEMPOTENCY_KEY.test(key)) throw Object.assign(new Error("A valid idempotency key is required."), { statusCode: 400 });
    const ledgerRef = db.collection("ledger").doc(key);
    const profileRef = db.collection("users").doc(targetId);
    const entry = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ledgerRef);
      if (existing.exists) return { id: existing.id, ...existing.data(), idempotent: true };
      const profileSnapshot = await transaction.get(profileRef);
      if (!profileSnapshot.exists) {
        throw Object.assign(new Error("The member profile could not be found."), { statusCode: 404 });
      }
      const profile = profileSnapshot.data();
      const signedAmount = kind === "credit" ? amount : -amount;
      let profileUpdate;
      let data;
      if (category === "promotional-credit") {
        profileUpdate = {
          promotionalCredit: roundMoney(nonNegativeMoney(profile.promotionalCredit) + amount),
          updatedAt: FieldValue.serverTimestamp(),
        };
        data = {
          userId: targetId,
          kind,
          type: "Promotional credit",
          category,
          amount,
          bonusDelta: amount,
          currency: "USD",
          status: "completed",
          reason,
          adminId: token.uid,
          createdAt: FieldValue.serverTimestamp(),
        };
      } else {
        if (kind === "debit") {
          const [pending, totals] = await Promise.all([
            getPendingWithdrawalAmountForProfile(db, targetId, profile, transaction),
            getWithdrawableBalanceForProfile(db, targetId, profile, transaction),
          ]);
          const withdrawable = Math.max(totals.balance - pending, 0);
          if (amount > withdrawable) {
            throw Object.assign(new Error(`This debit exceeds the member’s withdrawable balance of $${withdrawable.toFixed(2)} after pending withdrawals.`), { statusCode: 409, code: "insufficient-withdrawable-balance" });
          }
        }
        profileUpdate = {
          adminBalanceAdjustment: (Number(profile.adminBalanceAdjustment) || 0) + signedAmount,
          updatedAt: FieldValue.serverTimestamp(),
        };
        data = {
          userId: targetId,
          kind,
          type: kind === "credit" ? "Admin credit" : "Admin debit",
          category,
          amount,
          balanceDelta: signedAmount,
          currency: "USD",
          status: "completed",
          reason,
          adminId: token.uid,
          createdAt: FieldValue.serverTimestamp(),
        };
      }
      transaction.update(profileRef, profileUpdate);
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
        const page = await getPagedAdminResource(db, getAuth(app), resource, req.query?.cursor, req.query || {});
        return sendJson(res, 200, page);
      }
      return sendJson(res, 200, { items: await aggregate(db, getAuth(app), resource) });
    }
    let body;
    try { body = parseBody(req.body); } catch { return sendJson(res, 400, { error: "Invalid request body." }); }
    const result = ["disable-user", "set-role", "delete-user", "ledger", "settle-deposit", "retry-deposit-email", "retry-withdrawal-email", "approve-withdrawal", "delete-deposit", "delete-withdrawal"].includes(body.action)
      ? await performSensitiveAction(db, token, body.action, body.payload || {})
      : await performAction(db, token, body.action, body.payload || {});
    return sendJson(res, 200, result);
  } catch (error) {
    if (error?.message === "Firebase service account is not configured.") return sendJson(res, 503, { error: error.message, code: "firebase-not-configured" });
    if (error?.code === "user-not-found") return sendJson(res, 404, { error: error.message, code: "user-not-found" });
    if (error?.code === "recent-auth-required") return sendJson(res, 401, { error: error.message, code: error.code });
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) return sendJson(res, 401, { error: "Authentication token is invalid or expired.", code: "auth-invalid" });
    console.error("admin-data failed", error);
    const message = String(error?.message || "");
    if (Number(error?.code) === 9 || String(error?.code || "").toLowerCase() === "failed-precondition" || /failed_precondition|requires a collection_group.*index|requires an index/i.test(message)) {
      return sendJson(res, 503, {
        error: "This list needs a Firestore index that is still being prepared. Refresh in a moment.",
        code: "firestore-index-building",
      });
    }
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) {
      return sendJson(res, statusCode, {
        error: "The admin request could not be completed. Refresh and try again; contact support if it continues.",
        code: "admin-data-unavailable",
      });
    }
    return sendJson(res, statusCode, {
      error: error.message || "The admin request failed.",
      ...(typeof error?.code === "string" ? { code: error.code } : {}),
    });
  }
}
