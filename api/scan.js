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

    // HTTPS
    checks.push({
      name: "HTTPS",
      status: "PASS",
      message: "The website uses HTTPS."
    });

    // HSTS
    const hasHSTS = headers.has("strict-transport-security");

    checks.push({
      name: "HSTS",
      status: hasHSTS ? "PASS" : "WARNING",
      message: hasHSTS
        ? "HTTP Strict Transport Security is enabled."
        : "HSTS header was not detected.",
      fix: hasHSTS
        ? ""
        : "Enable HSTS on the website."
    });

    // Content Security Policy
    const hasCSP = headers.has("content-security-policy");

    checks.push({
      name: "Content Security Policy",
      status: hasCSP ? "PASS" : "WARNING",
      message: hasCSP
        ? "CSP header was detected."
        : "CSP header was not detected.",
      fix: hasCSP
        ? ""
        : "Add a Content-Security-Policy header."
    });

    // X-Frame-Options
    const hasFrameProtection =
      headers.has("x-frame-options") ||
      headers.has("content-security-policy");

    checks.push({
      name: "Clickjacking Protection",
      status: hasFrameProtection ? "PASS" : "WARNING",
      message: hasFrameProtection
        ? "Clickjacking protection was detected."
        : "No clear clickjacking protection was detected.",
      fix: hasFrameProtection
        ? ""
        : "Add X-Frame-Options or CSP frame-ancestors protection."
    });

    // X-Content-Type-Options
    const hasNoSniff =
      headers.get("x-content-type-options")?.toLowerCase() === "nosniff";

    checks.push({
      name: "X-Content-Type-Options",
      status: hasNoSniff ? "PASS" : "WARNING",
      message: hasNoSniff
        ? "MIME-sniffing protection is enabled."
        : "X-Content-Type-Options: nosniff was not detected.",
      fix: hasNoSniff
        ? ""
        : "Add X-Content-Type-Options: nosniff."
    });

    // Referrer-Policy
    const hasReferrerPolicy = headers.has("referrer-policy");

    checks.push({
      name: "Referrer-Policy",
      status: hasReferrerPolicy ? "PASS" : "INFO",
      message: hasReferrerPolicy
        ? "A Referrer-Policy header was detected."
        : "Referrer-Policy header was not detected.",
      fix: hasReferrerPolicy
        ? ""
        : "Consider adding a Referrer-Policy header."
    });

    // Permissions-Policy
    const hasPermissionsPolicy =
      headers.has("permissions-policy");

    checks.push({
      name: "Permissions-Policy",
      status: hasPermissionsPolicy ? "PASS" : "INFO",
      message: hasPermissionsPolicy
        ? "Permissions-Policy was detected."
        : "Permissions-Policy header was not detected.",
      fix: hasPermissionsPolicy
        ? ""
        : "Consider adding a Permissions-Policy header to control browser features."
    });

    // CORS awareness
    const accessControlOrigin =
      headers.get("access-control-allow-origin");

    let corsStatus = "INFO";
    let corsMessage = "No CORS policy was exposed by the response.";
    let corsFix = "";

    if (accessControlOrigin === "*") {
      corsStatus = "WARNING";
      corsMessage =
        "The response allows requests from any origin with Access-Control-Allow-Origin: *.";
      corsFix =
        "Review whether wildcard CORS access is necessary.";
    } else if (accessControlOrigin) {
      corsStatus = "PASS";
      corsMessage =
        "A specific CORS origin policy was detected.";
    }

    checks.push({
      name: "CORS Policy",
      status: corsStatus,
      message: corsMessage,
      fix: corsFix
    });

    // Server information exposure
    const serverHeader = headers.get("server");

    checks.push({
      name: "Server Information Exposure",
      status: serverHeader ? "INFO" : "PASS",
      message: serverHeader
        ? "The response exposes a Server header."
        : "No Server header was detected.",
      fix: serverHeader
        ? "Consider minimizing unnecessary server/version information."
        : ""
    });

    // Cookie security awareness
    const setCookie = headers.get("set-cookie");

    let cookieStatus = "INFO";
    let cookieMessage = "No Set-Cookie header was detected.";
    let cookieFix = "";

    if (setCookie) {
      const cookieLower = setCookie.toLowerCase();

      const hasSecure = cookieLower.includes("secure");
      const hasHttpOnly = cookieLower.includes("httponly");
      const hasSameSite = cookieLower.includes("samesite");

      if (hasSecure && hasHttpOnly && hasSameSite) {
        cookieStatus = "PASS";
        cookieMessage =
          "Cookie security attributes Secure, HttpOnly and SameSite were detected.";
      } else {
        cookieStatus = "WARNING";

        const missing = [];

        if (!hasSecure) missing.push("Secure");
        if (!hasHttpOnly) missing.push("HttpOnly");
        if (!hasSameSite) missing.push("SameSite");

        cookieMessage =
          "Some recommended cookie security attributes were not detected: " +
          missing.join(", ") +
          ".";

        cookieFix =
          "Review cookies and use appropriate Secure, HttpOnly and SameSite attributes.";
      }
    }

    checks.push({
      name: "Cookie Security",
      status: cookieStatus,
      message: cookieMessage,
      fix: cookieFix
    });

    // Calculate score
    const passCount = checks.filter(
      check => check.status === "PASS"
    ).length;

    const warningCount = checks.filter(
      check => check.status === "WARNING"
    ).length;

    const score = Math.max(
      0,
      Math.round(
        ((passCount + (checks.length - passCount - warningCount) * 0.5) /
          checks.length) *
          100
      )
    );

    // Risk level
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
      summary: {
        totalChecks: checks.length,
        passed: passCount,
        warnings: warningCount
      },
      checks,
      message:
        "Sentinel AI security awareness scan completed."
    });

  } catch (error) {
    return res.status(502).json({
      error:
        "Sentinel AI could not reach the requested website."
    });
  }
}
