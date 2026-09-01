export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body = req.body || {};
    const website =
      typeof body.url === "string"
        ? body.url.trim()
        : typeof body.website === "string"
        ? body.website.trim()
        : "";

    if (!website) {
      return res.status(400).json({
        error: "Website URL is required."
      });
    }

    const normalizedUrl =
      website.startsWith("http://") ||
      website.startsWith("https://")
        ? website
        : `https://${website}`;

    let target;

    try {
      target = new URL(normalizedUrl);
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
            "Sentinel-AI-Security-Scanner/3.0",
          "Accept":
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        }
      });
    } catch (error) {
      clearTimeout(timeout);

      if (error?.name === "AbortError") {
        return res.status(504).json({
          error:
            "The website took too long to respond. Please try again."
        });
      }

      return res.status(502).json({
        error:
          "Sentinel AI could not connect to the target website."
      });
    }

    clearTimeout(timeout);

    const headers = response.headers;
    const finalURL = response.url || target.href;

    let finalTarget;

    try {
      finalTarget = new URL(finalURL);
    } catch {
      finalTarget = target;
    }

    const checks = [];

    function addCheck(name, status, message, fix = "") {
      checks.push({
        name,
        status,
        message,
        ...(fix ? { fix } : {})
      });
    }

    // HTTPS
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

    // HSTS
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
          "HSTS was detected but the max-age is below the recommended baseline.",
          "Consider using a max-age of at least 31536000 seconds."
        );
      }
    } else {
      addCheck(
        "HSTS",
        "WARNING",
        "HSTS header was not detected.",
        "Enable Strict-Transport-Security with an appropriate max-age."
      );
    }

    // CSP
    const csp =
      headers.get("content-security-policy");

    if (!csp) {
      addCheck(
        "Content Security Policy",
        "WARNING",
        "Content-Security-Policy was not detected.",
        "Add a carefully configured Content-Security-Policy header."
      );
    } else if (
      csp.includes("'unsafe-inline'") ||
      csp.includes("'unsafe-eval'")
    ) {
      addCheck(
        "Content Security Policy",
        "INFO",
        "A Content-Security-Policy was detected with potentially weaker directives.",
        "Review unsafe-inline and unsafe-eval usage."
      );
    } else {
      addCheck(
        "Content Security Policy",
        "PASS",
        "A Content-Security-Policy header was detected."
      );
    }

    // Clickjacking
    const xFrame =
      headers.get("x-frame-options");

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
        "Add X-Frame-Options or CSP frame-ancestors."
      );
    }

    // X-Content-Type-Options
    const xContentType =
      headers.get("x-content-type-options");

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
        "Referrer-Policy was not detected.",
        "Consider using a restrictive Referrer-Policy."
      );
    }

    // Permissions Policy
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
        "Permissions-Policy was not detected.",
        "Consider adding Permissions-Policy."
      );
    }

    // CORS
    const cors =
      headers.get("access-control-allow-origin");

    if (cors) {
      addCheck(
        "CORS Policy",
        "INFO",
        `CORS policy detected: ${cors}.`
      );
    } else {
      addCheck(
        "CORS Policy",
        "INFO",
        "No CORS policy was exposed by the response."
      );
    }

    // Server
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

    // Cookies
    let setCookies = [];

    try {
      if (typeof headers.getSetCookie === "function") {
        setCookies = headers.getSetCookie();
      } else {
        const cookie =
          headers.get("set-cookie");

        if (cookie) {
          setCookies = [cookie];
        }
      }
    } catch {
      setCookies = [];
    }

    if (!setCookies.length) {
      addCheck(
        "Cookie Security",
        "INFO",
        "No Set-Cookie header was detected."
      );
    } else {
      let insecureCookie = false;

      for (const cookie of setCookies) {
        const text = cookie.toLowerCase();

        if (
          !text.includes("secure") ||
          !text.includes("httponly") ||
          !text.includes("samesite")
        ) {
          insecureCookie = true;
          break;
        }
      }

      if (insecureCookie) {
        addCheck(
          "Cookie Security",
          "WARNING",
          "One or more cookies may be missing recommended security attributes.",
          "Review cookies and use appropriate Secure, HttpOnly and SameSite attributes."
        );
      } else {
        addCheck(
          "Cookie Security",
          "PASS",
          "Detected cookies include the recommended security attributes."
        );
      }
    }

    // Cache-Control
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
        "Cache-Control was not detected.",
        "Consider an appropriate caching policy."
      );
    }

    // COOP
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
        "Consider COOP where appropriate."
      );
    }

    // CORP
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
        "Consider CORP where appropriate."
      );
    }

    // COEP
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
        "Consider COEP where appropriate."
      );
    }

    // HTTP status
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
        "Review the HTTP response and server configuration."
      );
    }

    // Final destination
    if (finalTarget.protocol === "https:") {
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

    // Content type
    const contentType =
      headers.get("content-type") || "";

    if (
      contentType.toLowerCase().includes("text/html")
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
        `The response Content-Type is ${
          contentType || "not specified"
        }.`
      );
    }

    // Hostname
    addCheck(
      "Hostname Configuration",
      "PASS",
      `Public hostname detected: ${finalTarget.hostname}.`
    );

    // Security.txt
    try {
      const securityURL =
        `${finalTarget.origin}/.well-known/security.txt`;

      const securityController =
        new AbortController();

      const securityTimeout =
        setTimeout(() => securityController.abort(), 5000);

      const securityResponse =
        await fetch(securityURL, {
          method: "GET",
          redirect: "follow",
          signal: securityController.signal,
          headers: {
            "User-Agent":
              "Sentinel-AI-Security-Scanner/3.0"
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
          "A security.txt resource was detected."
        );
      } else {
        addCheck(
          "Security.txt",
          "INFO",
          "Security.txt could not be confirmed.",
          "Consider publishing /.well-known/security.txt."
        );
      }
    } catch {
      addCheck(
        "Security.txt",
        "INFO",
        "Security.txt could not be confirmed.",
        "Consider publishing /.well-known/security.txt."
      );
    }

    // Robots.txt
    try {
      const robotsURL =
        `${finalTarget.origin}/robots.txt`;

      const robotsController =
        new AbortController();

      const robotsTimeout =
        setTimeout(() => robotsController.abort(), 5000);

      const robotsResponse =
        await fetch(robotsURL, {
          method: "GET",
          redirect: "follow",
          signal: robotsController.signal,
          headers: {
            "User-Agent":
              "Sentinel-AI-Security-Scanner/3.0"
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

    // SCORE
    const totalChecks = checks.length;

    const passed =
      checks.filter(
        c => c.status === "PASS"
      ).length;

    const warnings =
      checks.filter(
        c => c.status === "WARNING"
      ).length;

    const informational =
      checks.filter(
        c => c.status === "INFO"
      ).length;

    let score = 0;

    if (totalChecks > 0) {
      score = Math.round(
        (
          (
            passed +
            informational * 0.75
          ) /
          totalChecks
        ) * 100
      );
    }

    score = Math.max(
      0,
      Math.min(100, score)
    );

    let riskLevel = "Low";

    if (score < 50 || warnings >= 5) {
      riskLevel = "High";
    } else if (score < 75 || warnings >= 2) {
      riskLevel = "Medium";
    }

    const scanId =
      "SA-" +
      Date.now().toString(36) +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 7);

    return res.status(200).json({
      website: finalURL,
      finalUrl: finalURL,

      // Frontend compatibility
      score: score,
      securityScore: score,

      riskLevel: riskLevel,

      scanId: scanId,

      checks: checks,

      summary: {
        total: totalChecks,
        totalChecks: totalChecks,
        passed: passed,
        warnings: warnings,
        informational: informational
      }
    });

  } catch (error) {
    console.error(
      "Sentinel AI scan error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to scan the website. Please try again."
    });
  }
}
