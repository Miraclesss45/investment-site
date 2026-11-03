import fs from "node:fs";
import process from "node:process";
import admin from "firebase-admin";
import { getAdminAccountAccessState, isAdministratorClaim } from "../server/admin-access.js";
import { loadFirebaseServiceAccount, parseFirebaseServiceAccount } from "../server/firebase-service-account.js";

const args = process.argv.slice(2);
const email = String(args.find((arg) => arg.startsWith("--email="))?.slice(8) || "").trim().toLowerCase();
const serviceAccountArgument = args.find((arg) => arg.startsWith("--service-account="))?.slice(18);
const applyChanges = args.includes("--apply");

function getCredentials() {
  if (serviceAccountArgument) return parseFirebaseServiceAccount(fs.readFileSync(serviceAccountArgument, "utf8"));
  return loadFirebaseServiceAccount();
}

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/restore-admin-access.mjs --email=admin@example.com [--service-account=path] [--apply]");
  process.exit(2);
}

try {
  const credentials = getCredentials();
  if (credentials.project_id !== "meridianvest-ae68f") {
    throw new Error(`Service account project mismatch: expected meridianvest-ae68f.`);
  }

  admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const auth = admin.auth();
  const db = admin.firestore();
  const authUser = await auth.getUserByEmail(email);
  if (!isAdministratorClaim(authUser)) {
    throw new Error("The existing Auth account does not already have an administrator claim; this recovery tool will not grant one.");
  }

  const profileRef = db.collection("users").doc(authUser.uid);
  const deletionJobRef = db.collection("accountDeletionJobs").doc(authUser.uid);
  const [profileSnapshot, deletionJobSnapshot] = await Promise.all([
    profileRef.get(),
    deletionJobRef.get(),
  ]);
  if (deletionJobSnapshot.exists) {
    throw new Error("An account deletion job exists for this account. Recovery stopped without changing it.");
  }

  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
  const accessState = getAdminAccountAccessState(profile, authUser.disabled);
  if (accessState === "deletion-pending") {
    throw new Error("The profile is marked for deletion. Recovery stopped without changing it.");
  }

  const profilePatch = {
    uid: authUser.uid,
    email: authUser.email || email,
    role: "admin",
    ...(!profile?.status || ["disabled", "suspended", "blocked", "blacklisted"].includes(String(profile.status).trim().toLowerCase())
      ? { status: "Active" }
      : { status: profile.status }),
    disabled: false,
    authDisabled: false,
    disabledAt: admin.firestore.FieldValue.delete(),
    disabledBy: admin.firestore.FieldValue.delete(),
    authAccount: true,
    accessSyncStatus: "synced",
    accessSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!profileSnapshot.exists) profilePatch.createdAt = admin.firestore.FieldValue.serverTimestamp();

  if (!applyChanges) {
    console.log(JSON.stringify({
      mode: "dry-run",
      authEnabled: authUser.disabled !== true,
      profileExists: profileSnapshot.exists,
      profileState: accessState,
      existingAdminClaim: true,
      deletionJobExists: false,
      action: profileSnapshot.exists ? "restore disabled profile flags" : "recreate the missing admin profile without touching subcollections",
    }));
    console.log("Pass --apply to apply this guarded repair.");
    process.exitCode = 0;
  } else {
    if (authUser.disabled === true) await auth.updateUser(authUser.uid, { disabled: false });

    const auditRef = db.collection("audit").doc();
    await db.runTransaction(async (transaction) => {
      const [currentProfile, currentDeletionJob] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(deletionJobRef),
      ]);
      if (currentDeletionJob.exists) throw new Error("An account deletion job appeared during recovery; no profile changes were made.");
      const currentData = currentProfile.exists ? currentProfile.data() : null;
      if (getAdminAccountAccessState(currentData) === "deletion-pending") {
        throw new Error("The profile became marked for deletion during recovery; no profile changes were made.");
      }

      const patch = {
        ...profilePatch,
        ...(currentProfile.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      };
      transaction.set(profileRef, patch, { merge: true });
      transaction.create(auditRef, {
        action: "restore-admin-access",
        adminId: null,
        adminEmail: null,
        details: {
          targetUid: authUser.uid,
          profileRecreated: !currentProfile.exists,
          previousProfileState: getAdminAccountAccessState(currentData),
          financialDataModified: false,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(JSON.stringify({
      mode: "applied",
      authEnabled: true,
      profileExists: true,
      previousProfileState: accessState,
      adminClaimPreserved: true,
      financialDataModified: false,
      auditRecorded: true,
    }));
    console.log("Sign out and sign in again to refresh the administrator session.");
  }
} catch (error) {
  console.error(`Admin recovery stopped: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (admin.apps.length) await admin.app().delete();
}
