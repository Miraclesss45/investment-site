import assert from "node:assert/strict";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getDoc,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { markSupportMessagesAsRead } from "../src/lib/supportChatRead.js";

const app = initializeApp({
  apiKey: "demo-api-key",
  authDomain: "demo-support-chat.firebaseapp.com",
  projectId: "demo-support-chat",
  appId: "demo-app-id",
}, "support-chat-rules-smoke");
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

const customerA = (await signInAnonymously(auth)).user;
const conversationA = doc(db, "supportConversations", `customer_${customerA.uid}`);
const firstMessage = doc(collection(conversationA, "messages"));
await runTransaction(db, async (transaction) => {
  transaction.set(conversationA, {
    userId: customerA.uid,
    userName: "Guest A",
    userEmail: "guest-a@example.com",
    userCountry: "",
    userType: "guest",
    status: "open",
    assignedAgent: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "Hello support",
    lastMessageId: firstMessage.id,
    lastMessageAt: serverTimestamp(),
    unreadForUser: 0,
    unreadForAgent: 1,
    searchTokens: [],
  });
  transaction.set(firstMessage, {
    senderId: customerA.uid,
    senderType: "customer",
    text: "Hello support",
    type: "text",
    createdAt: serverTimestamp(),
    read: false,
  });
});
assert.equal((await getDoc(conversationA)).exists(), true, "owner can read their conversation");
assert.equal((await getDocs(query(
  collection(db, "supportConversations"),
  where("userId", "==", customerA.uid),
))).size, 1, "owner can list only their matching conversation");

const secondMessage = doc(collection(conversationA, "messages"));
await runTransaction(db, async (transaction) => {
  const snapshot = await transaction.get(conversationA);
  const conversation = snapshot.data();
  transaction.update(conversationA, {
    status: "open",
    lastMessage: "A second message sent immediately",
    lastMessageId: secondMessage.id,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadForAgent: conversation.unreadForAgent + 1,
  });
  transaction.set(secondMessage, {
    senderId: customerA.uid,
    senderType: "customer",
    text: "A second message sent immediately",
    type: "text",
    createdAt: serverTimestamp(),
    read: false,
  });
});
assert.equal((await getDoc(secondMessage)).exists(), true, "customer can send consecutive messages without an artificial delay");

await assert.rejects(
  setDoc(doc(db, "supportConversations", "arbitrary-conversation"), { userId: customerA.uid }),
  (error) => error.code === "permission-denied",
  "owner cannot create a conversation at an arbitrary document ID",
);

await signOut(auth);
const customerB = (await signInAnonymously(auth)).user;
await assert.rejects(
  getDoc(conversationA),
  (error) => error.code === "permission-denied",
  "another customer cannot read the conversation",
);
await assert.rejects(
  getDoc(firstMessage),
  (error) => error.code === "permission-denied",
  "another customer cannot read its messages",
);

const conversationB = doc(db, "supportConversations", `customer_${customerB.uid}`);
const messageB = doc(collection(conversationB, "messages"));
await runTransaction(db, async (transaction) => {
  transaction.set(conversationB, {
    userId: customerB.uid,
    userName: "Guest B",
    userEmail: "guest-b@example.com",
    userCountry: "",
    userType: "guest",
    status: "open",
    assignedAgent: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "Need assistance",
    lastMessageId: messageB.id,
    lastMessageAt: serverTimestamp(),
    unreadForUser: 0,
    unreadForAgent: 1,
    searchTokens: [],
  });
  transaction.set(messageB, {
    senderId: customerB.uid,
    senderType: "customer",
    text: "Need assistance",
    type: "text",
    createdAt: serverTimestamp(),
    read: false,
  });
});
assert.equal((await getDoc(conversationB)).exists(), true, "second customer can create their own conversation");

await assert.rejects(
  updateDoc(conversationB, {
    archived: true,
    archivedAt: serverTimestamp(),
    archivedBy: customerB.uid,
    updatedAt: serverTimestamp(),
  }),
  (error) => error.code === "permission-denied",
  "customer cannot archive their conversation",
);

const adminApp = initializeAdminApp({ projectId: "demo-support-chat" }, "support-chat-rules-admin");
const adminProfile = getAdminFirestore(adminApp).doc(`users/${customerB.uid}`);
await adminProfile.set({
  uid: customerB.uid,
  role: "admin",
  status: "Active",
  disabled: false,
  authDisabled: false,
});
await getAdminAuth(adminApp).setCustomUserClaims(customerB.uid, { admin: true });
const adminToken = await customerB.getIdTokenResult(true);
assert.equal(adminToken.claims.admin, true, "Auth emulator includes the administrator claim in the refreshed token");
assert.equal((await getDoc(conversationA)).exists(), true, "active administrator can read another customer's conversation");
await adminProfile.update({ role: "member" });
await assert.rejects(
  getDoc(conversationA),
  (error) => error.code === "permission-denied",
  "a stale administrator claim cannot bypass a demoted profile role",
);
await adminProfile.update({ role: "admin" });
assert.equal((await getDoc(conversationA)).exists(), true, "restoring the administrator profile role restores access");

const customerApp = initializeApp({
  apiKey: "demo-api-key",
  authDomain: "demo-support-chat.firebaseapp.com",
  projectId: "demo-support-chat",
  appId: "demo-customer-app-id",
}, "support-chat-read-race-customer");
const customerAuth = getAuth(customerApp);
connectAuthEmulator(customerAuth, "http://127.0.0.1:9099", { disableWarnings: true });
const customerC = (await signInAnonymously(customerAuth)).user;
const customerDb = getFirestore(customerApp);
connectFirestoreEmulator(customerDb, "127.0.0.1", 8080);
const conversationC = doc(customerDb, "supportConversations", `customer_${customerC.uid}`);
const adminConversationC = doc(db, "supportConversations", conversationC.id);
const initialCustomerMessage = doc(collection(conversationC, "messages"));
await runTransaction(customerDb, async (transaction) => {
  transaction.set(conversationC, {
    userId: customerC.uid,
    userName: "Guest C",
    userEmail: "guest-c@example.com",
    userCountry: "",
    userType: "guest",
    status: "open",
    assignedAgent: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "Please help",
    lastMessageId: initialCustomerMessage.id,
    lastMessageAt: serverTimestamp(),
    unreadForUser: 0,
    unreadForAgent: 1,
    searchTokens: [],
  });
  transaction.set(initialCustomerMessage, {
    senderId: customerC.uid,
    senderType: "customer",
    text: "Please help",
    type: "text",
    createdAt: serverTimestamp(),
    read: false,
  });
});

async function sendAdminReply(text) {
  const reply = doc(collection(adminConversationC, "messages"));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(adminConversationC);
    const conversation = snapshot.data();
    transaction.update(adminConversationC, {
      status: "waiting",
      assignedAgent: conversation.assignedAgent || customerB.uid,
      lastMessage: text,
      lastMessageId: reply.id,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadForUser: conversation.unreadForUser + 1,
    });
    transaction.set(reply, {
      senderId: customerB.uid,
      senderType: "agent",
      text,
      type: "text",
      createdAt: serverTimestamp(),
      read: false,
    });
  });
  return reply;
}

const firstAdminReply = await sendAdminReply("We are looking into this.");
const observedAdminReply = await getDoc(doc(
  customerDb,
  "supportConversations",
  conversationC.id,
  "messages",
  firstAdminReply.id,
));
const secondAdminReply = await sendAdminReply("Here is an update.");
await markSupportMessagesAsRead(
  customerDb,
  conversationC,
  "customer",
  [observedAdminReply],
  true,
  observedAdminReply.id,
);
assert.equal((await getDoc(firstAdminReply)).data().read, true, "the observed administrator reply is marked as read");
assert.equal((await getDoc(secondAdminReply)).data().read, false, "a newer reply remains unread when the read snapshot is stale");
assert.equal(
  (await getDoc(conversationC)).data().unreadForUser,
  1,
  "clearing an older snapshot preserves the unread counter for a newer reply",
);

await adminProfile.update({ status: "Disabled", disabled: true });
await assert.rejects(
  getDoc(conversationA),
  (error) => error.code === "permission-denied",
  "disabled administrator cannot use a still-valid admin claim",
);
await adminProfile.update({ status: "Active", disabled: false, authDisabled: false });
await adminProfile.update({ status: "Deleting", deletionStatus: "queued" });
await assert.rejects(
  getDoc(conversationA),
  (error) => error.code === "permission-denied",
  "administrator with a pending deletion cannot access admin data",
);
await adminProfile.update({ status: "Active", deletionStatus: null });

const prematureEvent = doc(collection(conversationB, "archiveEvents"));
await assert.rejects(
  runTransaction(db, async (transaction) => {
    transaction.update(conversationB, {
      archived: true,
      archivedAt: serverTimestamp(),
      archivedBy: customerB.uid,
      updatedAt: serverTimestamp(),
    });
    transaction.set(prematureEvent, {
      action: "archived",
      actorId: customerB.uid,
      createdAt: serverTimestamp(),
    });
  }),
  (error) => error.code === "permission-denied",
  "administrator cannot archive an unresolved conversation",
);
await updateDoc(conversationB, {
  status: "closed",
  updatedAt: serverTimestamp(),
});

const archiveEvent = doc(collection(conversationB, "archiveEvents"));
await runTransaction(db, async (transaction) => {
  transaction.update(conversationB, {
    archived: true,
    archivedAt: serverTimestamp(),
    archivedBy: customerB.uid,
    updatedAt: serverTimestamp(),
  });
  transaction.set(archiveEvent, {
    action: "archived",
    actorId: customerB.uid,
    createdAt: serverTimestamp(),
  });
});
assert.equal((await getDoc(conversationB)).data().archived, true, "administrator can archive a conversation");
assert.equal((await getDocs(collection(conversationB, "archiveEvents"))).size, 1, "archive action is recorded");
await assert.rejects(
  updateDoc(archiveEvent, { action: "restored" }),
  (error) => error.code === "permission-denied",
  "archive history cannot be changed",
);

await getAdminAuth(adminApp).setCustomUserClaims(customerB.uid, null);
const customerToken = await customerB.getIdTokenResult(true);
assert.equal(customerToken.claims.admin, undefined, "administrator claim can be removed for customer isolation checks");
await assert.rejects(
  getDocs(collection(conversationB, "archiveEvents")),
  (error) => error.code === "permission-denied",
  "customers cannot read archive audit history",
);
await assert.rejects(
  updateDoc(conversationB, {
    status: "open",
    updatedAt: serverTimestamp(),
    lastMessage: "Reply after archive",
    lastMessageId: "customer-reply-after-archive",
    lastMessageAt: serverTimestamp(),
    unreadForAgent: 2,
  }),
  (error) => error.code === "permission-denied",
  "customer cannot reply to an archived conversation",
);

await getAdminAuth(adminApp).setCustomUserClaims(customerB.uid, { admin: true });
await customerB.getIdToken(true);
const restoreEvent = doc(collection(conversationB, "archiveEvents"));
await runTransaction(db, async (transaction) => {
  transaction.update(conversationB, {
    archived: false,
    restoredAt: serverTimestamp(),
    restoredBy: customerB.uid,
    updatedAt: serverTimestamp(),
  });
  transaction.set(restoreEvent, {
    action: "restored",
    actorId: customerB.uid,
    createdAt: serverTimestamp(),
  });
});
assert.equal((await getDoc(conversationB)).data().archived, false, "administrator can restore a conversation");
assert.equal((await getDocs(collection(conversationB, "archiveEvents"))).size, 2, "restoration is recorded separately");

const repeatedArchiveEvent = doc(collection(conversationB, "archiveEvents"));
await runTransaction(db, async (transaction) => {
  transaction.update(conversationB, {
    archived: true,
    archivedAt: serverTimestamp(),
    archivedBy: customerB.uid,
    updatedAt: serverTimestamp(),
  });
  transaction.set(repeatedArchiveEvent, {
    action: "archived",
    actorId: customerB.uid,
    createdAt: serverTimestamp(),
  });
});
const repeatedRestoreEvent = doc(collection(conversationB, "archiveEvents"));
await runTransaction(db, async (transaction) => {
  transaction.update(conversationB, {
    archived: false,
    restoredAt: serverTimestamp(),
    restoredBy: customerB.uid,
    updatedAt: serverTimestamp(),
  });
  transaction.set(repeatedRestoreEvent, {
    action: "restored",
    actorId: customerB.uid,
    createdAt: serverTimestamp(),
  });
});
assert.equal((await getDoc(conversationB)).data().archived, false, "administrator can repeat archive and restore");
assert.equal((await getDocs(collection(conversationB, "archiveEvents"))).size, 4, "repeated archive/restore actions remain auditable");

await adminProfile.delete();
console.log("Support chat Firestore rules smoke checks passed.");
await deleteApp(app);
await deleteApp(customerApp);
