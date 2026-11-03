import crypto from "node:crypto";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";
import { getSupportSearchTokens } from "../src/lib/supportSearch.js";

const PAGE_SIZE = 200;
const MAX_PER_RUN = 800;
const LEASE_MS = 60_000;

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

async function claimRun(jobRef) {
  const now = Date.now();
  const leaseId = crypto.randomUUID();
  return jobRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    const job = snapshot.exists ? snapshot.data() : {};
    if (job.completedAt) return { completed: true };
    if (Number(job.leaseUntil) > now) return null;
    transaction.set(jobRef, {
      cursorPath: typeof job.cursorPath === "string" ? job.cursorPath : "",
      phase: job.phase === "conversations" ? "conversations" : "messages",
      processedCount: Math.max(Number(job.processedCount) || 0, 0),
      leaseId,
      leaseUntil: now + LEASE_MS,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
      leaseId,
      cursorPath: String(job.cursorPath || ""),
      phase: job.phase === "conversations" ? "conversations" : "messages",
      processedCount: Number(job.processedCount) || 0,
    };
  });
}

async function saveRun(jobRef, leaseId, state) {
  await jobRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists || snapshot.data().leaseId !== leaseId) return;
    transaction.set(jobRef, {
      ...state,
      leaseId: FieldValue.delete(),
      leaseUntil: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) return sendJson(res, 401, { error: "Unauthorized." });

  let jobRef;
  let leaseId = "";
  let cursorPath = "";
  let phase = "messages";
  let processedCount = 0;
  try {
    const db = getFirestore(getFirebaseAdminApp());
    jobRef = db.doc("systemJobs/supportSearchIndex");
    const lease = await claimRun(jobRef);
    if (lease?.completed) return sendJson(res, 200, { ok: true, complete: true, processed: 0 });
    if (!lease) return sendJson(res, 202, { ok: true, skipped: true, reason: "another index batch is running" });
    leaseId = lease.leaseId;
    cursorPath = lease.cursorPath;
    phase = lease.phase;
    processedCount = lease.processedCount;

    let processed = 0;
    let complete = false;
    while (processed < MAX_PER_RUN) {
      const requestedLimit = Math.min(PAGE_SIZE, MAX_PER_RUN - processed);
      const baseQuery = phase === "messages"
        ? db.collectionGroup("messages").orderBy(FieldPath.documentId())
        : db.collection("supportConversations").orderBy(FieldPath.documentId());
      let pageQuery = baseQuery.limit(requestedLimit);
      if (cursorPath) {
        const cursor = await db.doc(cursorPath).get();
        if (cursor.exists) pageQuery = pageQuery.startAfter(cursor);
        else cursorPath = "";
      }
      const page = await pageQuery.get();
      if (page.empty) {
        cursorPath = "";
        if (phase === "messages") {
          phase = "conversations";
          continue;
        }
        complete = true;
        phase = "complete";
        break;
      }

      const termsByConversation = new Map();
      if (phase === "messages") {
        for (const messageDoc of page.docs) {
          const parts = messageDoc.ref.path.split("/");
          if (parts.length !== 4 || parts[0] !== "supportConversations" || parts[2] !== "messages") continue;
          const terms = getSupportSearchTokens(messageDoc.data().text);
          if (!terms.length) continue;
          const existing = termsByConversation.get(parts[1]) || new Set();
          for (const term of terms) existing.add(term);
          termsByConversation.set(parts[1], existing);
        }
      } else {
        for (const conversation of page.docs) {
          const data = conversation.data();
          termsByConversation.set(conversation.id, new Set(getSupportSearchTokens(data.userName, data.userEmail, data.userId, data.lastMessage)));
        }
      }
      if (termsByConversation.size) {
        const conversationIds = [...termsByConversation.keys()];
        const conversationRefs = conversationIds.map((id) => db.collection("supportConversations").doc(id));
        const conversationSnapshots = await db.getAll(...conversationRefs);
        const updates = [];
        conversationSnapshots.forEach((conversation, index) => {
          if (!conversation.exists) return;
          const conversationId = conversationIds[index];
          const terms = [...termsByConversation.get(conversationId)];
          const current = conversation.data();
          const currentTokens = new Set(Array.isArray(current.searchTokens) ? current.searchTokens : []);
          const storedTokenCount = Array.isArray(current.searchTokens) ? current.searchTokens.length : 0;
          const available = Math.max(15000 - storedTokenCount, 0);
          const missingTerms = [...new Set(terms)].filter((term) => !currentTokens.has(term));
          const additions = missingTerms.slice(0, available);
          const truncated = missingTerms.length > additions.length;
          if (additions.length || truncated) updates.push({ conversation, additions, truncated });
        });
        for (let offset = 0; offset < updates.length; offset += 8) {
          const batch = db.batch();
          for (const { conversation, additions, truncated } of updates.slice(offset, offset + 8)) {
            batch.update(conversation.ref, {
              ...(additions.length ? { searchTokens: FieldValue.arrayUnion(...additions) } : {}),
              ...(truncated ? { searchIndexTruncated: true } : {}),
            });
          }
          await batch.commit();
        }
      }

      cursorPath = page.docs[page.docs.length - 1].ref.path;
      processed += page.size;
      processedCount += page.size;
      if (page.size < requestedLimit) {
        cursorPath = "";
        if (phase === "messages") {
          phase = "conversations";
          continue;
        }
        complete = true;
        phase = "complete";
        break;
      }
    }

    await saveRun(jobRef, leaseId, {
      cursorPath,
      phase,
      processedCount,
      ...(complete ? { completedAt: FieldValue.serverTimestamp(), lastErrorAt: null } : { lastPartialAt: FieldValue.serverTimestamp() }),
    });
    leaseId = "";
    return sendJson(res, 200, { ok: true, complete, phase, processed, processedCount });
  } catch (error) {
    if (jobRef && leaseId) {
      try {
        await saveRun(jobRef, leaseId, { cursorPath, phase, processedCount, lastErrorAt: FieldValue.serverTimestamp() });
      } catch (releaseError) {
        console.error("support search index lease release failed", releaseError);
      }
    }
    console.error("reindex-support-search failed", error);
    return sendJson(res, 500, { error: "The support search index could not be updated." });
  }
}
