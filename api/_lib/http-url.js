/**
 * Parse a URL for scanner discovery and accept only HTTP(S) destinations.
 * Reject executable and non-web schemes before recording a discovered link.
 */
export function parseHttpUrl(value, base) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const parsed = new URL(value.trim(), base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}
