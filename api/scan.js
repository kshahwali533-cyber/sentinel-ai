export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body = req.body || {};
    const website =
      typeof body.website === "string"
        ? body.website.trim()
        : "";

    if (!website) {
      return res.status(400).json({
        error: "Website URL is required."
      });
    }

    let target;

    try {
      target = new URL(
        website.startsWith("http://") ||
        website.startsWith("https://")
          ? website
          : `https://${website}`
      );
    } catch {
      return res.status(400).json({
        error: "Invalid website URL."
      });
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return res.status(400).json({
        error: "Only HTTP and HTTPS URLs are supported."
      });
    }

    /*
     * Prevent requests to localhost/private network targets.
     * Sentinel AI is intended for public websites.
     */
    const hostname = target.hostname.toLowerCase();

    const blockedHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1"
    ];

    if (
      blockedHosts.includes(hostname) ||
      hostname.endsWith(".local")
    ) {
      return res.status(400).json({
        error: "Private or local websites cannot be scanned."
      });
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    let response;

    try {
      response = await fetch(target.href, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Sentinel-AI-Security-Scanner/2.0",
          "Accept":
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        }
      });
    } catch (error) {
      clearTimeout(timeout);

      if (error && error.name === "AbortError") {
        return res.status(504).json({
          error:
            "The website took too long to respond. Please try again."
        });
      }

      return res.status(502).json({
        error:
          "Sentinel AI could not connect to the target website. The website may be unavailable or may be blocking automated requests."
      });
    }

    clearTimeout(timeout);

    const headers = response.headers;

    const finalURL =
      response.url || target.href;

    let finalTarget;

    try {
      finalTarget = new URL(finalURL);
    } catch {
      finalTarget = target;
    }

    const checks = [];

    function addCheck(
      name,
      status,
      message,
      fix = ""
    ) {
      checks.push({
        name,
        status,
        message,
        ...(fix ? { fix } : {})
      });
    }

    /* =========================
       HTTPS
    ========================= */

    if (finalTarget.protocol === "https:") {
      addCheck(
        "HTTPS",
        "PASS",
        "The website uses HTTPS."
      );
    } else {
      addCheck(
        "HTTPS",
        "WARNING",
        "The final website destination does not use HTTPS.",
        "Enable HTTPS and redirect HTTP traffic to HTTPS."
      );
    }

    /* =========================
       HSTS
    ========================= */

    const hsts =
      headers.get("strict-transport-security");

    if (hsts) {
      const match =
        hsts.match(/max-age\s*=\s*(\d+)/i);

      const maxAge =
        match ? Number(match[1]) : 0;

      if (maxAge >= 31536000) {
        addCheck(
          "HSTS",
          "PASS",
          "Strict-Transport-Security was detected with a recommended max-age."
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

    /* =========================
       CONTENT SECURITY POLICY
    ========================= */

    const csp =
      headers.get("content-security-policy");

    if (!csp) {
      addCheck(
        "Content Security Policy",
        "WARNING",
        "Content-Security-Policy was not detected.",
        "Add a carefully configured Content-Security-Policy header."
      );
    } else {
      const weakCSP =
        csp.includes("'unsafe-inline'") ||
        csp.includes("'unsafe-eval'");

      if (weakCSP) {
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

    /* =========================
       CLICKJACKING
    ========================= */

    const xFrame =
      headers.get("x-frame-options");

    const frameAncestors =
      csp &&
      /frame-ancestors/i.test(csp);

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

    /* =========================
       X CONTENT TYPE OPTIONS
    ========================= */

    const xContentType =
      headers.get("x-content-type-options");

    if (
      xContentType &&
      xContentType
        .toLowerCase()
        .includes("nosniff")
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

    /* =========================
       REFERRER POLICY
    ========================= */

    const referrerPolicy =
      headers.get("referrer-policy");

    if (referrerPolicy) {
      addCheck(
        "Referrer-Policy",
        "PASS",
        "Referrer-Policy was detected."
      );
    } else {
      addCheck(
        "Referrer-Policy",
        "INFO",
        "Referrer-Policy header was not detected.",
        "Consider using a restrictive Referrer-Policy."
      );
    }

    /* =========================
       PERMISSIONS POLICY
    ========================= */

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

    /* =========================
       CORS
    ========================= */

    const cors =
      headers.get(
        "access-control-allow-origin"
      );

    if (cors) {
      addCheck(
        "CORS Policy",
        "PASS",
        "CORS policy was exposed by the response."
      );
    } else {
      addCheck(
        "CORS Policy",
        "INFO",
        "No CORS policy was exposed by the response."
      );
    }

    /* =========================
       SERVER INFORMATION
    ========================= */

    const server =
      headers.get("server");

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

    /* =========================
       COOKIE SECURITY
    ========================= */

    let setCookie = "";

    try {
      if (
        typeof headers.getSetCookie === "function"
      ) {
        setCookie =
          headers.getSetCookie().join("\n");
      } else {
        setCookie =
          headers.get("set-cookie") || "";
      }
    } catch {
      setCookie =
        headers.get("set-cookie") || "";
    }

    if (!setCookie) {
      addCheck(
        "Cookie Security",
        "INFO",
        "No Set-Cookie header was detected."
      );
    } else {
      const cookieText =
        setCookie.toLowerCase();

      const missing = [];

      if (!cookieText.includes("secure")) {
        missing.push("Secure");
      }

      if (!cookieText.includes("httponly")) {
        missing.push("HttpOnly");
      }

      if (!cookieText.includes("samesite")) {
        missing.push("SameSite");
      }

      if (missing.length === 0) {
        addCheck(
          "Cookie Security",
          "PASS",
          "Detected cookies include the recommended security attributes."
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

    /* =========================
       CACHE CONTROL
    ========================= */

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
        "Cache-Control header was not detected.",
        "Consider an appropriate caching policy for your application."
      );
    }

    /* =========================
       CROSS ORIGIN POLICIES
    ========================= */

    const coop =
      headers.get(
        "cross-origin-opener-policy"
      );

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

    const corp =
      headers.get(
        "cross-origin-resource-policy"
      );

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

    const coep =
      headers.get(
        "cross-origin-embedder-policy"
      );

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

    /* =========================
       HTTP STATUS
    ========================= */

    if (
      response.status >= 200 &&
      response.status < 400
    ) {
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
        "Review the HTTP response status and server configuration."
      );
    }

    /* =========================
       FINAL DESTINATION
    ========================= */

    if (
      finalTarget.protocol === "https:"
    ) {
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
        "Use HTTPS for the final destination."
      );
    }

    /* =========================
       CONTENT TYPE
    ========================= */

    const contentType =
      headers.get("content-type") || "";

    if (
      contentType
        .toLowerCase()
        .includes("text/html")
    ) {
      addCheck(
        "Content-Type",
        "PASS",
        "The response identifies itself as HTML content."
      );
    } else {
      addCheck(
        "Content-Type",
        "INFO",
        "The response Content-Type is " +
          (contentType || "not specified") +
          "."
      );
    }

    /* =========================
       HOSTNAME
    ========================= */

    if (finalTarget.hostname) {
      addCheck(
        "Hostname Configuration",
        "PASS",
        "A public hostname was provided for the security check."
      );
    }

    /* =========================
       SECURITY.TXT
    ========================= */

    try {
      const securityTxtURL =
        `${finalTarget.origin}/.well-known/security.txt`;

      const securityController =
        new AbortController();

      const securityTimeout =
        setTimeout(() => {
          securityController.abort();
        }, 7000);

      const securityResponse =
        await fetch(securityTxtURL, {
          method: "GET",
          redirect: "follow",
          signal: securityController.signal,
          headers: {
            "User-Agent":
              "Sentinel-AI-Security-Scanner/2.0"
          }
        });

      clearTimeout(securityTimeout);

      if (
        securityResponse.ok &&
        securityResponse.status < 400
      ) {
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
    } catch {
      addCheck(
        "Security.txt",
        "INFO",
        "Security.txt could not be confirmed.",
        "Consider publishing /.well-known/security.txt with security contact information."
      );
    }

    /* =========================
       ROBOTS.TXT
    ========================= */

    try {
      const robotsURL =
        `${finalTarget.origin}/robots.txt`;

      const robotsController =
        new AbortController();

      const robotsTimeout =
        setTimeout(() => {
          robotsController.abort();
        }, 7000);

      const robotsResponse =
        await fetch(robotsURL, {
          method: "GET",
          redirect: "follow",
          signal: robotsController.signal,
          headers: {
            "User-Agent":
              "Sentinel-AI-Security-Scanner/2.0"
          }
        });

      clearTimeout(robotsTimeout);

      if (
        robotsResponse.ok &&
        robotsResponse.status < 400
      ) {
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
    } catch {
      addCheck(
        "Robots.txt",
        "INFO",
        "Robots.txt availability could not be confirmed."
      );
    }

    /* =========================
       SCORE
    ========================= */

    const totalChecks =
      checks.length;

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

    let securityScore = 0;

    if (totalChecks > 0) {
      securityScore =
        Math.round(
          (
            (
              passed +
              informational * 0.75
            ) /
            totalChecks
          ) * 100
        );
    }

    securityScore =
      Math.max(
        0,
        Math.min(
          100,
          securityScore
        )
      );

    let riskLevel = "Low";

    if (
      securityScore < 50 ||
      warnings >= 5
    ) {
      riskLevel = "High";
    } else if (
      securityScore < 75 ||
      warnings >= 2
    ) {
      riskLevel = "Medium";
    }

    return res.status(200).json({
      website: finalURL,
      securityScore,
      riskLevel,
      checks,
      summary: {
        totalChecks,
        passed,
        warnings,
        informational
      }
    });

  } catch (error) {
    console.error(
      "Sentinel AI scan error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to scan the website. The target may be unavailable or may have blocked the request."
    });
  }
}
