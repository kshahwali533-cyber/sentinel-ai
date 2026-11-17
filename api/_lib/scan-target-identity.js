/**
 * Prevent a security scan from attributing a third-party redirect response
 * to the hostname the user originally submitted. Only the exact host and
 * its www/non-www canonical pair are treated as the same site here.
 */
export function isSameSiteRedirectHost(originalHostname, finalHostname) {
  const normalize = value => {
    if (typeof value !== "string") return "";
    let host = value.trim().toLowerCase().replace(/\.$/, "");
    if (host.startsWith("[") && host.endsWith("]")) {
      host = host.slice(1, -1);
    }
    return host;
  };

  const original = normalize(originalHostname);
  const final = normalize(finalHostname);
  if (!original || !final) return false;
  if (original === final) return true;

  const originalBase = original.startsWith("www.") ? original.slice(4) : original;
  const finalBase = final.startsWith("www.") ? final.slice(4) : final;
  return originalBase === finalBase;
}
