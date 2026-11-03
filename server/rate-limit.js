import { createHash } from "node:crypto";
import { isIP } from "node:net";

const RATE_LIMIT_SALT = process.env.RATE_LIMIT_SALT
  || process.env.CRON_SECRET
  || process.env.FIREBASE_PROJECT_ID
  || "meridianvest-rate-limit-v1";

function digest(value) {
  return createHash("sha256").update(`${RATE_LIMIT_SALT}:${value}`).digest("hex");
}

export function getClientAddress(req) {
  const trustedHeaders = [req.headers?.["x-vercel-forwarded-for"], req.headers?.["x-real-ip"]]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const address of trustedHeaders) {
    const normalized = address.replace(/^\[|\]$/g, "");
    if (isIP(normalized)) return normalized;
  }
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim());
  for (const address of forwarded.reverse()) {
    const normalized = address.replace(/^\[|\]$/g, "");
    if (isIP(normalized)) return normalized;
  }
  const socketAddress = String(req.socket?.remoteAddress || "").replace(/^\[|\]$/g, "");
  return isIP(socketAddress) ? socketAddress : "unknown";
}

export async function enforceRateLimit(db, { scope, identity, limit, windowMs, now = Date.now() }) {
  const key = digest(`${scope}:${String(identity || "unknown").trim().toLowerCase()}`);
  const ref = db.collection("requestRateLimits").doc(key);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : {};
    const windowStartedAt = Number(current.windowStartedAt) || 0;
    const previousCount = Number(current.count) || 0;
    const sameWindow = windowStartedAt > 0 && now - windowStartedAt < windowMs && now >= windowStartedAt;
    if (sameWindow && previousCount >= limit) {
      throw Object.assign(new Error("Too many requests. Please wait before trying again."), {
        statusCode: 429,
        code: "rate-limit-exceeded",
      });
    }
    transaction.set(ref, {
      scope,
      windowStartedAt: sameWindow ? windowStartedAt : now,
      count: sameWindow ? previousCount + 1 : 1,
      updatedAt: now,
      expiresAt: new Date(now + windowMs * 4),
    });
  });
}
