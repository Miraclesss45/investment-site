import { runTransaction } from "firebase/firestore";

export async function markSupportMessagesAsRead(
  db,
  conversationRef,
  viewerType,
  messageDocs = [],
  force = false,
  observedLastMessageId = null,
) {
  const incomingType = viewerType === "agent" ? "customer" : "agent";
  const unreadField = viewerType === "agent" ? "unreadForAgent" : "unreadForUser";

  await runTransaction(db, async (transaction) => {
    const conversationSnapshot = await transaction.get(conversationRef);
    if (!conversationSnapshot.exists()) return;

    const candidates = messageDocs.filter((messageDoc) => (
      messageDoc.data().senderType === incomingType
      && messageDoc.data().read !== true
    ));
    const currentMessages = await Promise.all(candidates.map((messageDoc) => (
      transaction.get(messageDoc.ref)
    )));
    const unreadMessages = candidates.filter((messageDoc, index) => (
      currentMessages[index].exists()
      && currentMessages[index].data().senderType === incomingType
      && currentMessages[index].data().read !== true
    ));
    const conversation = conversationSnapshot.data();
    const canClearAll = force
      && observedLastMessageId
      && conversation.lastMessageId === observedLastMessageId;

    if (!unreadMessages.length && !canClearAll) return;

    for (const messageDoc of unreadMessages) {
      transaction.update(messageDoc.ref, { read: true });
    }
    transaction.update(conversationRef, {
      [unreadField]: canClearAll
        ? 0
        : Math.max((Number(conversation[unreadField]) || 0) - unreadMessages.length, 0),
    });
  });
}
