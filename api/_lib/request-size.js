/**
 * Bound the serialized JSON payload before API-specific validation or work.
 * Vercel's request parser has already decoded req.body at this point; this
 * guard limits downstream processing and upstream AI/database amplification.
 */
export function isWithinJsonBodyLimit(value, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return false;

  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string") return false;
    return Buffer.byteLength(serialized, "utf8") <= maxBytes;
  } catch {
    return false;
  }
}
