import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, getIdToken, reauthenticateWithCredential } from "firebase/auth";
import { firebaseAuth, firestoreDb } from "./firebase";

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

export async function provisionAccount(user, values) {
  if (!user) throw new Error("Your authentication session is missing.");
  const token = await getIdToken(user);
  const result = await fetch("/api/provision-account", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(values),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "Your account could not be provisioned.");
    error.code = data.code || (result.status === 503 ? "provisioning-not-configured" : `provisioning-${result.status}`);
    throw error;
  }
  return data;
}

export async function createAccount(values) {
  const result = await fetch("/api/create-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
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
  if (resource === "users" && !payload) {
    const snapshot = await getDocs(collection(firestoreDb, "users"));
    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
      authAccount: item.id === firebaseAuth.currentUser.uid,
      authUid: item.id,
      emailVerified: item.data().emailVerified === true,
    }));
  }
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

export async function requestAdminAction(action, payload) {
  return adminRequest("POST", { action, payload });
}

export async function syncPaperTradingMarket(prices) {
  if (!firebaseAuth?.currentUser) return null;
  const token = await getIdToken(firebaseAuth.currentUser);
  const result = await fetch("/api/paper-trading-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prices }),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(data.error || "Paper-trading market sync failed.");
    error.code = data.code || `paper-trading-sync-${result.status}`;
    throw error;
  }
  return data;
}

export async function reauthenticateAdmin(password) {
  const currentUser = firebaseAuth?.currentUser;
  if (!currentUser?.email || !password) throw new Error("Enter your administrator password to continue.");
  await reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(currentUser.email, password));
  return getIdToken(currentUser, true);
}
