import crypto from "node:crypto";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";
import { accrueInvestment, recordInvestmentAccrualFailure, resolveInvestmentAccrualFailure } from "../server/investment-accrual.js";

const PAGE_SIZE = 100;
const MAX_PER_RUN = 500;
const MAX_RUN_MS = 22000;
const WRITE_CONCURRENCY = 10;
const LEASE_MS = 35000;

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

async function claimRun(jobRef, now) {
  const leaseId = crypto.randomUUID();
  const claimed = await jobRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);
    const job = snapshot.exists ? snapshot.data() : {};
    if (Number(job.leaseUntil) > now.getTime()) return null;
    transaction.set(jobRef, {
      cursorPath: typeof job.cursorPath === "string" ? job.cursorPath : "",
      cycleStartedAt: job.cycleStartedAt || FieldValue.serverTimestamp(),
      leaseId,
      leaseUntil: now.getTime() + LEASE_MS,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { leaseId, cursorPath: String(job.cursorPath || "") };
  });
  return claimed;
}

async function releaseRun(jobRef, leaseId, state) {
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
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
    return sendJson(res, 401, { error: "Unauthorized." });
  }

  let jobRef;
  let leaseId = "";
  let cursorPath = "";
  const totals = { accrued: 0, matured: 0, skipped: 0, notDue: 0, failed: 0 };
  try {
    const db = getFirestore(getFirebaseAdminApp());
    const now = new Date();
    jobRef = db.collection("systemJobs").doc("investmentAccrual");
    const lease = await claimRun(jobRef, now);
    if (!lease) return sendJson(res, 202, { ok: true, skipped: true, reason: "another accrual batch is running" });
    leaseId = lease.leaseId;
    cursorPath = lease.cursorPath;

    const baseQuery = db.collectionGroup("investments")
      .where("status", "==", "active")
      .orderBy(FieldPath.documentId());
    const startedAt = Date.now();
    let completedCycle = false;

    while (totals.accrued + totals.matured + totals.skipped + totals.notDue + totals.failed < MAX_PER_RUN
      && Date.now() - startedAt < MAX_RUN_MS) {
      let cursor = null;
      if (cursorPath) {
        const cursorSnapshot = await db.doc(cursorPath).get();
        if (cursorSnapshot.exists) cursor = cursorSnapshot;
        else cursorPath = "";
      }
      const remaining = MAX_PER_RUN - totals.accrued - totals.matured - totals.skipped - totals.notDue - totals.failed;
      let pageQuery = baseQuery.limit(Math.min(PAGE_SIZE, remaining));
      if (cursor) pageQuery = pageQuery.startAfter(cursor);
      const page = await pageQuery.get();
      if (page.empty) {
        completedCycle = true;
        cursorPath = "";
        break;
      }

      for (let offset = 0; offset < page.docs.length; offset += WRITE_CONCURRENCY) {
        const documents = page.docs.slice(offset, offset + WRITE_CONCURRENCY);
        const results = await Promise.allSettled(documents.map((document) => accrueInvestment(db, document.ref, now)));
        for (let index = 0; index < results.length; index += 1) {
          const result = results[index];
          const document = documents[index];
          if (result.status === "rejected") {
            totals.failed += 1;
            await recordInvestmentAccrualFailure(db, document.ref, result.reason);
            console.error("investment accrual item failed; continuing the batch", {
              investmentPath: document.ref.path,
              error: result.reason,
            });
            continue;
          }
          await resolveInvestmentAccrualFailure(db, document.ref);
          if (result.value === "accrued") totals.accrued += 1;
          else if (result.value === "matured") totals.matured += 1;
          else if (result.value === "not-due") totals.notDue += 1;
          else totals.skipped += 1;
        }
      }
      cursorPath = page.docs[page.docs.length - 1].ref.path;
      if (page.size < Math.min(PAGE_SIZE, remaining)) {
        completedCycle = true;
        cursorPath = "";
        break;
      }
    }

    const totalProcessed = totals.accrued + totals.matured + totals.skipped + totals.notDue + totals.failed;
    const resumable = !completedCycle && Boolean(cursorPath);
    await releaseRun(jobRef, leaseId, {
      cursorPath,
      lastErrorAt: null,
      lastFailedCount: totals.failed,
      ...(completedCycle ? {
        cycleStartedAt: null,
        lastCompletedAt: FieldValue.serverTimestamp(),
        lastCompletedCount: totalProcessed,
      } : {
        lastPartialAt: FieldValue.serverTimestamp(),
        lastPartialCount: totalProcessed,
      }),
    });
    leaseId = "";
    return sendJson(res, 200, { ok: true, ...totals, resumable, cursorPath: resumable ? cursorPath : null });
  } catch (error) {
    if (jobRef && leaseId) {
      try {
        await releaseRun(jobRef, leaseId, { cursorPath, lastErrorAt: FieldValue.serverTimestamp() });
      } catch (releaseError) {
        console.error("investment accrual lease release failed", releaseError);
      }
    }
    console.error("accrue-investments failed", error);
    return sendJson(res, 500, { error: "Investment accrual could not be completed." });
  }
}
