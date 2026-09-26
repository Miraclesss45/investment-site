import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import admin from "firebase-admin";

const args = process.argv.slice(2);
const flags = {
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || "",
  password: "",
  createUser: false,
  emailVerified: false,
};
let emailArgument = "";

for (const arg of args) {
  if (arg === "--create-user") flags.createUser = true;
  else if (arg === "--email-verified") flags.emailVerified = true;
  else if (arg.startsWith("--service-account=")) {
    flags.serviceAccount = arg.slice("--service-account=".length);
  } else if (arg.startsWith("--password=")) {
    flags.password = arg.slice("--password=".length);
  } else if (arg.startsWith("--email=")) {
    emailArgument = arg.slice("--email=".length);
  } else if (!arg.startsWith("--") && arg !== "--") {
    emailArgument ||= arg;
  }
}

const input = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function resolveServiceAccountPath(rawPath) {
  const resolved = path.resolve(rawPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) return resolved;

  const files = fs.readdirSync(resolved)
    .filter((file) => file.toLowerCase().endsWith(".json"));
  if (files.length === 0) {
    throw new Error(`No .json files found in directory: ${resolved}`);
  }
  if (files.length === 1) return path.join(resolved, files[0]);

  console.log(`Multiple JSON files found in ${resolved}:`);
  files.forEach((file, index) => console.log(`${index + 1}) ${file}`));
  const selection = Number.parseInt(
    (await input.question(`Enter number of file to use (1-${files.length}): `)).trim(),
    10,
  ) - 1;
  if (Number.isNaN(selection) || selection < 0 || selection >= files.length) {
    throw new Error("Invalid file selection.");
  }
  return path.join(resolved, files[selection]);
}

async function findOrCreateUser(email) {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }

  const createUser = flags.createUser || flags.password
    ? true
    : (await input.question(
      `No user found for ${email}. Create a new user? (y/N): `,
    )).trim().toLowerCase() === "y";

  if (!createUser) {
    throw new Error(`No Firebase Authentication user was found for ${email}.`);
  }

  const password = flags.password || (await input.question(
    "Enter a password for the new user (min 8 chars): ",
  )).trim();
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const emailVerified = flags.emailVerified || (await input.question(
    "Mark email as verified? (y/N): ",
  )).trim().toLowerCase() === "y";
  const user = await admin.auth().createUser({
    email,
    password,
    emailVerified,
  });
  console.log(`Created user ${email} (uid: ${user.uid}).`);
  return user;
}

try {
  const serviceAccountInput = flags.serviceAccount
    || (await input.question("Path to Firebase service-account JSON: ")).trim();
  const serviceAccountPath = await resolveServiceAccountPath(serviceAccountInput);
  const email = (emailArgument
    || (await input.question("Firebase user email to make admin: "))).trim().toLowerCase();
  if (!email) throw new Error("Firebase user email is required.");

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  if (serviceAccount.project_id !== "meridianvest-ae68f") {
    throw new Error(
      `This service-account belongs to ${serviceAccount.project_id || "an unknown project"}, not meridianvest-ae68f.`,
    );
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const user = await findOrCreateUser(email);
  await admin.auth().setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
    role: "admin",
  });

  console.log(`Admin access granted to ${email}.`);
  console.log("Sign out completely, then sign in again to refresh the admin claim.");
} catch (error) {
  console.error(`Unable to grant admin access: ${error.message}`);
  process.exitCode = 1;
} finally {
  await input.close();
}
