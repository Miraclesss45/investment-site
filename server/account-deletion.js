import crypto from "node:crypto";
import { FieldPath, FieldValue } from "firebase-admin/firestore";

const LEASE_MS = 60_000;

async function claimJob(jobRef) {
  const now = Date.now();
  const leaseId = crypto.randomUUID();
  return jobRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return { missing: true };
    const job = snapshot.data();
    if (job.status === "completed") return { completed: true, job };
    if (Number(job.leaseUntil) > now) return null;
    transaction.set(jobRef, {
      status: "processing",
      leaseId,
      leaseUntil: now + LEASE_MS,
      attempts: Math.max(Number(job.attempts) || 0, 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { leaseId, job: { ...job, status: "processing" } };
  });
}

async function saveProgress(jobRef, leaseId, job) {
  await jobRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists || snapshot.data().leaseId !== leaseId) return;
    transaction.set(jobRef, {
      phase: job.phase,
      stack: job.stack,
      username: job.username || "",
      firestoreDeleted: job.firestoreDeleted === true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function releaseJob(jobRef, leaseId, patch) {
  await jobRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists || snapshot.data().leaseId !== leaseId) return;
    transaction.set(jobRef, {
      ...patch,
      status: patch.status || "queued",
      leaseId: FieldValue.delete(),
      leaseUntil: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

/** Deletes a profile tree in bounded, restartable steps, then removes Auth. */
export async function processAccountDeletionJob(db, auth, jobRef, maxSteps = 40) {
  const claim = await claimJob(jobRef);
  if (claim?.missing) return { missing: true, complete: false };
  if (claim?.completed) return { complete: true, alreadyComplete: true };
  if (!claim) return { busy: true, complete: false };

  const leaseId = claim.leaseId;
  const job = claim.job;
  let steps = 0;
  try {
    const targetId = job.userId || jobRef.id;
    try {
      const account = await auth.getUser(targetId);
      if (!account.disabled) await auth.updateUser(targetId, { disabled: true });
      if (account.customClaims?.admin === true || String(account.customClaims?.role || "").toLowerCase() === "admin") {
        await auth.setCustomUserClaims(targetId, { ...(account.customClaims || {}), admin: false, role: "member" });
        await auth.revokeRefreshTokens(targetId);
      }
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }

    while (steps < maxSteps && job.phase === "firestore") {
      const top = job.stack.at(-1);
      if (!top) {
        job.phase = "username";
        await saveProgress(jobRef, leaseId, job);
        continue;
      }

      if (top.kind === "doc") {
        const ref = db.doc(top.path);
        if (!top.listedCollections) {
          const collections = await ref.listCollections();
          if (collections.length) {
            job.stack[job.stack.length - 1] = {
              kind: "collections",
              path: top.path,
              collectionPaths: collections.map((collection) => collection.path),
            };
            await saveProgress(jobRef, leaseId, job);
          } else {
            await ref.delete();
            job.stack.pop();
            steps += 1;
            await saveProgress(jobRef, leaseId, job);
          }
          continue;
        }
      }

      if (top.kind === "collections") {
        if (top.collectionPaths.length) {
          const [collectionPath, ...remaining] = top.collectionPaths;
          job.stack[job.stack.length - 1] = { ...top, collectionPaths: remaining };
          job.stack.push({ kind: "collection", path: collectionPath, after: "" });
          await saveProgress(jobRef, leaseId, job);
        } else {
          await db.doc(top.path).delete();
          job.stack.pop();
          steps += 1;
          await saveProgress(jobRef, leaseId, job);
        }
        continue;
      }

      if (top.kind === "collection") {
        let query = db.collection(top.path).orderBy(FieldPath.documentId()).limit(1);
        if (top.after) query = query.startAfter(top.after);
        const page = await query.get();
        if (page.empty) {
          job.stack.pop();
          await saveProgress(jobRef, leaseId, job);
        } else {
          const nextDocument = page.docs[0];
          job.stack[job.stack.length - 1] = { ...top, after: nextDocument.id };
          job.stack.push({ kind: "doc", path: nextDocument.ref.path });
          await saveProgress(jobRef, leaseId, job);
        }
        continue;
      }

      throw new Error("The saved account cleanup cursor is invalid.");
    }

    if (job.phase === "username") {
      const username = String(job.username || "").trim().toLowerCase();
      if (/^[a-z0-9._-]{3,30}$/.test(username)) {
        const usernameRef = db.collection("usernames").doc(username);
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(usernameRef);
          if (String(snapshot.data()?.uid || "") === (job.userId || jobRef.id)) transaction.delete(usernameRef);
        });
      }
      job.phase = "auth";
      job.firestoreDeleted = true;
      await saveProgress(jobRef, leaseId, job);
    }

    if (job.phase === "auth") {
      try {
        await auth.deleteUser(job.userId || jobRef.id);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }
      await releaseJob(jobRef, leaseId, {
        status: "completed",
        phase: "completed",
        stack: [],
        completedAt: FieldValue.serverTimestamp(),
        lastError: FieldValue.delete(),
      });
      await db.collection("audit").add({
        action: "delete-user",
        adminId: job.requestedBy || null,
        details: { userId: job.userId || jobRef.id, phase: "completed", firestoreDeleted: true, authDeleted: true },
        createdAt: FieldValue.serverTimestamp(),
      });
      return { complete: true, steps };
    }

    await releaseJob(jobRef, leaseId, { status: "queued", stack: job.stack, phase: job.phase });
    return { complete: false, queued: true, steps };
  } catch (error) {
    try {
      await releaseJob(jobRef, leaseId, {
        status: "queued",
        stack: job.stack,
        phase: job.phase,
        lastError: String(error?.message || "Account cleanup failed.").slice(0, 300),
        lastErrorAt: FieldValue.serverTimestamp(),
      });
    } catch (releaseError) {
      console.error("account deletion job release failed", { jobId: jobRef.id, error: releaseError });
    }
    console.error("account deletion batch failed", { userId: job.userId || jobRef.id, error });
    return { complete: false, queued: true, failed: true, steps };
  }
}
