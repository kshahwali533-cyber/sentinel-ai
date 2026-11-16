import net from "node:net";

/**
 * Resolve the client address from Vercel's proxy-populated x-real-ip header.
 * Do not trust x-forwarded-for: callers can supply spoofed values in that list.
 */
export function getTrustedClientIp(headers = {}, remoteAddress) {
  const candidate = typeof headers?.["x-real-ip"] === "string"
    ? headers["x-real-ip"].trim()
    : "";
  if (candidate && net.isIP(candidate)) return candidate;

  const fallback = typeof remoteAddress === "string" ? remoteAddress.trim() : "";
  return fallback && net.isIP(fallback) ? fallback : "unknown";
}
