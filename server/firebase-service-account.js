import { readFileSync } from "node:fs";

export function parseFirebaseServiceAccount(raw) {
  if (!raw) throw new Error("Firebase service account is not configured.");

  const parse = (value) => {
    let parsed = JSON.parse(value);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Service account is not an object.");
    }
    return parsed;
  };

  try {
    return parse(raw);
  } catch {
    try {
      return parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      throw new Error("Firebase service account credentials are invalid.");
    }
  }
}

export function loadFirebaseServiceAccount() {
  const configuredJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const configuredFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  const raw = configuredJson || (configuredFile
    ? readFileSync(configuredFile, "utf8")
    : "");
  return parseFirebaseServiceAccount(raw);
}
