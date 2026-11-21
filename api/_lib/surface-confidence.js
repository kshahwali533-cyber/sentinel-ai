/**
 * Common-path probes can receive HTTP 200 from soft-404 or catch-all routes.
 * A URL appearing in page markup proves only that a link was published.
 * It does not prove the route exists or is sensitive. Only the exact page
 * submitted for scanning may produce a path-based surface indicator.
 */
export function isConfirmedSurfaceReference(resource) {
  if (!resource || typeof resource.url !== "string" || !resource.url.trim()) {
    return false;
  }

  return resource.source === "scan-target";
}
