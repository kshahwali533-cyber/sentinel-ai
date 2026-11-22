function stripHtmlComments(source) {
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const commentStart = source.indexOf("<!--", cursor);
    if (commentStart === -1) {
      output += source.slice(cursor);
      break;
    }

    output += source.slice(cursor, commentStart);
    const commentEnd = source.indexOf("-->", commentStart + 4);
    if (commentEnd === -1) break;
    cursor = commentEnd + 3;
  }

  return output;
}

export function extractVerificationMetaToken(html) {
  if (typeof html !== "string" || html.length > 65536) return null;
  const source = stripHtmlComments(html);
  const matches = [];

  for (const tag of source.matchAll(/<meta\\b[^>]*>/gi)) {
    const attributes = new Map();
    const raw = tag[0].slice(5, -1);
    const pattern = /([^\\s=/>]+)(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?/g;
    for (const attribute of raw.matchAll(pattern)) {
      const name = attribute[1].toLowerCase();
      if (attributes.has(name)) {
        attributes.set(name, null);
        continue;
      }
      attributes.set(name, attribute[2] ?? attribute[3] ?? attribute[4] ?? "");
    }
    if ((attributes.get("name") || "").toLowerCase() === "sentinel-ai-verification") {
      matches.push(attributes.get("content"));
    }
  }

  return matches.length === 1 && typeof matches[0] === "string"
    ? matches[0].trim()
    : null;
}

export function chooseOwnershipVerificationMethod({ dnsVerified = false, fileVerified = false, metaVerified = false } = {}) {
  if (dnsVerified) return "DNS TXT";
  if (fileVerified) return "HTTPS file";
  if (metaVerified) return "HTML meta tag";
  return null;
}
