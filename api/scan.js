import dns from "node:dns/promises";
import net from "node:net";

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

    if (target.username || target.password) {
      return res.status(400).json({
        error:
          "URLs containing username or password information are not supported."
      });
    }

    /*
     * ---------------------------------------------------------
     * SSRF / PRIVATE IP PROTECTION
     * ---------------------------------------------------------
     */

    function ipv4ToNumber(ip) {
      const parts = ip.split(".").map(Number);

      if (
        parts.length !== 4 ||
        parts.some(
          part =>
            !Number.isInteger(part) ||
            part < 0 ||
            part > 255
        )
      ) {
        return null;
      }

      return (
        parts[0] * 256 ** 3 +
        parts[1] * 256 ** 2 +
        parts[2] * 256 +
        parts[3]
      );
    }

    function isPrivateIPv4(ip) {
      const value = ipv4ToNumber(ip);

      if (value === null) {
        return false;
      }

      const first = Number(ip.split(".")[0]);
      const second = Number(ip.split(".")[1]);

      return (
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 0)
      );
    }

    function expandIPv6(ip) {
      let address = ip.toLowerCase();

      if (address.includes("%")) {
        address = address.split("%")[0];
      }

      if (address.includes(".")) {
        const lastColon = address.lastIndexOf(":");
        const ipv4Part = address.slice(lastColon + 1);
        const ipv4Value = ipv4ToNumber(ipv4Part);

        if (ipv4Value !== null) {
          const high = ((ipv4Value >>> 16) & 0xffff)
            .toString(16)
            .padStart(4, "0");

          const low = (ipv4Value & 0xffff)
            .toString(16)
            .padStart(4, "0");

          address =
            address.slice(0, lastColon + 1) +
            high +
            ":" +
            low;
        }
      }

      const halves = address.split("::");

      if (halves.length > 2) {
        return null;
      }

      let left = halves[0]
        ? halves[0].split(":").filter(Boolean)
        : [];

      let right = halves[1]
        ? halves[1].split(":").filter(Boolean)
        : [];

      if (halves.length === 1) {
        if (left.length !== 8) {
          return null;
        }
      } else {
        const missing = 8 - left.length - right.length;

        if (missing < 1) {
          return null;
        }

        left = [
          ...left,
          ...Array(missing).fill("0"),
          ...right
        ];
      }

      if (left.length !== 8) {
        return null;
      }

      if (
        left.some(
          part =>
            !/^[0-9a-f]{1,4}$/i.test(part)
        )
      ) {
        return null;
      }

      return left.map(part =>
        parseInt(part, 16)
      );
    }

    function isPrivateIPv6(ip) {
      const groups = expandIPv6(ip);

      if (!groups) {
        return false;
      }

      /*
       * ::1 loopback
       */
      const isLoopback =
        groups.every((value, index) =>
          index === 7
            ? value === 1
            : value === 0
        );

      if (isLoopback) {
        return true;
      }

      /*
       * :: unspecified
       */
      const isUnspecified =
        groups.every(value => value === 0);

      if (isUnspecified) {
        return true;
      }

      /*
       * fc00::/7 — Unique Local Addresses
       */
      if ((groups[0] & 0xfe00) === 0xfc00) {
        return true;
      }

      /*
       * fe80::/10 — Link Local
       */
      if ((groups[0] & 0xffc0) === 0xfe80) {
        return true;
      }

      /*
       * IPv4-mapped IPv6:
       * ::ffff:192.168.x.x
       * ::ffff:127.x.x.x
       */
      if (
        groups.length === 8 &&
        groups[0] === 0 &&
        groups[1] === 0 &&
        groups[2] === 0 &&
        groups[3] === 0 &&
        groups[4] === 0 &&
        groups[5] === 0xffff
      ) {
        const mappedIPv4 =
          `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;

        return isPrivateIPv4(mappedIPv4);
      }

      return false;
    }

    function isPrivateIP(ip) {
      const family = net.isIP(ip);

      if (family === 4) {
        return isPrivateIPv4(ip);
      }

      if (family === 6) {
        return isPrivateIPv6(ip);
      }

      return false;
    }

    async function validateTargetURL(urlObject) {
      if (
        !["http:", "https:"].includes(
          urlObject.protocol
        )
      ) {
        return {
          safe: false,
          reason:
            "The website redirected to an unsupported destination."
        };
      }

      if (
        urlObject.username ||
        urlObject.password
      ) {
        return {
          safe: false,
          reason:
            "URLs containing username or password information are not supported."
        };
      }

      const hostname =
        urlObject.hostname.toLowerCase();

      const blockedHosts = [
        "localhost",
        "localhost.",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "[::1]"
      ];

      if (
        blockedHosts.includes(hostname) ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".internal")
      ) {
        return {
          safe: false,
          reason:
            "Private or local websites cannot be scanned."
        };
      }

      /*
       * Direct IP address.
       */
      if (net.isIP(hostname)) {
        if (isPrivateIP(hostname)) {
          return {
            safe: false,
            reason:
              "Private or local websites cannot be scanned."
          };
        }

        return {
          safe: true
        };
      }

      /*
       * Resolve hostname and inspect every returned address.
       * If ANY resolved address is private/local, block it.
       */
      try {
        const resolved =
          await dns.lookup(hostname, {
            all: true,
            verbatim: true
          });

        if (!resolved || !resolved.length) {
          return {
            safe: false,
            reason:
              "The website hostname could not be safely resolved."
          };
        }

        for (const entry of resolved) {
          if (isPrivateIP(entry.address)) {
            return {
              safe: false,
              reason:
                "The website hostname resolves to a private or local destination."
            };
          }
        }
      } catch {
        return {
          safe: false,
          reason:
            "The website hostname could not be safely resolved."
        };
      }

      return {
        safe: true
      };
    }

    const initialValidation =
      await validateTargetURL(target);

    if (!initialValidation.safe) {
      return res.status(400).json({
        error: initialValidation.reason
      });
    }

    /*
     * ---------------------------------------------------------
     * SAFE FETCH WITH MANUAL REDIRECT VALIDATION
     * ---------------------------------------------------------
     */

    async function safeFetch(startURL, options = {}) {
      let currentURL =
        new URL(startURL.href);

      const maxRedirects = 5;

      for (
        let redirectCount = 0;
        redirectCount <= maxRedirects;
        redirectCount++
      ) {
        const validation =
          await validateTargetURL(currentURL);

        if (!validation.safe) {
          const error =
            new Error(validation.reason);

          error.code = "SSRF_BLOCKED";

          throw error;
        }

        const controller =
          new AbortController();

        const timeout =
          setTimeout(
            () => controller.abort(),
            options.timeout || 15000
          );

        let response;

        try {
          response = await fetch(
            currentURL.href,
            {
              method:
                options.method || "GET",
              redirect: "manual",
              signal: controller.signal,
              headers:
                options.headers || {}
            }
          );
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }

        clearTimeout(timeout);

        /*
         * Handle redirects manually so every redirect
         * destination is validated before the next request.
         */
        if (
          response.status >= 300 &&
          response.status < 400
        ) {
          const location =
            response.headers.get("location");

          if (!location) {
            return {
              response,
              finalURL: currentURL
            };
          }

          if (
            redirectCount >= maxRedirects
          ) {
            const error =
              new Error(
                "The website exceeded the maximum number of redirects."
              );

            error.code =
              "TOO_MANY_REDIRECTS";

            throw error;
          }

          let nextURL;

          try {
            nextURL =
              new URL(
                location,
                currentURL.href
              );
          } catch {
            const error =
              new Error(
                "The website returned an invalid redirect destination."
              );

            error.code =
              "INVALID_REDIRECT";

            throw error;
          }

          const nextValidation =
            await validateTargetURL(nextURL);

          if (!nextValidation.safe) {
            const error =
              new Error(
                "The website redirected to a private or local destination."
              );

            error.code =
              "SSRF_REDIRECT_BLOCKED";

            throw error;
          }

          currentURL = nextURL;
          continue;
        }

        return {
          response,
          finalURL: currentURL
        };
      }

      throw new Error(
        "Unable to safely follow the website redirects."
      );
    }

    let mainResult;

    try {
      mainResult = await safeFetch(
        target,
        {
          method: "GET",
          timeout: 15000,
          headers: {
            "User-Agent":
              "Sentinel-AI-Security-Scanner/3.2",
            "Accept":
              "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
          }
        }
      );
    } catch (error) {
      if (
        error?.code === "SSRF_BLOCKED" ||
        error?.code === "SSRF_REDIRECT_BLOCKED"
      ) {
        return res.status(400).json({
          error:
            error.message ||
            "The website redirected to a private or local destination."
        });
      }

      if (
        error?.code === "TOO_MANY_REDIRECTS"
      ) {
        return res.status(400).json({
          error:
            "The website exceeded the maximum number of redirects."
        });
      }

      if (
        error?.code === "INVALID_REDIRECT"
      ) {
        return res.status(400).json({
          error:
            "The website returned an invalid redirect destination."
        });
      }

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

    const response =
      mainResult.response;

    const finalTarget =
      mainResult.finalURL;

    const headers =
      response.headers;

    const finalURL =
      finalTarget.href;

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

    // HTTPS
    if (
      finalTarget.protocol === "https:"
    ) {
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
      headers.get(
        "strict-transport-security"
      );

    if (hsts) {
      const match =
        hsts.match(
          /(?:^|;)\s*max-age\s*=\s*(\d+)/i
        );

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
      headers.get(
        "content-security-policy"
      );

    if (!csp) {
      addCheck(
        "Content Security Policy",
        "WARNING",
        "Content-Security-Policy was not detected.",
        "Add a carefully configured Content-Security-Policy header."
      );
    } else if (
      /'unsafe-inline'/i.test(csp) ||
      /'unsafe-eval'/i.test(csp)
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
        "Add X-Frame-Options or CSP frame-ancestors."
      );
    }

    // X-Content-Type-Options
    const xContentType =
      headers.get(
        "x-content-type-options"
      );

    if (
      xContentType &&
      /\bnosniff\b/i.test(
        xContentType
      )
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
      headers.get(
        "referrer-policy"
      );

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
      headers.get(
        "permissions-policy"
      );

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
      headers.get(
        "access-control-allow-origin"
      );

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

    // Server Information
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
      if (
        typeof headers.getSetCookie ===
        "function"
      ) {
        setCookies =
          headers.getSetCookie();
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
        const hasSecure =
          /(?:^|;\s*)secure(?:\s*;|$)/i.test(
            cookie
          );

        const hasHttpOnly =
          /(?:^|;\s*)httponly(?:\s*;|$)/i.test(
            cookie
          );

        const hasSameSite =
          /(?:^|;\s*)samesite\s*=/i.test(
            cookie
          );

        if (
          !hasSecure ||
          !hasHttpOnly ||
          !hasSameSite
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
        "Consider COOP where appropriate."
      );
    }

    // CORP
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
        "Consider CORP where appropriate."
      );
    }

    // COEP
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
        "Consider COEP where appropriate."
      );
    }

    // HTTP Response Status
    if (
      response.status >= 200 &&
      response.status < 400
    ) {
      addCheck(
        "HTTP Response Status",
        "PASS",
        `The website returned HTTP status ${response.status}.`
      );
    } else if (
      response.status === 404 ||
      response.status === 410
    ) {
      addCheck(
        "HTTP Response Status",
        "INFO",
        `The website returned HTTP status ${response.status}. This indicates that the requested resource was not found or is no longer available.`,
        "Verify that the scanned URL points to the intended live resource."
      );
    } else if (
      response.status === 429
    ) {
      addCheck(
        "HTTP Response Status",
        "INFO",
        "The website returned HTTP 429, indicating that requests may be temporarily rate limited.",
        "If expected, no immediate security fix is required. Review rate-limiting behavior if this affects legitimate users."
      );
    } else if (
      response.status >= 400 &&
      response.status < 500
    ) {
      addCheck(
        "HTTP Response Status",
        "INFO",
        `The website returned HTTP status ${response.status}, indicating a client-side request or resource issue.`,
        "Review the requested URL and confirm that the intended resource is available."
      );
    } else {
      addCheck(
        "HTTP Response Status",
        "WARNING",
        `The website returned HTTP status ${response.status}.`,
        "Review the server response and configuration."
      );
    }

    // Final destination
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

    // Content type
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

    /*
     * ---------------------------------------------------------
     * SECURITY.TXT
     * ---------------------------------------------------------
     */

    try {
      const securityURL =
        new URL(
          "/.well-known/security.txt",
          finalTarget.origin
        );

      const securityResult =
        await safeFetch(
          securityURL,
          {
            method: "GET",
            timeout: 5000,
            headers: {
              "User-Agent":
                "Sentinel-AI-Security-Scanner/3.2"
            }
          }
        );

      const securityResponse =
        securityResult.response;

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

    /*
     * ---------------------------------------------------------
     * ROBOTS.TXT
     * ---------------------------------------------------------
     */

    try {
      const robotsURL =
        new URL(
          "/robots.txt",
          finalTarget.origin
        );

      const robotsResult =
        await safeFetch(
          robotsURL,
          {
            method: "GET",
            timeout: 5000,
            headers: {
              "User-Agent":
                "Sentinel-AI-Security-Scanner/3.2"
            }
          }
        );

      const robotsResponse =
        robotsResult.response;

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
    const totalChecks =
      checks.length;

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

    if (
      score < 50 ||
      warnings >= 5
    ) {
      riskLevel = "High";
    } else if (
      score < 75 ||
      warnings >= 2
    ) {
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
      score,
      securityScore: score,
      riskLevel,
      scanId,
      checks,
      summary: {
        total: totalChecks,
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
        "Unable to scan the website. Please try again."
    });
  }
}
