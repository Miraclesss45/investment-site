const PACKAGE_CACHE_TTL_MS = 30_000;
let packageCache = null;
let packageCacheExpiresAt = 0;
let packageRequest = null;

export function getInvestmentPackages({ forceRefresh = false } = {}) {
  if (!forceRefresh && packageCache && Date.now() < packageCacheExpiresAt) {
    return Promise.resolve(packageCache);
  }
  if (!forceRefresh && packageRequest) return packageRequest;

  let request;
  request = fetch("/api/packages")
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Investment packages are temporarily unavailable.");
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (packageRequest === request) {
        packageCache = items;
        packageCacheExpiresAt = Date.now() + PACKAGE_CACHE_TTL_MS;
      }
      return items;
    })
    .finally(() => {
      if (packageRequest === request) packageRequest = null;
    });
  packageRequest = request;
  return request;
}
