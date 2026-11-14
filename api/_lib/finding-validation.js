const HEADER_RULES = {
  HSTS: {
    header: "strict-transport-security",
    expected: "Strict-Transport-Security with an appropriate max-age"
  },
  "Content Security Policy": {
    header: "content-security-policy",
    expected: "A site-specific Content-Security-Policy"
  },
  "X-Content-Type-Options": {
    header: "x-content-type-options",
    expected: "X-Content-Type-Options: nosniff"
  },
  "Referrer-Policy": {
    header: "referrer-policy",
    expected: "A restrictive Referrer-Policy suitable for the site"
  },
  "Permissions-Policy": {
    header: "permissions-policy",
    expected: "A policy that disables unneeded browser capabilities"
  },
  "CORS Policy": {
    header: "access-control-allow-origin",
    expected: "Only explicitly trusted cross-origin origins, when required"
  },
  "Server Information Exposure": {
    header: "server",
    expected: "Avoid unnecessary server product and version details"
  },
  "Cache-Control": {
    header: "cache-control",
    expected: "Caching directives appropriate to the response sensitivity"
  },
  "Cross-Origin-Opener-Policy": {
    header: "cross-origin-opener-policy",
    expected: "A COOP policy appropriate to the application's isolation needs"
  },
  "Cross-Origin-Resource-Policy": {
    header: "cross-origin-resource-policy",
    expected: "A CORP policy appropriate to the resources served"
  },
  "Cross-Origin-Embedder-Policy": {
    header: "cross-origin-embedder-policy",
    expected: "A COEP policy appropriate to the application's embedding needs"
  }
};

function readHeader(headers, name) {
  try {
    const value = headers?.get?.(name);
    return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : "Header not present";
  } catch {
    return "Header unavailable";
  }
}

function cookieAttributeSummary(headers) {
  let cookies = [];
  try {
    if (typeof headers?.getSetCookie === "function") cookies = headers.getSetCookie();
  } catch {
    cookies = [];
  }

  if (!cookies.length) return "No Set-Cookie headers were available for attribute inspection.";
  const count = (pattern) => cookies.filter((cookie) => pattern.test(cookie)).length;
  return [
    cookies.length + " cookie(s) observed",
    count(/;\s*secure(?:;|$)/i) + " Secure",
    count(/;\s*httponly(?:;|$)/i) + " HttpOnly",
    count(/;\s*samesite=/i) + " SameSite"
  ].join("; ");
}

/**
 * Attach passive, reproducible response evidence to a security check.
 * This records observations only; it does not claim exploitability or
 * prove that an application-level vulnerability exists.
 */
export function createCheckEvidence({ name, headers, finalTarget, responseStatus, contentType }) {
  if (name === "HTTPS" || name === "Secure Final Destination") {
    const protocol = String(finalTarget?.protocol || "unknown");
    const hostname = String(finalTarget?.hostname || "unknown");
    return {
      source: "Final scan destination",
      signal: "URL scheme and host",
      observed: protocol + "//" + hostname,
      expected: "https:// with a public hostname"
    };
  }

  if (name === "Clickjacking Protection") {
    return {
      source: "HTTP response headers",
      signal: "x-frame-options and content-security-policy frame-ancestors",
      observed: "X-Frame-Options: " + readHeader(headers, "x-frame-options") +
        "; CSP: " + readHeader(headers, "content-security-policy"),
      expected: "X-Frame-Options or a suitable CSP frame-ancestors directive"
    };
  }

  if (name === "Cookie Security") {
    return {
      source: "Set-Cookie response attributes",
      signal: "Secure, HttpOnly and SameSite attributes",
      observed: cookieAttributeSummary(headers),
      expected: "Sensitive cookies should use Secure, HttpOnly where appropriate, and an intentional SameSite policy"
    };
  }

  if (name === "HTTP Response Status") {
    return {
      source: "HTTP response",
      signal: "status code",
      observed: Number.isFinite(Number(responseStatus)) ? String(responseStatus) : "Status unavailable",
      expected: "Interpret the returned status in the context of the requested page"
    };
  }

  if (name === "Content-Type") {
    return {
      source: "HTTP response header",
      signal: "content-type",
      observed: contentType || readHeader(headers, "content-type"),
      expected: "A content type matching the returned resource"
    };
  }

  if (name === "Hostname Configuration") {
    return {
      source: "Final scan destination",
      signal: "hostname",
      observed: String(finalTarget?.hostname || "Hostname unavailable"),
      expected: "A public hostname that matches the intended website"
    };
  }

  const rule = HEADER_RULES[name];
  if (!rule) return null;
  return {
    source: "HTTP response header",
    signal: rule.header,
    observed: readHeader(headers, rule.header),
    expected: rule.expected
  };
}
