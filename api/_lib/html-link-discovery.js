/**
 * Extract real anchor hrefs from HTML without treating markup embedded in
 * JavaScript/CSS templates or comments as live document links.
 */
export function extractHTMLLinks(html) {
  if (typeof html !== "string" || !html) return [];

  const documentMarkup = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ");

  const links = [];
  const matches = documentMarkup.matchAll(
    /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi
  );

  for (const match of matches) {
    const href = (match[1] ?? match[2] ?? "").trim();
    if (href) links.push(href);
  }

  return links;
}
