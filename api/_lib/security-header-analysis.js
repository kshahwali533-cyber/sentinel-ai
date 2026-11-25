/**
 * Conservative validation for anti-framing response headers.
 * Presence alone is not enough: invalid X-Frame-Options values and malformed
 * or empty CSP frame-ancestors directives must not be reported as protection.
 */

function isValidFrameAncestorSource(source) {
  if (/^(?:\*|'self'|'none')$/i.test(source)) return true;
  if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return true;

  // CSP host-source: optional scheme, optional wildcard subdomain, host,
  // optional port, and optional path. Deliberately reject unknown keywords.
  const hostPattern = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:\*|\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*\.?(?::(?:\*|[0-9]{1,5}))?(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?$/i;
  const ipv6Pattern = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\[[0-9a-f:.]+\](?::(?:\*|[0-9]{1,5}))?(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?$/i;

  if (!hostPattern.test(source) && !ipv6Pattern.test(source)) return false;

  const portMatch = source.match(/:(\d{1,5})(?:\/|$)/);
  return !portMatch || Number(portMatch[1]) <= 65535;
}

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

  // CSP duplicate directives are ignored after the first occurrence.
  const directive = directives.find(item => /^frame-ancestors(?:\s|$)/i.test(item));
  if (!directive) return false;

  const match = directive.match(/^frame-ancestors(?:\s+(.+))?$/i);
  if (!match?.[1]) return false;

  const sources = match[1].trim().split(/\s+/).filter(Boolean);
  if (!sources.length) return false;

  // 'none' is only meaningful as the sole source expression.
  if (sources.some(source => /^'none'$/i.test(source)) && sources.length !== 1) {
    return false;
  }

  return sources.every(isValidFrameAncestorSource);
}

const REFERRER_POLICIES = new Set([
  "no-referrer",
  "no-referrer-when-downgrade",
  "origin",
  "origin-when-cross-origin",
  "same-origin",
  "strict-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url"
]);

export function hasRecognizedReferrerPolicy(value) {
  return typeof value === "string" &&
    value.split(",").some(item => REFERRER_POLICIES.has(item.trim().toLowerCase()));
}

export function hasRecognizedCrossOriginPolicy(value, kind) {
  if (typeof value !== "string") return false;
  const allowed = {
    coop: ["unsafe-none", "same-origin-allow-popups", "same-origin", "noopener-allow-popups"],
    corp: ["same-site", "same-origin", "cross-origin"],
    coep: ["unsafe-none", "require-corp", "credentialless"]
  };
  return (allowed[kind] || []).includes(value.trim().toLowerCase());
}
