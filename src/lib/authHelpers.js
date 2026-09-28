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

const FRIENDLY_ERROR_MESSAGES = {
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
    "permission-denied":
      "We could not access that information. Refresh the page and try again, or contact support if the problem continues.",
    "unavailable":
      "The service is temporarily unavailable. Check your connection and try again.",
    "deadline-exceeded":
      "The request took too long. Check your connection and try again.",
    "resource-exhausted":
      "There have been too many requests. Wait a moment and try again.",
    "failed-precondition":
      "This action is not available right now. Refresh the page and try again.",
    "already-exists": "That record already exists.",
    "aborted": "The update could not be completed. Refresh and try again.",
    "out-of-range": "One of the submitted values is outside the allowed range.",
    "data-loss": "We could not save the update. Please try again or contact support.",
    "not-found": "The requested item could not be found. Refresh and try again.",
    "unauthenticated":
      "Your session has expired. Sign in again to continue.",
    "account-data-timeout":
      "Your account data is taking too long to load. Check your connection and try again.",
};

export function getSafeErrorMessage(error, fallback = "Something went wrong.") {
  const errorCode = String(error?.code || "").toLowerCase();
  return errorCode && FRIENDLY_ERROR_MESSAGES[errorCode]
    ? FRIENDLY_ERROR_MESSAGES[errorCode]
    : isFirebaseError(error, errorCode)
      ? fallback
      : error instanceof Error
        ? error.message
        : fallback;
}

function isFirebaseError(error, code) {
  return error?.name === "FirebaseError"
    || code.startsWith("auth/")
    || code.startsWith("firestore/")
    || code.startsWith("functions/")
    || ["aborted", "already-exists", "cancelled", "data-loss", "internal", "invalid-argument", "not-found", "out-of-range", "unknown"].includes(code);
}

export function getAuthErrorMessage(error, fallback = "Something went wrong.") {
  return getSafeErrorMessage(error, fallback);
}
