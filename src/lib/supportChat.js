import {
  collection,
  doc,
  arrayUnion,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { firebaseApp } from "./firebase";
import { getSupportSearchTokens } from "./supportSearch";
import { markSupportMessagesAsRead } from "./supportChatRead";

export const SUPPORT_CONVERSATION_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
];

const CONVERSATIONS = "supportConversations";
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONVERSATION_SEARCH_TOKENS = 15000;
export { SUPPORT_CHAT_OPEN_EVENT } from "./supportChatEvents";

function getDb() {
  if (!firebaseApp) {
    throw new Error("Support chat is temporarily unavailable because Firebase is not configured.");
  }
  return getFirestore(firebaseApp);
}

function getMessageText(value) {
  const text = String(value || "").trim();
  if (!text) throw new Error("Write a message before sending.");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`);
  }
  return text;
}

function getConversationRef(userId) {
  return doc(getDb(), CONVERSATIONS, `customer_${userId}`);
}

function getMessagesCollection(conversationId) {
  return collection(getDb(), CONVERSATIONS, conversationId, "messages");
}

export function subscribeToCustomerConversation(userId, onValue, onError) {
  return onSnapshot(getConversationRef(userId), (snapshot) => {
    onValue(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export function subscribeToAdminConversations(onValue, onError) {
  const conversationsQuery = query(
    collection(getDb(), CONVERSATIONS),
    orderBy("updatedAt", "desc"),
    limit(101),
  );
  return onSnapshot(conversationsQuery, (snapshot) => {
    const pageDocuments = snapshot.docs.slice(0, 100);
    onValue(
      pageDocuments.map((item) => ({ ...item.data(), id: item.id })),
      { hasMore: snapshot.docs.length > pageDocuments.length, nextCursor: pageDocuments.at(-1) || null },
    );
  }, onError);
}

export function subscribeToAdminConversation(conversationId, onValue, onError) {
  return onSnapshot(
    doc(getDb(), CONVERSATIONS, conversationId),
    (snapshot) => onValue(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export async function getOlderAdminConversations(cursor) {
  if (!cursor) return { items: [], nextCursor: null, hasMore: false };
  const conversationsQuery = query(
    collection(getDb(), CONVERSATIONS),
    orderBy("updatedAt", "desc"),
    startAfter(cursor),
    limit(101),
  );
  const snapshot = await getDocs(conversationsQuery);
  const pageDocuments = snapshot.docs.slice(0, 100);
  return {
    items: pageDocuments.map((item) => ({ ...item.data(), id: item.id })),
    nextCursor: pageDocuments.at(-1) || null,
    hasMore: snapshot.docs.length > pageDocuments.length,
  };
}

export function subscribeToMessages(conversationId, onValue, onError) {
  const messagesQuery = query(
    getMessagesCollection(conversationId),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  return onSnapshot(messagesQuery, (snapshot) => {
    onValue(snapshot.docs);
  }, onError);
}

export function getOlderMessages(conversationId, cursor) {
  return getDocs(query(
    getMessagesCollection(conversationId),
    orderBy("createdAt", "desc"),
    startAfter(cursor),
    limit(50),
  ));
}

function makeMessage(conversationId, user, senderType, text) {
  const messageText = getMessageText(text);
  const messageRef = doc(getMessagesCollection(conversationId));
  return {
    messageRef,
    data: {
      senderId: user.uid,
      senderType,
      text: messageText,
      type: "text",
      createdAt: serverTimestamp(),
      read: false,
    },
  };
}

export async function sendCustomerMessage(user, identity, text) {
  if (!user?.uid) throw new Error("Start a support session before sending a message.");
  const conversationRef = getConversationRef(user.uid);
  const conversationId = conversationRef.id;
  const { messageRef, data: message } = makeMessage(conversationId, user, "customer", text);
  const safeName = String(identity?.name || "").trim().slice(0, 120);
  const safeEmail = String(identity?.email || "").trim().slice(0, 254).toLowerCase();
  if (!safeName || !safeEmail) {
    throw new Error("Enter your name and email to start a support conversation.");
  }
  const searchTokens = getSupportSearchTokens(safeName, safeEmail, user.uid, message.text);

  await runTransaction(getDb(), async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationRef);
    if (!conversationSnapshot.exists()) {
      transaction.set(conversationRef, {
        userId: user.uid,
        userName: safeName,
        userEmail: safeEmail,
        userCountry: String(identity?.country || "").trim().slice(0, 100),
        userType: user.isAnonymous ? "guest" : "member",
        status: "open",
        assignedAgent: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: message.text,
        lastMessageId: messageRef.id,
        lastMessageAt: serverTimestamp(),
        searchTokens,
        unreadForUser: 0,
        unreadForAgent: 1,
      });
    } else {
      const conversation = conversationSnapshot.data();
      if (conversation.userId !== user.uid) {
        throw new Error("This support conversation is not available to your account.");
      }
      const storedTokens = Array.isArray(conversation.searchTokens) ? conversation.searchTokens : [];
      const existingTokens = new Set(storedTokens);
      const availableTokenSlots = Math.max(MAX_CONVERSATION_SEARCH_TOKENS - storedTokens.length, 0);
      const missingSearchTokens = searchTokens.filter((token) => !existingTokens.has(token));
      const newSearchTokens = missingSearchTokens.slice(0, availableTokenSlots);
      const searchIndexTruncated = newSearchTokens.length < missingSearchTokens.length;
      transaction.update(conversationRef, {
        status: "open",
        lastMessage: message.text,
        lastMessageId: messageRef.id,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadForAgent: (Number(conversation.unreadForAgent) || 0) + 1,
        ...(newSearchTokens.length ? { searchTokens: arrayUnion(...newSearchTokens) } : {}),
        ...(searchIndexTruncated ? { searchIndexTruncated: true } : {}),
      });
    }
    transaction.set(messageRef, message);
  });
  return { conversationId, messageId: messageRef.id };
}

export async function sendAdminMessage(user, conversationId, text) {
  if (!user?.uid) throw new Error("An administrator session is required to reply.");
  const conversationRef = doc(getDb(), CONVERSATIONS, conversationId);
  const { messageRef, data: message } = makeMessage(conversationId, user, "agent", text);
  const searchTokens = getSupportSearchTokens(message.text);

  await runTransaction(getDb(), async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationRef);
    if (!conversationSnapshot.exists()) throw new Error("This conversation no longer exists.");
    const conversation = conversationSnapshot.data();
    if (["resolved", "closed"].includes(conversation.status)) {
      throw new Error("Reopen this conversation before replying.");
    }
    const storedTokens = Array.isArray(conversation.searchTokens) ? conversation.searchTokens : [];
    const existingTokens = new Set(storedTokens);
    const availableTokenSlots = Math.max(MAX_CONVERSATION_SEARCH_TOKENS - storedTokens.length, 0);
    const newSearchTokens = searchTokens.filter((token) => !existingTokens.has(token)).slice(0, availableTokenSlots);
    const missingSearchTokens = searchTokens.filter((token) => !existingTokens.has(token));
    transaction.update(conversationRef, {
      status: "waiting",
      assignedAgent: conversation.assignedAgent || user.uid,
      lastMessage: message.text,
      lastMessageId: messageRef.id,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadForUser: (Number(conversation.unreadForUser) || 0) + 1,
      ...(newSearchTokens.length ? { searchTokens: arrayUnion(...newSearchTokens) } : {}),
      ...(newSearchTokens.length < missingSearchTokens.length ? { searchIndexTruncated: true } : {}),
    });
    transaction.set(messageRef, message);
  });
  return messageRef.id;
}

export async function updateConversationStatus(conversationId, status) {
  if (!SUPPORT_CONVERSATION_STATUSES.includes(status)) {
    throw new Error("Choose a valid support status.");
  }
  await updateDoc(doc(getDb(), CONVERSATIONS, conversationId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function setConversationArchived(user, conversationId, archived) {
  if (!user?.uid) throw new Error("An administrator session is required.");
  if (typeof archived !== "boolean") throw new Error("Choose a valid archive action.");

  const db = getDb();
  const conversationRef = doc(db, CONVERSATIONS, conversationId);
  const eventRef = doc(collection(conversationRef, "archiveEvents"));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(conversationRef);
    if (!snapshot.exists()) throw new Error("This conversation no longer exists.");

    const conversation = snapshot.data();
    if (Boolean(conversation.archived) === archived) return;
    if (archived && !["resolved", "closed"].includes(conversation.status)) {
      throw new Error("Resolve or close the conversation before archiving it.");
    }

    const now = serverTimestamp();
    transaction.update(conversationRef, archived
      ? {
        archived: true,
        archivedAt: now,
        archivedBy: user.uid,
        updatedAt: now,
      }
      : {
        archived: false,
        restoredAt: now,
        restoredBy: user.uid,
        updatedAt: now,
      });
    transaction.set(eventRef, {
      action: archived ? "archived" : "restored",
      actorId: user.uid,
      createdAt: now,
    });
  });
}

export function markMessagesAsRead(
  conversationId,
  viewerType,
  messageDocs = [],
  force = false,
  observedLastMessageId = null,
) {
  const db = getDb();
  return markSupportMessagesAsRead(
    db,
    doc(db, CONVERSATIONS, conversationId),
    viewerType,
    messageDocs,
    force,
    observedLastMessageId,
  );
}

export async function setSupportTyping(conversationId, userId, isTyping) {
  await setDoc(
    doc(getDb(), CONVERSATIONS, conversationId, "typing", userId),
    { userId, isTyping, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function subscribeToTyping(conversationId, currentUserId, onValue, onError) {
  return onSnapshot(
    collection(getDb(), CONVERSATIONS, conversationId, "typing"),
    (snapshot) => {
      const now = Date.now();
      const active = snapshot.docs
        .map((item) => item.data())
        .filter((item) => item.userId !== currentUserId && item.isTyping === true)
        .filter((item) => {
          const updatedAt = item.updatedAt?.toMillis?.() || now;
          return now - updatedAt < 15000;
        });
      onValue(active);
    },
    onError,
  );
}
