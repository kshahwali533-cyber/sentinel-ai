export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  const { website } = req.body || {};

  if (!website || typeof website !== "string") {
    return res.status(400).json({
      error: "Please provide a website URL."
    });
  }

  let target;

  try {
    target = new URL(website.trim());
  } catch {
    return res.status(400).json({
      error: "Invalid website URL."
    });
  }

  // Sentinel AI currently performs HTTPS security-awareness checks only.
  if (target.protocol !== "https:") {
    return res.status(400).json({
      error:
        "For safety, Sentinel AI currently accepts HTTPS websites only."
    });
  }

  // Basic SSRF protection.
  const hostname = target.hostname.toLowerCase();

  const blockedHosts = [
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "169.254.169.254"
  ];

  if (
    blockedHosts.includes(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost")
  ) {
    return res.status(400).json({
      error:
        "Private or local network addresses cannot be scanned."
    });
  }

  try {
    const response = await fetch(target.href, {
      method: "GET",
      redirect: "follow"
    });

    const headers = response.headers;
    const checks = [];

    /*
      Helper
    */
    function addCheck(name, status, message, fix = "") {
      checks.push({
        name,
        status,
        message,
        fix
      });
    }

    /*
      1. HTTPS
    */
    addCheck(
      "HTTPS",
      "PASS",
      "The website uses HTTPS."
    );

    /*
      2. HSTS
    */
    const hsts = headers.get(
      "strict-transport-security"
    );

    if (hsts) {
      addCheck(
        "HSTS",
        "PASS",
        "HTTP Strict Transport Security is enabled."
      );
    } else {
      addCheck(
        "HSTS",
        "WARNING",
        "HSTS header was not detected.",
        "Enable HSTS on the website."
      );
    }

    /*
      3. Content Security Policy
    */
    const csp = headers.get(
      "content-security-policy"
    );

    if (csp) {
      addCheck(
        "Content Security Policy",
        "PASS",
        "A Content-Security-Policy header was detected."
      );
    } else {
      addCheck(
        "Content Security Policy",
        "WARNING",
        "CSP header was not detected.",
        "Add a Content-Security-Policy header."
      );
    }

    /*
      4. Clickjacking protection
    */
    const xFrame = headers.get(
      "x-frame-options"
    );

    const hasFrameAncestors =
      csp &&
      csp.toLowerCase().includes("frame-ancestors");

    if (xFrame || hasFrameAncestors) {
      addCheck(
        "Clickjacking Protection",
        "PASS",
        "Clickjacking protection was detected."
      );
    } else {
      addCheck(
        "Clickjacking Protection",
        "WARNING",
        "No clear clickjacking protection was detected.",
        "Add X-Frame-Options or CSP frame-ancestors protection."
      );
    }

    /*
      5. X-Content-Type-Options
    */
    const noSniff =
      headers
        .get("x-content-type-options")
        ?.toLowerCase() === "nosniff";

    if (noSniff) {
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

    /*
      6. Referrer Policy
    */
    const referrerPolicy =
      headers.get("referrer-policy");

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
        "Consider adding a Referrer-Policy header."
      );
    }

    /*
      7. Permissions Policy
    */
    const permissionsPolicy =
      headers.get("permissions-policy");

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
        "Consider adding a Permissions-Policy header to control browser features."
      );
    }

    /*
      8. CORS awareness
    */
    const allowOrigin =
      headers.get("access-control-allow-origin");

    if (allowOrigin === "*") {
      addCheck(
        "CORS Policy",
        "WARNING",
        "The response allows requests from any origin.",
        "Review whether wildcard CORS access is necessary."
      );
    } else if (allowOrigin) {
      addCheck(
        "CORS Policy",
        "PASS",
        "A specific CORS origin policy was detected."
      );
    } else {
      addCheck(
        "CORS Policy",
        "INFO",
        "No CORS policy was exposed by the response."
      );
    }

    /*
      9. Server information exposure
    */
    const serverHeader =
      headers.get("server");

    if (serverHeader) {
      addCheck(
        "Server Information Exposure",
        "INFO",
        "The response exposes a Server header.",
        "Consider minimizing unnecessary server or version information."
      );
    } else {
      addCheck(
        "Server Information Exposure",
        "PASS",
        "No Server header was detected."
      );
    }

    /*
      10. Cookie security
    */
    const setCookie =
      headers.get("set-cookie");

    if (!setCookie) {
      addCheck(
        "Cookie Security",
        "INFO",
        "No Set-Cookie header was detected."
      );
    } else {
      const cookie = setCookie.toLowerCase();

      const secure =
        cookie.includes("secure");

      const httpOnly =
        cookie.includes("httponly");

      const sameSite =
        cookie.includes("samesite");

      const missing = [];

      if (!secure) missing.push("Secure");
      if (!httpOnly) missing.push("HttpOnly");
      if (!sameSite) missing.push("SameSite");

      if (missing.length === 0) {
        addCheck(
          "Cookie Security",
          "PASS",
          "Cookie security attributes Secure, HttpOnly and SameSite were detected."
        );
      } else {
        addCheck(
          "Cookie Security",
          "WARNING",
          "Some recommended cookie security attributes were not detected: " +
            missing.join(", ") +
            ".",
          "Review cookies and use appropriate Secure, HttpOnly and SameSite attributes."
        );
      }
    }

    /*
      11. Cache-Control
    */
    const cacheControl =
      headers.get("cache-control");

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
        "No Cache-Control header was detected.",
        "Review caching behavior, especially for sensitive pages."
      );
    }

    /*
      12. Cross-Origin-Opener-Policy
    */
    const coop =
      headers.get("cross-origin-opener-policy");

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
        "Consider COOP where appropriate for isolation and browser security."
      );
    }

    /*
      13. Cross-Origin-Resource-Policy
    */
    const corp =
      headers.get("cross-origin-resource-policy");

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

    /*
      14. Cross-Origin-Embedder-Policy
    */
    const coep =
      headers.get("cross-origin-embedder-policy");

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
        "Consider COEP where appropriate for stronger cross-origin isolation."
      );
    }

    /*
      15. Response status
    */
    if (response.status >= 200 && response.status < 400) {
      addCheck(
        "HTTP Response Status",
        "PASS",
        "The website returned a successful or redirect HTTP response."
      );
    } else {
      addCheck(
        "HTTP Response Status",
        "WARNING",
        "The website returned HTTP status " +
          response.status +
          ".",
        "Review the website response and server configuration."
      );
    }

    /*
      16. HTTPS final destination
    */
    const finalUrl = response.url || target.href;

    try {
      const finalParsed = new URL(finalUrl);

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
    } catch {
      addCheck(
        "Secure Final Destination",
        "INFO",
        "The final destination could not be fully evaluated."
      );
    }

    /*
      Security score
      PASS = full credit
      INFO = half credit
      WARNING = zero credit
    */
    const passCount = checks.filter(
      check => check.status === "PASS"
    ).length;

    const warningCount = checks.filter(
      check => check.status === "WARNING"
    ).length;

    const infoCount = checks.filter(
      check => check.status === "INFO"
    ).length;

    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (
            (
              passCount +
              infoCount * 0.5
            ) /
            checks.length
          ) *
          100
        )
      )
    );

    /*
      Risk level
    */
    let riskLevel = "Low";

    if (score < 80) {
      riskLevel = "Medium";
    }

    if (score < 50) {
      riskLevel = "High";
    }

    /*
      Priority warnings
    */
    const priorityFixes = checks
      .filter(check => check.status === "WARNING")
      .slice(0, 5)
      .map((check, index) => ({
        priority: index + 1,
        title: check.name,
        fix: check.fix || "Review this security setting."
      }));

    /*
      Scan ID
    */
    const randomPart = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    const scanId =
      "SA-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      randomPart;

    /*
      Final response
    */
    return res.status(200).json({
      success: true,

      product: "Sentinel AI",

      website: finalUrl,

      scanId,

      securityScore: score,

      riskLevel,

      summary: {
        totalChecks: checks.length,
        passed: passCount,
        warnings: warningCount,
        informational: infoCount
      },

      priorityFixes,

      checks,

      actionPlan: [
        "Start with the highest-priority warning.",
        "Apply the recommended defensive fix.",
        "Run Sentinel AI again to verify the result."
      ],

      message:
        "Sentinel AI security awareness scan completed."
    });

  } catch (error) {
    console.error("Sentinel AI scan error:", error);

    return res.status(502).json({
      error:
        "Sentinel AI could not reach the requested website."
    });
  }
}
