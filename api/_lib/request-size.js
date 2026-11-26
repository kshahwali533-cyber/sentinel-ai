/** Bound serialized JSON payloads before downstream API work. */
export function isWithinJsonBodyLimit(value, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return false;
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" && Buffer.byteLength(serialized, "utf8") <= maxBytes;
  } catch {
    return false;
  }
}
