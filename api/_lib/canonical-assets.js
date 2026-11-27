function canonicalOrigin(env) {
  const configuredCanonicalHost = typeof env?.SENTINEL_CANONICAL_HOSTNAME === "string"
    ? env.SENTINEL_CANONICAL_HOSTNAME.trim()
    : "";
  const productionHost = typeof env?.VERCEL_PROJECT_PRODUCTION_URL === "string"
    ? env.VERCEL_PROJECT_PRODUCTION_URL.trim()
    : "";
  const raw = (configuredCanonicalHost || productionHost).toLowerCase();
  const host = raw.endsWith(".") ? raw.slice(0, -1) : raw;
  const labels = host.split(".");
  const validLabels = labels.length >= 2 && labels.every((label) =>
    label.length >= 1 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
  const validTld = /^[a-z]{2,63}$/.test(labels.at(-1) || "");
  if (!validLabels || !validTld || host.length > 253) return null;
  return "https://" + host;
}

export function renderCanonicalAsset(resource, env = process.env) {
  const origin = canonicalOrigin(env);
  if (!origin) return null;

  if (resource === "robots") {
    return {
      contentType: "text/plain; charset=utf-8",
      body: "User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: " + origin + "/sitemap.xml\n"
    };
  }

  if (resource === "sitemap") {
    return {
      contentType: "application/xml; charset=utf-8",
      body: '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "  <url><loc>" + origin + "/</loc></url>\n" +
        "</urlset>\n"
    };
  }

  if (resource === "security") {
    return {
      contentType: "text/plain; charset=utf-8",
      body: [
        "Contact: mailto:securitysentinelai093@gmail.com",
        "Expires: " + new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        "Preferred-Languages: en, ur",
        "Canonical: " + origin + "/.well-known/security.txt",
        ""
      ].join("\n")
    };
  }

  return null;
}
