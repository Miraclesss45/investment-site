import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";
import { parseFirebaseServiceAccount } from "../server/firebase-service-account.js";

function loadLocalEnvironment() {
  for (const fileName of [".env.local", ".env"]) {
    if (!fs.existsSync(fileName)) continue;
    const contents = fs.readFileSync(fileName, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(FIREBASE_SERVICE_ACCOUNT(?:_FILE)?|VITE_FIREBASE_PROJECT_ID)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE
      ? fs.readFileSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_FILE), "utf8")
      : "");
  if (!raw) throw new Error("Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_FILE in the environment.");
  return parseFirebaseServiceAccount(raw);
}

async function collectQuery(query) {
  const results = [];
  let cursor = null;
  while (true) {
    let page = query.orderBy(FieldPath.documentId()).limit(400);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();
    results.push(...snapshot.docs);
    if (snapshot.size < 400) return results;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
}

async function commitDeletes(db, documents, apply) {
  if (!apply || documents.length === 0) return;
  for (let index = 0; index < documents.length; index += 400) {
    const batch = db.batch();
    for (const document of documents.slice(index, index + 400)) batch.delete(document.ref);
    await batch.commit();
  }
}

loadLocalEnvironment();
const serviceAccount = getServiceAccount();
const expectedProject = process.env.VITE_FIREBASE_PROJECT_ID;
if (expectedProject && serviceAccount.project_id !== expectedProject) {
  throw new Error("The service account project does not match VITE_FIREBASE_PROJECT_ID.");
}

const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);
const apply = process.argv.includes("--apply");
const [users, packages, paperAudits] = await Promise.all([
  db.collection("users").get(),
  db.collection("packages").get(),
  collectQuery(db.collection("audit").where("action", "==", "set-paper-trading")),
]);

const userUpdates = users.docs.filter((document) => {
  const data = document.data();
  return ["paperTrading", "paperTradingProfit", "paperTradingWithdrawals"].some((field) => field in data);
});
const packageUpdates = packages.docs.filter((document) => "paperTrading" in document.data());
const ledgerDeletes = new Map();
for (const user of users.docs) {
  const transactions = await collectQuery(user.ref.collection("transactions"));
  for (const document of transactions) {
    const data = document.data();
    if (data.type === "paper-trading-valuation" || data.source === "paper-trading-market-sync") {
      ledgerDeletes.set(document.ref.path, document);
    }
  }
}

console.log(`Target Firebase project: ${serviceAccount.project_id}`);
console.log(`Member profiles to clear: ${userUpdates.length}`);
console.log(`Package records to clear: ${packageUpdates.length}`);
console.log(`Paper-trading valuation records to delete: ${ledgerDeletes.size}`);
console.log(`Dedicated paper-trading audit records to delete: ${paperAudits.length}`);

if (!apply) {
  console.log("Dry run only. Review the counts, then rerun with --apply to delete these records.");
} else {
  for (let index = 0; index < userUpdates.length; index += 400) {
    const batch = db.batch();
    for (const document of userUpdates.slice(index, index + 400)) {
      batch.update(document.ref, {
        paperTrading: FieldValue.delete(),
        paperTradingProfit: FieldValue.delete(),
        paperTradingWithdrawals: FieldValue.delete(),
      });
    }
    await batch.commit();
  }
  for (let index = 0; index < packageUpdates.length; index += 400) {
    const batch = db.batch();
    for (const document of packageUpdates.slice(index, index + 400)) {
      batch.update(document.ref, { paperTrading: FieldValue.delete() });
    }
    await batch.commit();
  }
  await commitDeletes(db, [...ledgerDeletes.values()], true);
  await commitDeletes(db, paperAudits, true);
  console.log("Paper-trading Firestore data was removed.");
}

await app.delete();
