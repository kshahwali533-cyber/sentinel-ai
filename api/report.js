import { normalizeEvidence } from "./_lib/security-evidence.js";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        error: "Invalid request body."
      });
    }

    const {
      website,
      securityScore,
      riskLevel,
      checks,
      scanId
    } = body;

    if (typeof website !== "string" || !website.trim() || website.length > 2048) {
      return res.status(400).json({
        error: "A valid website URL is required."
      });
    }

    try {
      const parsedWebsite = new URL(website);
      if (!["http:", "https:"].includes(parsedWebsite.protocol) ||
          parsedWebsite.username || parsedWebsite.password) {
        throw new Error("Unsupported URL.");
      }
    } catch {
      return res.status(400).json({
        error: "Website must be a valid HTTP or HTTPS URL."
      });
    }

    if (!Array.isArray(checks) || checks.length > 200) {
      return res.status(400).json({
        error: "Security checks must be an array containing no more than 200 items."
      });
    }

    if (checks.some(check => !check || typeof check !== "object" || Array.isArray(check))) {
      return res.status(400).json({
        error: "Each security check must be a valid object."
      });
    }

    if (typeof securityScore !== "number" || !Number.isFinite(securityScore) ||
        securityScore < 0 || securityScore > 100) {
      return res.status(400).json({
        error: "Security score must be a number between 0 and 100."
      });
    }

    if (riskLevel !== undefined &&
        (typeof riskLevel !== "string" || riskLevel.length > 24)) {
      return res.status(400).json({
        error: "Invalid risk level."
      });
    }

    if (scanId !== undefined &&
        (typeof scanId !== "string" || scanId.length > 128)) {
      return res.status(400).json({
        error: "Invalid scan identifier."
      });
    }

    const safeText = (value, maxLength, fallback) =>
      typeof value === "string" && value.trim()
        ? value.trim().slice(0, maxLength)
        : fallback;

    for (const check of checks) {
      if (check.evidence !== undefined &&
          (!check.evidence || typeof check.evidence !== "object" || Array.isArray(check.evidence))) {
        return res.status(400).json({
          error: "Security evidence must be a valid object."
        });
      }

      if (check.evidence) {
        for (const field of ["source", "signal", "observed", "expected"]) {
          if (check.evidence[field] !== undefined &&
              (typeof check.evidence[field] !== "string" || check.evidence[field].length > 2000)) {
            return res.status(400).json({
              error: "Security evidence contains an invalid or oversized field."
            });
          }
        }
      }

      for (const field of ["name", "title", "status", "message", "description", "fix", "recommendation"]) {
        if (check[field] !== undefined &&
            (typeof check[field] !== "string" || check[field].length > 2000)) {
          return res.status(400).json({
            error: "A security check contains an invalid or oversized text field."
          });
        }
      }
    }

    const score = securityScore;

    if (!Number.isFinite(score)) {
      return res.status(400).json({
        error: "Security score must be a valid number."
      });
    }

    const safeScore = Math.max(
      0,
      Math.min(100, Math.round(score))
    );

    const passed = checks.filter(
      check =>
        String(check?.status || "").toLowerCase() === "pass" ||
        String(check?.status || "").toLowerCase() === "passed"
    ).length;

    const warnings = checks.filter(
      check =>
        String(check?.status || "").toLowerCase() === "warning" ||
        String(check?.status || "").toLowerCase() === "warn"
    ).length;

    const informational = checks.filter(
      check =>
        String(check?.status || "").toLowerCase() === "info" ||
        String(check?.status || "").toLowerCase() === "informational"
    ).length;

    const evidenceBackedFindings = checks.filter(
      check => normalizeEvidence(check.evidence) !== null
    ).length;

    const priorityFindings = checks
      .filter(
        check =>
          String(check?.status || "").toLowerCase() === "warning" ||
          String(check?.status || "").toLowerCase() === "warn"
      )
      .slice(0, 5)
      .map((check, index) => ({
        priority: index + 1,
        title: safeText(check.name || check.title, 160, "Security Finding"),
        status: safeText(check.status, 24, "Warning"),
        message: safeText(
          check.message || check.description,
          500,
          "A security configuration issue was detected."
        ),
        fix: safeText(
          check.fix || check.recommendation,
          500,
          "Review and improve this security configuration."
        ),
        ...(normalizeEvidence(check.evidence)
          ? { evidence: normalizeEvidence(check.evidence) }
          : {})
      }));

    const recommendations = priorityFindings.map(
      finding => finding.fix
    );

    const nextSteps = [
      "Review all WARNING findings first.",
      "Apply the recommended security configuration changes.",
      "Run Sentinel AI again to verify the improvements.",
      "Monitor the website security configuration regularly."
    ];

    const report = {
      website: String(website),
      scanId: scanId || "",
      securityScore: safeScore,
      riskLevel: safeText(riskLevel, 24, "Unknown"),

      generatedAt: new Date().toISOString(),

      executiveSummary: {
        totalChecks: checks.length,
        passed,
        warnings,
        informational,
        priorityIssues: priorityFindings.length,
        evidenceBackedFindings
      },

      priorityFindings,

      recommendations,

      nextSteps,

      disclaimer:
        "Sentinel AI provides security-awareness and defensive guidance based on publicly observable security signals. It is not a substitute for a complete professional security assessment."
    };

    return res.status(200).json({
      success: true,
      report
    });

  } catch (error) {

    console.error(
      "Report API Error:",
      error
    );

    return res.status(500).json({
      error: "Unable to generate the security report."
    });
  }
}
