export function normalizeLoginIdentifier(value = "") {
  return String(value).trim().toLowerCase();
}

export async function resolveLoginEmail(identifier = "") {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);

  if (!normalizedIdentifier) {
    throw new Error("Enter your email address to continue.");
  }

  if (normalizedIdentifier.includes("@")) {
    return normalizedIdentifier;
  }

  throw new Error("Enter the email address used to create your account.");
}

export function getAuthErrorMessage(error, fallback = "Something went wrong.") {
  const messages = {
    "auth/email-already-in-use":
      "An account already exists with this email address.",
    "auth/weak-password":
      "Use a stronger password with at least 6 characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-not-found": "The email or password is incorrect.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/too-many-requests":
      "Too many attempts. Wait a moment and try again.",
    "auth/requires-recent-login":
      "For your security, sign in again and retry this action.",
    "auth/password-does-not-meet-requirements":
      "Use a stronger password that meets Firebase's password requirements.",
    "auth/invalid-credential":
      "The email or password is incorrect. Check both values and try again.",
    "auth/invalid-login-credentials":
      "The email or password is incorrect. Check both values and try again.",
    "auth/invalid-password":
      "The email or password is incorrect. Check both values and try again.",
    "auth/user-disabled":
      "This account has been disabled. Contact support for help.",
    "auth/operation-not-allowed":
      "Email and password sign-in is not enabled for this Firebase project.",
    "auth/configuration-not-found":
      "Firebase Authentication is not configured for this app.",
    "auth/network-request-failed":
      "Network error. Check your connection and try again.",
    "invalid_credentials": "The email or password is incorrect.",
    "user_not_found": "The email or password is incorrect.",
    "invalid_email": "Enter a valid email address.",
    "email_exists":
      "An account already exists with this email address.",
    "weak_password": "Use a stronger password with at least 6 characters.",
    "over_request_rate_limit": "Too many attempts. Wait a moment and try again.",
    "network_error":
      "Network error. Check your connection and try again.",
  };

  const errorCode = String(error?.code || "").toLowerCase();
  return errorCode && messages[errorCode]
    ? messages[errorCode]
    : error instanceof Error
      ? error.message
      : fallback;
}
