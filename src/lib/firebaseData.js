import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, getIdToken, reauthenticateWithCredential } from "firebase/auth";
import { firebaseAuth, firestoreDb } from "./firebase";

export async function saveSupportTicket(userId, values) {
  return addDoc(collection(firestoreDb, "users", userId, "supportTickets"), {
    ...values,
    status: "open",
    createdAt: serverTimestamp(),
  });
}

export async function updateUserProfile(userId, values) {
  return updateDoc(doc(firestoreDb, "users", userId), values);
}

export async function createMemberRequest(userId, type, values) {
  return addDoc(collection(firestoreDb, "users", userId, type), {
    ...values,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function sendDepositRequestEmail(values) {
  if (!firebaseAuth?.currentUser) {
    const error = new Error("You must be signed in to submit a deposit request.");
    error.code = "auth-required";
    throw error;
  }
  const token = await getIdToken(firebaseAuth.currentUser);
  const result = await fetch("/api/send-deposit-telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(values),
  });
  if (!result.ok) {
    const error = new Error("Telegram notification could not be sent.");
    error.code = result.status === 503 ? "telegram-not-configured" : "telegram-delivery-failed";
    throw error;
  }
  return result.json();
}

async function adminRequest(method, body) {
  if (!firebaseAuth?.currentUser) {
    const error = new Error("You must be signed in as an administrator.");
    error.code = "auth-required";
    throw error;
  }
  const token = await getIdToken(firebaseAuth.currentUser);
  const result = await fetch("/api/admin-data", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "The admin request failed.");
    error.code = data.code || `admin-http-${result.status}`;
    throw error;
  }
  return data;
}

export async function getAdminResource(resource) {
  if (!firebaseAuth?.currentUser) throw new Error("You must be signed in as an administrator.");
  const token = await getIdToken(firebaseAuth.currentUser);
  const result = await fetch(
    `/api/admin-data?resource=${encodeURIComponent(resource)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(payload.error || "The admin resource could not be loaded.");
    error.code = payload.code || `admin-http-${result.status}`;
    throw error;
  }
  return payload.items || [];
}

export async function requestAdminAction(action, payload) {
  return adminRequest("POST", { action, payload });
}

export async function reauthenticateAdmin(password) {
  const currentUser = firebaseAuth?.currentUser;
  if (!currentUser?.email || !password) throw new Error("Enter your administrator password to continue.");
  await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, password));
  await getIdToken(currentUser, true);
}
