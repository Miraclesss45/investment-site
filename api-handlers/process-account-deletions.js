import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../server/withdrawal-mailer.js";
import { processAccountDeletionJob } from "../server/account-deletion.js";

function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) return sendJson(res, 401, { error: "Unauthorized." });
  try {
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const auth = getAuth(app);
    const [queuedJobs, processingJobs] = await Promise.all([
      db.collection("accountDeletionJobs").where("status", "==", "queued").limit(3).get(),
      db.collection("accountDeletionJobs").where("status", "==", "processing").limit(3).get(),
    ]);
    const candidates = [...queuedJobs.docs, ...processingJobs.docs]
      .filter((document) => Number(document.data().leaseUntil) <= Date.now())
      .slice(0, 3);
    const results = [];
    for (const job of candidates) {
      results.push({ id: job.id, ...(await processAccountDeletionJob(db, auth, job.ref, 35)) });
    }
    return sendJson(res, 200, { ok: true, processedJobs: results.length, results });
  } catch (error) {
    console.error("process-account-deletions failed", error);
    return sendJson(res, 500, { error: "Account deletion jobs could not be processed." });
  }
}
