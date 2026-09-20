const ADMIN_SESSION_KEY = "meridianvest_admin_login";

export function hasAdminLoginSession() {
  return false;
}

export function setAdminLoginSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function clearAdminLoginSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
