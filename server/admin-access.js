const DISABLED_ACCOUNT_STATUSES = new Set([
  "disabled",
  "suspended",
  "blocked",
  "blacklisted",
]);

export function getAdminAccountAccessState(profile, authDisabled = false) {
  if (!profile) return "missing-profile";

  const status = String(profile.status || "").trim().toLowerCase();
  if (Boolean(profile.deletionStatus) || status === "deleting") {
    return "deletion-pending";
  }

  if (
    authDisabled === true
    || profile.disabled === true
    || profile.authDisabled === true
    || DISABLED_ACCOUNT_STATUSES.has(status)
  ) {
    return "disabled";
  }

  return "active";
}

export function isActiveAdminProfile(profile) {
  return profile?.role === "admin" && getAdminAccountAccessState(profile) === "active";
}

export function isAdministratorClaim(user) {
  return user?.customClaims?.admin === true
    || String(user?.customClaims?.role || "").trim().toLowerCase() === "admin";
}
