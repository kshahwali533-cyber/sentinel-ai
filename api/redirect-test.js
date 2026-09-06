export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Only GET requests are allowed."
    });
  }

  const target = req.query?.target;

  if (!target) {
    return res.status(400).json({
      error: "A redirect target is required."
    });
  }

  let targetUrl;

  try {
    targetUrl = new URL(target);
  } catch {
    return res.status(400).json({
      error: "Invalid redirect target."
    });
  }

  // Only HTTPS public URLs are allowed.
  if (targetUrl.protocol !== "https:") {
    return res.status(400).json({
      error: "Only HTTPS redirect targets are allowed."
    });
  }

  const hostname = targetUrl.hostname.toLowerCase();

  // Block known local/internal hostnames.
  const blockedHosts = [
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0"
  ];

  if (
    blockedHosts.includes(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return res.status(403).json({
      error: "Private or internal redirect targets are not allowed."
    });
  }

  // Block private/reserved IPv4 addresses.
  const ipv4 = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );

  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);

    if (parts.some((part) => part > 255)) {
      return res.status(400).json({
        error: "Invalid IPv4 address."
      });
    }

    const [a, b] = parts;

    const isPrivateOrReserved =
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254);

    if (isPrivateOrReserved) {
      return res.status(403).json({
        error: "Private or internal redirect targets are not allowed."
      });
    }
  }

  return res.redirect(302, targetUrl.toString());
}
