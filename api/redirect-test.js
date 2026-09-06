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

  // Controlled redirect test:
  // Only HTTPS public URLs are allowed.
  if (targetUrl.protocol !== "https:") {
    return res.status(400).json({
      error: "Only HTTPS redirect targets are allowed."
    });
  }

  const hostname = targetUrl.hostname.toLowerCase();

  // Block localhost and private/internal destinations.
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

  return res.redirect(302, targetUrl.toString());
}
