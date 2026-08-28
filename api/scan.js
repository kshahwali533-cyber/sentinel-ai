export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  const { website } = req.body || {};

  if (!website) {
    return res.status(400).json({
      error: "Please provide a website URL."
    });
  }

  let url;

  try {
    url = new URL(website);
  } catch {
    return res.status(400).json({
      error: "Invalid website URL."
    });
  }

  if (url.protocol !== "https:") {
    return res.status(400).json({
      error: "For safety, Sentinel AI currently accepts HTTPS websites only."
    });
  }

  const checks = [
    {
      name: "HTTPS",
      status: "PASS",
      message: "The website uses HTTPS."
    },
    {
      name: "Secure connection",
      status: "INFO",
      message: "HTTPS helps protect data while it travels between the visitor and website."
    },
    {
      name: "Security headers",
      status: "INFO",
      message: "A full header analysis will be added in the next scanner version."
    }
  ];

  return res.status(200).json({
    success: true,
    website: url.href,
    product: "Sentinel AI",
    checks,
    message:
      "Security-awareness check completed. This version performs basic checks only."
  });
}
