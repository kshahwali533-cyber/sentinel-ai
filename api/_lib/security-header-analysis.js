/**
 * Conservative validation for anti-framing response headers.
 * Presence alone is not enough: invalid X-Frame-Options values and empty
 * CSP frame-ancestors directives must not be reported as protection.
 */
export function hasValidFrameProtection({
  xFrameOptions = "",
  contentSecurityPolicy = ""
} = {}) {
  const xfo = typeof xFrameOptions === "string"
    ? xFrameOptions.trim().toLowerCase()
    : "";

  if (xfo === "deny" || xfo === "sameorigin") {
    return true;
  }

  if (typeof contentSecurityPolicy !== "string" || !contentSecurityPolicy.trim()) {
    return false;
  }

  const directives = contentSecurityPolicy
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);

  for (const directive of directives) {
    const match = directive.match(/^frame-ancestors(?:\s+(.+))?$/i);
    if (!match || !match[1]) continue;

    const sources = match[1].trim().split(/\s+/).filter(Boolean);
    if (!sources.length) continue;

    // 'none' is only meaningful as the sole source expression.
    if (sources.some(source => /^'none'$/i.test(source)) && sources.length !== 1) {
      continue;
    }

    return true;
  }

  return false;
}
