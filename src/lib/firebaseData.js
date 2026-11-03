import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, getIdToken, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { firestoreDb } from "./firebaseFirestore";

export async function createReferralReward(referralUsername, user = firebaseAuth?.currentUser) {
  if (!referralUsername || !user) return null;
  const token = await getIdToken(user, true);
  const result = await fetch("/api/create-referral-reward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ referralUsername }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "Referral reward could not be recorded.");
    error.code = result.status === 503
      ? "referral-reward-not-configured"
      : "referral-reward-failed";
    throw error;
  }
  return data;
}

export async function createAccount(values) {
  const requestId = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await fetch("/api/create-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...values, requestId }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "Your account could not be created.");
    error.code = data.code || `account-creation-${result.status}`;
    throw error;
  }
  return data;
}

export async function saveSupportTicket(userId, values) {
  return addDoc(collection(firestoreDb, "users", userId, "supportTickets"), {
    ...values,
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function sendSupportTicketEmails(ticketId) {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    const error = new Error("You must be signed in to send a support request.");
    error.code = "auth-required";
    throw error;
  }
  const token = await getIdToken(user);
  const result = await fetch("/api/send-support-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ticketId }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "The support request email could not be sent.");
    error.code = data.code || `support-email-${result.status}`;
    error.notifications = data.notifications;
    throw error;
  }
  return data;
}

const MEMBER_EDITABLE_PROFILE_FIELDS = [
  "fullName",
  "bitcoinWallet",
  "ethereumWallet",
  "litecoinWallet",
];

export async function updateUserProfile(userId, values) {
  const updates = Object.fromEntries(
    MEMBER_EDITABLE_PROFILE_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(values || {}, field))
      .map((field) => [field, String(values[field] ?? "").trim()]),
  );
  if (!userId || !firestoreDb || Object.keys(updates).length === 0) {
    throw new Error("No editable profile details were provided.");
  }
  // updateDoc replaces these existing fields in place; it does not append duplicate profile data.
  return updateDoc(doc(firestoreDb, "users", userId), updates);
}

export async function createMemberRequest(userId, type, values) {
  return addDoc(collection(firestoreDb, "users", userId, type), {
    ...values,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function createMemberDepositRequest(values, user = firebaseAuth?.currentUser) {
  if (!user) throw new Error("Sign in before requesting a deposit.");
  const token = await getIdToken(user, true);
  const result = await fetch("/api/create-deposit-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(values),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "The deposit request could not be saved.");
    error.code = data.code || `deposit-request-${result.status}`;
    throw error;
  }
  return data;
}

export async function loadOlderMemberHistory(kind, cursor, user = firebaseAuth?.currentUser) {
  if (!user) throw new Error("Sign in before loading account history.");
  const token = await getIdToken(user);
  const result = await fetch("/api/member-history", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, cursor }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "Older account history could not be loaded.");
    error.code = data.code || `member-history-${result.status}`;
    throw error;
  }
  return data;
}

export async function createWithdrawalRequest(values) {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error("Sign in before requesting a withdrawal.");
  const token = await getIdToken(user, true);
  const result = await fetch("/api/create-withdrawal-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(values),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(payload.error || "The withdrawal request could not be created.");
    error.code = payload.code || `withdrawal-request-${result.status}`;
    error.status = result.status;
    throw error;
  }
  return { id: payload.id, idempotent: payload.idempotent === true };
}

export async function processDueInvestments() {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error("Sign in before refreshing investment accrual.");
  const token = await getIdToken(user, true);
  const result = await fetch("/api/settle-matured-investments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(payload.error || "Investment accrual could not be refreshed.");
    error.code = payload.code || `investment-maturity-${result.status}`;
    throw error;
  }
  return payload;
}

export async function sendWithdrawalProcessingEmail(withdrawalId) {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    const error = new Error("You must be signed in to request a withdrawal email.");
    error.code = "auth-required";
    throw error;
  }
  const token = await getIdToken(user);
  const result = await fetch("/api/send-withdrawal-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ withdrawalId }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "The withdrawal request email could not be sent.");
    error.code = data.code || `withdrawal-email-${result.status}`;
    throw error;
  }
  return data;
}

export async function sendDepositPendingEmail(depositId) {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    const error = new Error("You must be signed in to request a deposit email.");
    error.code = "auth-required";
    throw error;
  }
  const token = await getIdToken(user);
  const result = await fetch("/api/send-deposit-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ depositId }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "The deposit confirmation email could not be sent.");
    error.code = data.code || `deposit-email-${result.status}`;
    throw error;
  }
  return data;
}

async function adminRequest(method, body) {
  if (!firebaseAuth?.currentUser) {
    const error = new Error("You must be signed in as an administrator.");
    error.code = "auth-required";
    throw error;
  }
  const token = await getIdToken(firebaseAuth.currentUser, true);
  const result = await fetch("/api/admin-data", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = result.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await result.json().catch(() => ({}))
    : null;
  if (!data) {
    const error = new Error("The admin API is not running. Use the deployed admin endpoint or start the Vercel development server.");
    error.code = "admin-api-unavailable";
    throw error;
  }
  if (!result.ok) {
    const error = new Error(
      data.code === "auth-invalid"
        ? "Your administrator session expired. Sign in again and retry this action."
        : data.code === "user-not-found"
          ? "This user does not have a Firebase Authentication account and cannot be managed here."
          : data.error || "The admin request failed.",
    );
    error.code = data.code || `admin-http-${result.status}`;
    throw error;
  }
  return data;
}

export async function getAdminResource(resource) {
  if (!firebaseAuth?.currentUser) throw new Error("You must be signed in as an administrator.");
  const token = await getIdToken(firebaseAuth.currentUser, true);
  const result = await fetch(
    `/api/admin-data?resource=${encodeURIComponent(resource)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const contentType = result.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await result.json().catch(() => ({}))
    : null;
  if (!payload) {
    throw new Error("The admin API is not running. Use the deployed admin endpoint or start the Vercel development server.");
  }
  if (!result.ok) {
    const error = new Error(
      payload.code === "auth-invalid"
        ? "Your administrator session expired. Sign in again to load admin data."
        : payload.code === "user-not-found"
          ? "This user does not have a Firebase Authentication account and cannot be managed here."
          : payload.error || "The admin resource could not be loaded.",
    );
    error.code = payload.code || `admin-http-${result.status}`;
    throw error;
  }
  return payload.items || [];
}

export async function getAdminPage(resource, cursor = "") {
  if (!firebaseAuth?.currentUser) throw new Error("You must be signed in as an administrator.");
  const token = await getIdToken(firebaseAuth.currentUser, true);
  const params = new URLSearchParams({ resource, page: "1" });
  if (cursor) params.set("cursor", cursor);
  const result = await fetch(`/api/admin-data?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (result.headers.get("content-type") || "").includes("application/json")
    ? await result.json().catch(() => ({}))
    : null;
  if (!payload) {
    throw new Error("The admin API is not running. Use the deployed admin endpoint or start the Vercel development server.");
  }
  if (!result.ok) {
    const error = new Error(payload.error || "The admin page could not be loaded.");
    error.code = payload.code || `admin-http-${result.status}`;
    throw error;
  }
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : "",
    hasMore: payload.hasMore === true,
  };
}

export async function getAdminSupportHistoryPage({
  search = "",
  filter = "all",
  archived = false,
  cursor = "",
  signal,
} = {}) {
  if (!firebaseAuth?.currentUser) throw new Error("You must be signed in as an administrator.");
  const token = await getIdToken(firebaseAuth.currentUser, true);
  const params = new URLSearchParams({
    resource: "admin-support-history",
    page: "1",
    search: String(search || "").trim().slice(0, 160),
    filter,
    archived: archived ? "1" : "0",
  });
  if (cursor) params.set("cursor", cursor);
  const result = await fetch(`/api/admin-data?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const payload = (result.headers.get("content-type") || "").includes("application/json")
    ? await result.json().catch(() => ({}))
    : null;
  if (!payload) {
    throw new Error("The admin API is not running. Use the deployed admin endpoint or start the Vercel development server.");
  }
  if (!result.ok) {
    const error = new Error(payload.error || "Support conversation history could not be searched.");
    error.code = payload.code || `admin-http-${result.status}`;
    throw error;
  }
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : "",
    hasMore: payload.hasMore === true,
    scanned: Number(payload.scanned) || 0,
    searchIndexComplete: payload.searchIndexComplete === true,
    searchIndexTruncatedCount: Number(payload.searchIndexTruncatedCount) || 0,
  };
}

export async function getAdminRecord(resource, userId, id, collectionName = resource) {
  if (!firebaseAuth?.currentUser) throw new Error("You must be signed in as an administrator.");
  const token = await getIdToken(firebaseAuth.currentUser, true);
  const params = new URLSearchParams({
    resource,
    record: "1",
    userId,
    id,
    collection: collectionName,
  });
  const result = await fetch(`/api/admin-data?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (result.headers.get("content-type") || "").includes("application/json")
    ? await result.json().catch(() => ({}))
    : null;
  if (!payload) throw new Error("The admin API is not running.");
  if (!result.ok) {
    const error = new Error(payload.error || "The requested record could not be loaded.");
    error.code = payload.code || `admin-http-${result.status}`;
    throw error;
  }
  return payload.item || null;
}

export async function requestAdminAction(action, payload) {
  return adminRequest("POST", { action, payload });
}

export async function reauthenticateAdmin(password) {
  const currentUser = firebaseAuth?.currentUser;
  if (!currentUser?.email || !password) throw new Error("Enter your administrator password to continue.");
  await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, password));
  return getIdToken(currentUser, true);
}

export async function changeAdminPassword(currentPassword, newPassword) {
  const currentUser = firebaseAuth?.currentUser;
  if (!currentUser?.email) throw new Error("You must be signed in as an administrator.");
  if (!currentPassword || !newPassword) throw new Error("Enter your current and new passwords to continue.");
  await reauthenticateWithCredential(
    currentUser,
    EmailAuthProvider.credential(currentUser.email, currentPassword),
  );
  await updatePassword(currentUser, newPassword);
  await getIdToken(currentUser, true);
}
