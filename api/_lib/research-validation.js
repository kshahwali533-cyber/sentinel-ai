export function normalizeResearchText(value, max, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const text = value.trim();
  if ((required && !text) || text.length > max) return null;
  return text;
}

export function isValidResearchId(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function sanitizeResearchAssetUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeResearchEndpointPath(value, assetUrl) {
  if (typeof value !== "string" || value.length > 1024) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || /[\r\n\\]/.test(path)) return null;
  try {
    const base = new URL(assetUrl);
    if (base.protocol !== "https:" || base.username || base.password) return null;
    const target = new URL(path, base);
    if (target.origin !== base.origin || target.protocol !== "https:") return null;
    return target.pathname.slice(0, 1024);
  } catch {
    return null;
  }
}

export function normalizeResearchEvidence(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 10) return null;
  const evidence = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const source = normalizeResearchText(item.source, 120);
    const signal = normalizeResearchText(item.signal, 160);
    const observed = normalizeResearchText(item.observed, 2000);
    const expected = normalizeResearchText(item.expected, 1000);
    if (source === null || signal === null || observed === null || expected === null) return null;
    evidence.push({ source, signal, observed, expected });
  }
  return evidence;
}
