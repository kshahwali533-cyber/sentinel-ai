export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        error: "Please provide a valid website URL."
      });
    }

    let target;

    try {
      target = new URL(url);
    } catch {
      return res.status(400).json({
        error: "Invalid URL. Please enter a complete website address."
      });
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return res.status(400).json({
        error: "Only HTTP and HTTPS URLs are supported."
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;

    try {
      response = await fetch(target.toString(), {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "SentinelAI-Security-Awareness-Scanner/1.0"
        }
      });
    } finally {
      clearTimeout(timeout);
    }

    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const finalUrl = response.url || target.toString();
    const finalParsed = new URL(finalUrl);

    const checks = [];

    function addCheck(name, status, message, fix = "") {
      checks.push({
        name,
        status,
        message,
        fix
      });
    }

    // HTTPS
    if (finalParsed.protocol === "https:") {
      addCheck(
        "HTTPS",
        "PASS",
        "The website uses HTTPS."
      );
    } else {
      addCheck(
        "HTTPS",
        "WARNING",
        "The final destination does not use HTTPS.",
        "Enable HTTPS and redirect HTTP traffic to HTTPS."
      );
    }

    // HSTS
    const hsts = headers["strict-transport-security"];

    if (!hsts) {
      addCheck(
        "HSTS",
        "WARNING",
        "HSTS header was not detected.",
        "Enable Strict-Transport-Security with an appropriate max-age value."
      );
    } else {
      const match = hsts.match(/max-age\s*=\s*(\d+)/i);
      const maxAge = match ? Number(match[1]) : 0;

      if (maxAge >= 31536000) {
        addCheck(
          "HSTS",
          "PASS",
          "HSTS is enabled with a strong max-age value."
        );
      } else {
        addCheck(
          "HSTS",
          "INFO",
          "HSTS was detected, but its max-age value is shorter than the recommended baseline.",
          "Review the HSTS max-age value and consider at least 31536000 seconds."
        );
      }
    }

    // Content Security Policy
    const csp = headers["content-security-policy"];

    if (!csp) {
      addCheck(
        "Content Security Policy",
        "WARNING",
        "Content-Security-Policy was not detected.",
        "Add a carefully configured Content-Security-Policy header."
      );
    } else {
      const weakCsp =
        csp.includes("'unsafe-inline'") ||
        csp.includes("'unsafe-eval'");

      if (weakCsp) {
        addCheck(
          "Content Security Policy",
          "INFO",
          "A Content-Security-Policy header was detected, but it contains potentially weaker directives.",
          "Review unsafe-inline and unsafe-eval usage and restrict trusted sources where possible."
        );
      } else {
        addCheck(
          "Content Security Policy",
          "PASS",
          "A Content-Security-Policy header was detected."
        );
      }
    }

    // Clickjacking
    const xFrame = headers["x-frame-options"];
    const frameAncestors =
      csp && /frame-ancestors/i.test(csp);

    if (xFrame || frameAncestors) {
      addCheck(
        "Clickjacking Protection",
        "PASS",
        "Frame protection was detected."
      );
    } else {
      addCheck(
        "Clickjacking Protection",
        "WARNING",
        "No clear clickjacking protection was detected.",
        "Add X-Frame-Options or a CSP frame-ancestors directive."
      );
    }

    // X-Content-Type-Options
    const xContentType =
      headers["x-content-type-options"];

    if (
      xContentType &&
      xContentType.toLowerCase().includes("nosniff")
    ) {
      addCheck(
        "X-Content-Type-Options",
        "PASS",
        "MIME-sniffing protection is enabled."
      );
    } else {
      addCheck(
        "X-Content-Type-Options",
        "WARNING",
        "X-Content-Type-Options: nosniff was not detected.",
        "Add X-Content-Type-Options: nosniff."
      );
    }

    // Referrer Policy
    const referrerPolicy = headers["referrer-policy"];

    if (referrerPolicy) {
      addCheck(
        "Referrer-Policy",
        "PASS",
        "A Referrer-Policy header was detected."
      );
    } else {
      addCheck(
        "Referrer-Policy",
        "INFO",
        "Referrer-Policy header was not detected.",
        "Consider using a restrictive Referrer-Policy."
      );
    }

    // Permissions Policy
    const permissionsPolicy =
      headers["permissions-policy"];

    if (permissionsPolicy) {
      addCheck(
        "Permissions-Policy",
        "PASS",
        "Permissions-Policy was detected."
      );
    } else {
      addCheck(
        "Permissions-Policy",
        "INFO",
        "Permissions-Policy header was not detected.",
        "Consider adding Permissions-Policy to control browser features."
      );
    }

    // CORS
    const cors = headers["access-control-allow-origin"];

    if (cors) {
      addCheck(
        "CORS Policy",
        "INFO",
        `CORS policy exposed: ${cors}`,
        "Review whether the allowed origins are intentionally configured."
      );
    } else {
      addCheck(
        "CORS Policy",
        "INFO",
        "No CORS policy was exposed by the response."
      );
    }

    // Server information
    const server = headers["server"];

    if (server) {
      addCheck(
        "Server Information Exposure",
        "INFO",
        "The response exposes a Server header.",
        "Consider minimizing unnecessary server information."
      );
    } else {
      addCheck(
        "Server Information Exposure",
        "PASS",
        "No Server header was detected."
      );
    }

    // Cookies
    const setCookie = headers["set-cookie"];

    if (setCookie) {
      const cookieText = String(setCookie).toLowerCase();

      const secure = cookieText.includes("secure");
      const httpOnly = cookieText.includes("httponly");
      const sameSite = cookieText.includes("samesite");

      const missing = [];

      if (!secure) missing.push("Secure");
      if (!httpOnly) missing.push("HttpOnly");
      if (!sameSite) missing.push("SameSite");

      if (missing.length === 0) {
        addCheck(
          "Cookie Security",
          "PASS",
          "Detected cookies include recommended security attributes."
        );
      } else {
        addCheck(
          "Cookie Security",
          "WARNING",
          `Some recommended cookie security attributes were not detected: ${missing.join(", ")}.`,
          "Review cookies and use appropriate Secure, HttpOnly and SameSite attributes."
        );
      }
    } else {
      addCheck(
        "Cookie Security",
        "INFO",
        "No Set-Cookie header was detected."
      );
    }

    // Cache-Control
    const cacheControl = headers["cache-control"];

    if (cacheControl) {
      addCheck(
        "Cache-Control",
        "PASS",
        "A Cache-Control policy was detected."
      );
    } else {
      addCheck(
        "Cache-Control",
        "INFO",
        "Cache-Control header was not detected.",
        "Consider an appropriate caching policy for your application."
      );
    }

    // Cross-Origin isolation
    const coop = headers["cross-origin-opener-policy"];

    if (coop) {
      addCheck(
        "Cross-Origin-Opener-Policy",
        "PASS",
        "Cross-Origin-Opener-Policy was detected."
      );
    } else {
      addCheck(
        "Cross-Origin-Opener-Policy",
        "INFO",
        "Cross-Origin-Opener-Policy was not detected.",
        "Consider COOP where appropriate for stronger browser isolation."
      );
    }

    const corp = headers["cross-origin-resource-policy"];

    if (corp) {
      addCheck(
        "Cross-Origin-Resource-Policy",
        "PASS",
        "Cross-Origin-Resource-Policy was detected."
      );
    } else {
      addCheck(
        "Cross-Origin-Resource-Policy",
        "INFO",
        "Cross-Origin-Resource-Policy was not detected.",
        "Consider CORP where appropriate for cross-origin resource protection."
      );
    }

    const coep = headers["cross-origin-embedder-policy"];

    if (coep) {
      addCheck(
        "Cross-Origin-Embedder-Policy",
        "PASS",
        "Cross-Origin-Embedder-Policy was detected."
      );
    } else {
      addCheck(
        "Cross-Origin-Embedder-Policy",
        "INFO",
        "Cross-Origin-Embedder-Policy was not detected.",
        "Consider COEP when your application requires stronger cross-origin isolation."
      );
    }

    // HTTP status
    // IMPORTANT:
    // 4xx/5xx responses are reported as INFO rather than automatically
    // treated as a security vulnerability.
    if (response.status >= 200 && response.status < 400) {
      addCheck(
        "HTTP Response Status",
        "PASS",
        `The website returned HTTP status ${response.status}.`
      );
    } else if (response.status >= 400 && response.status < 500) {
      addCheck(
        "HTTP Response Status",
        "INFO",
        `The website returned HTTP status ${response.status}.`,
        "Review the response and access configuration if this status is unexpected."
      );
    } else if (response.status >= 500) {
      addCheck(
        "HTTP Response Status",
        "INFO",
        `The website returned HTTP status ${response.status}.`,
        "A server-side response error was observed. Review server availability and configuration if unexpected."
      );
    }

    // Final destination
    if (finalParsed.protocol === "https:") {
      addCheck(
        "Secure Final Destination",
        "PASS",
        "The final response destination uses HTTPS."
      );
    } else {
      addCheck(
        "Secure Final Destination",
        "WARNING",
        "The final response destination does not use HTTPS.",
        "Ensure redirects end at an HTTPS destination."
      );
    }

    // Content type
    const contentType =
      headers["content-type"] || "";

    if (contentType.toLowerCase().includes("text/html")) {
      addCheck(
        "Content-Type",
        "PASS",
        "The response identifies itself as HTML content."
      );
    } else {
      addCheck(
        "Content-Type",
        "INFO",
        `The response Content-Type is ${contentType || "not specified"}.`
      );
    }

    // Hostname
    if (finalParsed.hostname) {
      addCheck(
        "Hostname Configuration",
        "PASS",
        "A public hostname was provided for the security check."
      );
    }

    // security.txt
    let securityTxt = false;

    try {
      const securityTxtUrl =
        `${finalParsed.origin}/.well-known/security.txt`;

      const securityResponse = await fetch(
        securityTxtUrl,
        {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "SentinelAI-Security-Awareness-Scanner/1.0"
          }
        }
      );

      securityTxt = securityResponse.ok;
    } catch {
      securityTxt = false;
    }

    if (securityTxt) {
      addCheck(
        "Security.txt",
        "PASS",
        "A /.well-known/security.txt resource was detected."
      );
    } else {
      addCheck(
        "Security.txt",
        "INFO",
        "Security.txt could not be confirmed.",
        "Consider publishing /.well-known/security.txt with security contact information."
      );
    }

    // robots.txt
    let robots = false;

    try {
      const robotsUrl =
        `${finalParsed.origin}/robots.txt`;

      const robotsResponse = await fetch(
        robotsUrl,
        {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "SentinelAI-Security-Awareness-Scanner/1.0"
          }
        }
      );

      robots = robotsResponse.ok;
    } catch {
      robots = false;
    }

    if (robots) {
      addCheck(
        "Robots.txt",
        "PASS",
        "A robots.txt resource was detected."
      );
    } else {
      addCheck(
        "Robots.txt",
        "INFO",
        "Robots.txt availability could not be confirmed."
      );
    }

    // Score
    let score = 100;

    for (const check of checks) {
      if (check.status === "WARNING") {
        score -= 8;
      } else if (check.status === "INFO") {
        score -= 2;
      }
    }

    score = Math.max(0, Math.min(100, score));

    let riskLevel = "Low";

    if (score < 60) {
      riskLevel = "High";
    } else if (score < 80) {
      riskLevel = "Medium";
    }

    const passed = checks.filter(
      c => c.status === "PASS"
    ).length;

    const warnings = checks.filter(
      c => c.status === "WARNING"
    ).length;

    const informational = checks.filter(
      c => c.status === "INFO"
    ).length;

    const scanId =
      `SA-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return res.status(200).json({
      success: true,
      scanId,
      website: target.toString(),
      finalUrl,
      score,
      riskLevel,
      summary: {
        total: checks.length,
        passed,
        warnings,
        informational
      },
      checks,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Sentinel AI scan error:", error);

    return res.status(500).json({
      error: "Unable to complete the security-awareness scan.",
      details:
        error?.name === "AbortError"
          ? "The target website took too long to respond."
          : "The target website could not be checked."
    });
  }
}
