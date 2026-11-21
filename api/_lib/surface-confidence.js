/**
 * Common-path probes can receive HTTP 200 from soft-404 or catch-all routes.
 * Only page references or the exact requested scan target count as
 * confirmed surface references; guessed paths remain unverified candidates.
 */
export function isConfirmedSurfaceReference(resource) {
  if (!resource || typeof resource.url !== "string" || !resource.url.trim()) {
    return false;
  }

  return resource.source === "scan-target" || resource.source === "html-link";
}
