import crypto from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";

const PAGE_SIZE = 400;
const LEASE_MS = 60_000;
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DISABLED_STATUSES = new Set(["disabled", "suspended", "blocked", "blacklisted"]);

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
    const pageToken = typeof job.pageToken === "string" ? job.pageToken : "";
    if (!pageToken && Number(job.nextRunAt?.toMillis?.() || 0) > now) return { deferred: true };
    if (Number(job.leaseUntil) > now) return null;
    transaction.set(jobRef, {
      pageToken,
      leaseId,
      leaseUntil: now + LEASE_MS,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { leaseId, pageToken };
  });
}

async function releaseRun(jobRef, leaseId, data) {
  await jobRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists || snapshot.data().leaseId !== leaseId) return;
    transaction.set(jobRef, {
      ...data,
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
  let pageToken = "";
  try {
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const auth = getAuth(app);
    jobRef = db.doc("systemJobs/accountStatusReconcile");
    const lease = await claimRun(jobRef);
    if (lease?.deferred) return sendJson(res, 200, { ok: true, deferred: true });
    if (!lease) return sendJson(res, 202, { ok: true, skipped: true, reason: "another account status reconciliation is running" });
    leaseId = lease.leaseId;
    pageToken = lease.pageToken;

    const page = await auth.listUsers(PAGE_SIZE, pageToken || undefined);
    const profiles = page.users.map((account) => db.collection("users").doc(account.uid));
    const profileSnapshots = profiles.length ? await db.getAll(...profiles) : [];
    const writes = [];
    for (let index = 0; index < profileSnapshots.length; index += 1) {
      const profileSnapshot = profileSnapshots[index];
      if (!profileSnapshot.exists) continue;
      const account = page.users[index];
      const profile = profileSnapshot.data();
      const currentStatus = String(profile.status || "").trim().toLowerCase();
      const disabled = account.disabled === true
        || profile.disabled === true
        || profile.authDisabled === true
        || DISABLED_STATUSES.has(currentStatus);
      const status = disabled
        ? "Disabled"
        : profile.status || "Active";
      if (disabled && !account.disabled) {
        await auth.updateUser(account.uid, { disabled: true });
        await auth.revokeRefreshTokens(account.uid);
      }
      writes.push({ ref: profileSnapshot.ref, data: {
        authAccount: true,
        authDisabled: disabled,
        disabled,
        status,
        accessSyncStatus: "synced",
        accessSyncedAt: FieldValue.serverTimestamp(),
      } });
    }
    for (let offset = 0; offset < writes.length; offset += 400) {
      const batch = db.batch();
      for (const write of writes.slice(offset, offset + 400)) batch.set(write.ref, write.data, { merge: true });
      await batch.commit();
    }

    const nextPageToken = page.pageToken || "";
    await releaseRun(jobRef, leaseId, nextPageToken
      ? { pageToken: nextPageToken, lastPageAt: FieldValue.serverTimestamp(), lastErrorAt: null }
      : {
          pageToken: "",
          lastCompletedAt: FieldValue.serverTimestamp(),
          nextRunAt: Timestamp.fromMillis(Date.now() + DAILY_INTERVAL_MS),
          lastProcessedCount: page.users.length,
          lastErrorAt: null,
        });
    leaseId = "";
    return sendJson(res, 200, { ok: true, processed: page.users.length, profilesUpdated: writes.length, complete: !nextPageToken });
  } catch (error) {
    if (jobRef && leaseId) {
      try {
        await releaseRun(jobRef, leaseId, { pageToken, lastErrorAt: FieldValue.serverTimestamp() });
      } catch (releaseError) {
        console.error("account status reconciliation lease release failed", releaseError);
      }
    }
    console.error("reconcile-account-status failed", error);
    return sendJson(res, 500, { error: "Account access status could not be reconciled." });
  }
}
