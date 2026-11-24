const LEGACY_PRODUCTION_HOSTNAMES = [
  "project-3jyda.vercel.app",
  "project-3jyda-sentinel-ai14.vercel.app",
  "project-3jyda-git-main-sentinel-ai14.vercel.app"
];

export function normalizeRequestHostname(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toLowerCase();
  if (!candidate || candidate.length > 300 || /[\\s,/?#@]/.test(candidate)) {
    return null;
  }

  try {
    const parsed = new URL(`https://${candidate}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" ||
        parsed.search || parsed.hash || (parsed.port && parsed.port !== "443")) {
      return null;
    }
    return parsed.hostname.toLowerCase().replace(/\\.$/, "") || null;
  } catch {
    return null;
  }
}

/**
 * Only a real Vercel Production runtime may enable production browser features.
 * The request Host is an additional exact allowlist check, never the source of
 * deployment-environment truth. Preview and unknown hosts fail closed.
 */
export function isApprovedProductionRequest({ env = process.env, host } = {}) {
  if (env.VERCEL_ENV !== "production") return false;

  const configuredHosts = [
    ...LEGACY_PRODUCTION_HOSTNAMES,
    env.VERCEL_PROJECT_PRODUCTION_URL || "",
    ...(typeof env.SENTINEL_PRODUCTION_HOSTNAMES === "string"
      ? env.SENTINEL_PRODUCTION_HOSTNAMES.split(",")
      : [])
  ];

  const allowed = new Set(
    configuredHosts.map(normalizeRequestHostname).filter(Boolean)
  );
  const requestHost = normalizeRequestHostname(host);
  return Boolean(requestHost && allowed.has(requestHost));
}
