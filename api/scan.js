export default async function handler(req, res) {
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

  try {
    const response = await fetch(url.href, {
      method: "GET",
      redirect: "follow"
    });

    const headers = response.headers;

    const checks = [];

    checks.push({
      name: "HTTPS",
      status: "PASS",
      message: "The website uses HTTPS."
    });

    checks.push({
      name: "HSTS",
      status: headers.has("strict-transport-security")
        ? "PASS"
        : "WARNING",
      message: headers.has("strict-transport-security")
        ? "HTTP Strict Transport Security is enabled."
        : "HSTS header was not detected.",
      fix: headers.has("strict-transport-security")
        ? ""
        : "Enable HSTS on the website."
    });

    checks.push({
      name: "Content Security Policy",
      status: headers.has("content-security-policy")
        ? "PASS"
        : "WARNING",
      message: headers.has("content-security-policy")
        ? "CSP header was detected."
        : "CSP header was not detected.",
      fix: headers.has("content-security-policy")
        ? ""
        : "Add a Content-Security-Policy header."
    });

    checks.push({
      name: "X-Frame-Options",
      status: headers.has("x-frame-options")
        ? "PASS"
        : "WARNING",
      message: headers.has("x-frame-options")
        ? "Clickjacking protection header was detected."
        : "X-Frame-Options header was not detected.",
      fix: headers.has("x-frame-options")
        ? ""
        : "Add X-Frame-Options protection."
    });

    checks.push({
      name: "X-Content-Type-Options",
      status: headers.has("x-content-type-options")
        ? "PASS"
        : "WARNING",
      message: headers.has("x-content-type-options")
        ? "MIME-sniffing protection is enabled."
        : "X-Content-Type-Options header was not detected.",
      fix: headers.has("x-content-type-options")
        ? ""
        : "Add X-Content-Type-Options: nosniff."
    });

    checks.push({
      name: "Referrer-Policy",
      status: headers.has("referrer-policy")
        ? "PASS"
        : "INFO",
      message: headers.has("referrer-policy")
        ? "A Referrer-Policy header was detected."
        : "Referrer-Policy header was not detected.",
      fix: headers.has("referrer-policy")
        ? ""
        : "Consider adding a Referrer-Policy header."
    });

    const passed = checks.filter(
      check => check.status === "PASS"
    ).length;

    const score = Math.round(
      (passed / checks.length) * 100
    );

    let riskLevel = "Low";

    if (score < 80) {
      riskLevel = "Medium";
    }

    if (score < 50) {
      riskLevel = "High";
    }

    return res.status(200).json({
      success: true,
      website: response.url,
      product: "Sentinel AI",
      securityScore: score,
      riskLevel,
      checks,
      message:
        "Security header awareness check completed."
    });

  } catch (error) {
    return res.status(502).json({
      error:
        "Sentinel AI could not reach the requested website."
    });
  }
}
