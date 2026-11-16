import net from "node:net";

/**
 * Resolve the client address from Vercel's documented x-real-ip header.
 * Vercel documents this as identical to x-forwarded-for; validate the value
 * and fall back to the socket address if the trusted header is unavailable.
 */
export function getTrustedClientIp(headers = {}, remoteAddress) {
  const candidate = typeof headers?.["x-real-ip"] === "string"
    ? headers["x-real-ip"].trim()
    : "";
  if (candidate && net.isIP(candidate)) return candidate;

  const fallback = typeof remoteAddress === "string" ? remoteAddress.trim() : "";
  return fallback && net.isIP(fallback) ? fallback : "unknown";
}
