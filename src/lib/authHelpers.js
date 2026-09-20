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

  return error?.code && messages[error.code]
    ? messages[error.code]
    : error instanceof Error
      ? error.message
      : fallback;
}
