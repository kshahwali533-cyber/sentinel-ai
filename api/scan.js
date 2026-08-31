export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Only POST requests are allowed."
    });
  }

  const { website } = req.body || {};

  if (!website || typeof website !== "string") {
    return res.status(400).json({
      success: false,
      error: "Please provide a website URL."
    });
  }

  let target;

  try {
    target = new URL(website.trim());
  } catch {
    return res.status(400).json({
      success: false,
      error: "Invalid website URL."
    });
  }

  if (target.protocol !== "https:") {
    return res.status(400).json({
      success: false,
      error: "For safety, Sentinel AI currently accepts HTTPS websites only."
    });
  }

  const hostname = target.hostname.toLowerCase();

  const blockedHosts = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1"
  ];

  if (
    blockedHosts.includes(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return res.status(400).json({
      success: false,
      error: "Local or private network targets are not allowed."
    });
  }

  const checks = [];

  function addCheck(name, status, message, fix = "") {
    checks.push({
      name,
      status,
      message,
      fix
    });
  }

  try {
    const response = await fetch(target.href, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "SentinelAI-SecurityScanner/4.0"
      }
    });

    const headers = response.headers;

    // --------------------------------------------------
    // 1. HTTPS
    // --------------------------------------------------

    addCheck(
      "HTTPS",
      "PASS",
      "The website uses HTTPS."
    );

    // --------------------------------------------------
    // 2. HSTS
    // --------------------------------------------------

    const hsts = headers.get("strict-transport-security");

    if (hsts) {
      const maxAgeMatch = hsts.match(/max-age\s*=\s*(\d+)/i);
      const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 0;

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
    } else {
      addCheck(
        "HSTS",
        "WARNING",
        "HSTS header was not detected.",
        "Enable Strict-Transport-Security with an appropriate max-age value."
      );
    }

    // --------------------------------------------------
    // 3. Content Security Policy
    // --------------------------------------------------

    const csp = headers.get("content-security-policy");

    if (csp) {
      const hasUnsafeInline = /'unsafe-inline'/i.test(csp);
      const hasUnsafeEval = /'unsafe-eval'/i.test(csp);

      if (hasUnsafeInline || hasUnsafeEval) {
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
    } else {
      addCheck(
        "Content Security Policy",
        "WARNING",
        "Content-Security-Policy was not detected.",
        "Add a carefully configured Content-Security-Policy header."
      );
    }

    // --------------------------------------------------
    // 4. Clickjacking Protection
    // --------------------------------------------------

    const xFrame = headers.get("x-frame-options");

    const hasFrameAncestors =
      csp && /frame-ancestors\s+/i.test(csp);

    if (xFrame || hasFrameAncestors) {
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

    // --------------------------------------------------
    // 5. X-Content-Type-Options
    // --------------------------------------------------

    const noSniff = headers.get("x-content-type-options");

    if (
      noSniff &&
      noSniff.toLowerCase().includes("nosniff")
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

    // --------------------------------------------------
    // 6. Referrer Policy
    // --------------------------------------------------

    const referrerPolicy =
      headers.get("referrer-policy");

    if (referrerPolicy) {
      const policy = referrerPolicy.toLowerCase();

      const strongPolicies = [
        "no-referrer",
        "strict-origin",
        "strict-origin-when-cross-origin"
      ];

      if (
        strongPolicies.some(value =>
          policy.includes(value)
        )
      ) {
        addCheck(
          "Referrer-Policy",
          "PASS",
          "A restrictive Referrer-Policy was detected."
        );
      } else {
        addCheck(
          "Referrer-Policy",
          "INFO",
          "A Referrer-Policy header was detected.",
          "Review the policy and consider a restrictive value."
        );
      }
    } else {
      addCheck(
        "Referrer-Policy",
        "INFO",
        "Referrer-Policy header was not detected.",
        "Consider using a restrictive Referrer-Policy."
      );
    }

    // --------------------------------------------------
    // 7. Permissions Policy
    // --------------------------------------------------

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
        "Consider adding Permissions-Policy to control browser features."
      );
    }

    // --------------------------------------------------
    // 8. CORS
    // --------------------------------------------------

    const cors =
      headers.get("access-control-allow-origin");

    const allowCredentials =
      headers.get("access-control-allow-credentials");

    if (cors === "*") {
      if (
        allowCredentials &&
        allowCredentials.toLowerCase() === "true"
      ) {
        addCheck(
          "CORS Policy",
          "WARNING",
          "Wildcard CORS was detected together with credential support.",
          "Restrict allowed origins and review credential handling."
        );
      } else {
        addCheck(
          "CORS Policy",
          "INFO",
          "The response allows requests from any origin.",
          "Review whether wildcard CORS access is actually required."
        );
      }
    } else if (cors) {
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

    // --------------------------------------------------
    // 9. Server Information Exposure
    // --------------------------------------------------

    const server = headers.get("server");

    if (server) {
      const versionPattern =
        /\/\d+(?:\.\d+)+|version\s*[:=]?\s*\d+/i;

      if (versionPattern.test(server)) {
        addCheck(
          "Server Information Exposure",
          "WARNING",
          "The Server header appears to expose software version information.",
          "Consider minimizing unnecessary server and version information."
        );
      } else {
        addCheck(
          "Server Information Exposure",
          "INFO",
          "The response exposes a Server header.",
          "Consider minimizing unnecessary server information."
        );
      }
    } else {
      addCheck(
        "Server Information Exposure",
        "PASS",
        "No Server header was detected."
      );
    }

    // --------------------------------------------------
    // 10. Cookie Security
    // --------------------------------------------------

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

      const hasSecure =
        /;\s*secure\b/i.test(cookie);

      const hasHttpOnly =
        /;\s*httponly\b/i.test(cookie);

      const hasSameSite =
        /;\s*samesite=/i.test(cookie);

      const missing = [];

      if (!hasSecure) missing.push("Secure");
      if (!hasHttpOnly) missing.push("HttpOnly");
      if (!hasSameSite) missing.push("SameSite");

      if (missing.length === 0) {
        addCheck(
          "Cookie Security",
          "PASS",
          "Recommended Secure, HttpOnly and SameSite attributes were detected."
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

    // --------------------------------------------------
    // 11. Cache-Control
    // --------------------------------------------------

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
        "Review caching rules, especially for sensitive or authenticated content."
      );
    }

    // --------------------------------------------------
    // 12. COOP
    // --------------------------------------------------

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
        "Consider COOP where appropriate for stronger browser isolation."
      );
    }

    // --------------------------------------------------
    // 13. CORP
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 14. COEP
    // --------------------------------------------------

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
        "Consider COEP when your application requires stronger cross-origin isolation."
      );
    }

    // --------------------------------------------------
    // 15. HTTP Response Status
    // --------------------------------------------------

    if (response.status >= 200 && response.status < 400) {
      addCheck(
        "HTTP Response Status",
        "PASS",
        `The website returned HTTP status ${response.status}.`
      );
    } else {
      addCheck(
        "HTTP Response Status",
        "WARNING",
        `The website returned HTTP status ${response.status}.`,
        "Review the HTTP response and redirect configuration."
      );
    }

    // --------------------------------------------------
    // 16. Secure Final Destination
    // --------------------------------------------------

    try {
      const finalUrl =
        new URL(response.url);

      if (finalUrl.protocol === "https:") {
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
          "Ensure redirects ultimately lead to an HTTPS destination."
        );
      }
    } catch {
      addCheck(
        "Secure Final Destination",
        "INFO",
        "The final destination could not be evaluated."
      );
    }

    // --------------------------------------------------
    // 17. Content-Type
    // --------------------------------------------------

    const contentType =
      headers.get("content-type");

    if (
      contentType &&
      contentType.toLowerCase().includes("text/html")
    ) {
      addCheck(
        "Content-Type",
        "PASS",
        "The response identifies itself as HTML content."
      );
    } else if (contentType) {
      addCheck(
        "Content-Type",
        "INFO",
        "The response Content-Type is " +
          contentType +
          "."
      );
    } else {
      addCheck(
        "Content-Type",
        "INFO",
        "No Content-Type header was detected.",
        "Configure an appropriate Content-Type response header."
      );
    }

    // --------------------------------------------------
    // 18. Hostname Configuration
    // --------------------------------------------------

    if (hostname.includes(".")) {
      addCheck(
        "Hostname Configuration",
        "PASS",
        "A public hostname was provided for the security check."
      );
    } else {
      addCheck(
        "Hostname Configuration",
        "INFO",
        "The hostname format could not be classified as a typical public domain."
      );
    }

    // --------------------------------------------------
    // 19. Security.txt
    // --------------------------------------------------

    let securityTxtStatus = "INFO";

    let securityTxtMessage =
      "Security.txt could not be confirmed.";

    let securityTxtFix =
      "Consider publishing /.well-known/security.txt with security contact information.";

    try {
      const securityTxtUrl =
        new URL(
          "/.well-known/security.txt",
          response.url
        );

      const securityTxtResponse =
        await fetch(
          securityTxtUrl.href,
          {
            method: "GET",
            redirect: "follow",
            headers: {
              "User-Agent":
                "SentinelAI-SecurityScanner/4.0"
            }
          }
        );

      const securityTxtContentType =
        securityTxtResponse.headers.get(
          "content-type"
        ) || "";

      if (
        securityTxtResponse.ok &&
        securityTxtResponse.url.startsWith(
          "https://"
        )
      ) {
        securityTxtStatus = "PASS";

        securityTxtMessage =
          "A /.well-known/security.txt resource was detected.";

        securityTxtFix = "";
      } else if (
        securityTxtContentType
          .toLowerCase()
          .includes("text/plain")
      ) {
        securityTxtStatus = "PASS";

        securityTxtMessage =
          "A security.txt text resource was detected.";

        securityTxtFix = "";
      }
    } catch {
      // Keep informational result.
    }

    addCheck(
      "Security.txt",
      securityTxtStatus,
      securityTxtMessage,
      securityTxtFix
    );

    // --------------------------------------------------
    // 20. Robots.txt
    // --------------------------------------------------

    let robotsStatus = "INFO";

    let robotsMessage =
      "Robots.txt availability could not be confirmed.";

    let robotsFix = "";

    try {
      const robotsUrl =
        new URL(
          "/robots.txt",
          response.url
        );

      const robotsResponse =
        await fetch(
          robotsUrl.href,
          {
            method: "GET",
            redirect: "follow",
            headers: {
              "User-Agent":
                "SentinelAI-SecurityScanner/4.0"
            }
          }
        );

      if (robotsResponse.ok) {
        robotsStatus = "PASS";

        robotsMessage =
          "A robots.txt resource was detected.";
      }
    } catch {
      // Keep informational result.
    }

    addCheck(
      "Robots.txt",
      robotsStatus,
      robotsMessage,
      robotsFix
    );

    // --------------------------------------------------
    // SCORE ENGINE
    // --------------------------------------------------

    const severityWeights = {
      PASS: 1,
      INFO: 0.8,
      WARNING: 0.35
    };

    let weightedTotal = 0;

    for (const check of checks) {
      weightedTotal +=
        severityWeights[check.status] ?? 0.5;
    }

    let securityScore =
      Math.round(
        (weightedTotal / checks.length) * 100
      );

    const warningCount =
      checks.filter(
        check => check.status === "WARNING"
      ).length;

    securityScore =
      securityScore -
      warningCount * 3;

    securityScore =
      Math.max(
        0,
        Math.min(
          100,
          securityScore
        )
      );

    // --------------------------------------------------
    // RISK LEVEL
    // --------------------------------------------------

    let riskLevel = "Low";

    if (securityScore < 80) {
      riskLevel = "Medium";
    }

    if (securityScore < 50) {
      riskLevel = "High";
    }

    if (securityScore < 30) {
      riskLevel = "Critical";
    }

    // --------------------------------------------------
    // SUMMARY
    // --------------------------------------------------

    const passed =
      checks.filter(
        check => check.status === "PASS"
      ).length;

    const warnings =
      checks.filter(
        check => check.status === "WARNING"
      ).length;

    const informational =
      checks.filter(
        check => check.status === "INFO"
      ).length;

    // --------------------------------------------------
    // PRIORITY FIXES
    // --------------------------------------------------

    const priorityFixes =
      checks
        .filter(
          check =>
            check.status === "WARNING" &&
            check.fix
        )
        .sort((a, b) => {
          const priority = {
            "HSTS": 1,
            "Content Security Policy": 2,
            "Clickjacking Protection": 3,
            "X-Content-Type-Options": 4,
            "CORS Policy": 5,
            "Cookie Security": 6,
            "Server Information Exposure": 7,
            "HTTP Response Status": 8
          };

          return (
            (priority[a.name] || 99) -
            (priority[b.name] || 99)
          );
        })
        .slice(0, 5)
        .map((check, index) => ({
          priority: index + 1,
          title: check.name,
          fix: check.fix
        }));

    // --------------------------------------------------
    // SCAN ID
    // --------------------------------------------------

    const scanId =
      "SA-" +
      Date.now()
        .toString(36)
        .toUpperCase() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();

    // --------------------------------------------------
    // FINAL RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      product: "Sentinel AI",

      version: "4.0",

      scanId,

      website: response.url,

      scannedAt:
        new Date().toISOString(),

      securityScore,

      riskLevel,

      summary: {
        totalChecks: checks.length,
        passed,
        warnings,
        informational
      },

      priorityFixes,

      checks,

      message:
        "Sentinel AI security-awareness scan completed successfully.",

      disclaimer:
        "This is an automated security-awareness check of publicly observable website configuration. It is not a complete penetration test, vulnerability assessment, or guarantee of security. Only scan websites you own or are authorized to test."
    });

  } catch (error) {
    console.error(
      "Sentinel AI scanner error:",
      error
    );

    return res.status(502).json({
      success: false,
      error:
        "Sentinel AI could not reach or analyze the requested website."
    });
  }
}
