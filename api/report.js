export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {

    const body = req.body || {};

    if (
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: "Invalid report request."
      });
    }

    const website =
      typeof body.website === "string"
        ? body.website.trim()
        : "";
    const securityScore = body.securityScore;
    const riskLevel =
      typeof body.riskLevel === "string"
        ? body.riskLevel.trim().slice(0, 40)
        : "Unknown";
    const scanId =
      typeof body.scanId === "string"
        ? body.scanId.trim().slice(0, 100)
        : "";

    if (!website) {
      return res.status(400).json({
        error: "A valid website is required."
      });
    }

    if (
      !Array.isArray(body.checks) ||
      body.checks.length === 0 ||
      body.checks.length > 100
    ) {
      return res.status(400).json({
        error: "Between 1 and 100 security checks are required."
      });
    }

    const checks = body.checks.map(check => {
      if (!check || typeof check !== "object" || Array.isArray(check)) {
        return null;
      }

      const safeText = (value, maxLength, fallback = "") =>
        typeof value === "string"
          ? value.trim().slice(0, maxLength)
          : fallback;

      return {
        name: safeText(check.name, 120, "Security Check"),
        status: safeText(check.status, 20, "INFO").toUpperCase(),
        message: safeText(check.message, 1000),
        description: safeText(check.description, 1000),
        fix: safeText(check.fix, 1000),
        recommendation: safeText(check.recommendation, 1000)
      };
    });

    if (checks.some(check => check === null)) {
      return res.status(400).json({
        error: "One or more security checks are invalid."
      });
    }

    if (website.length > 2048) {
      return res.status(400).json({
        error: "Website URL is too long."
      });
    }

    let parsedWebsite;
    try {
      parsedWebsite = new URL(website);
    } catch {
      return res.status(400).json({
        error: "A valid website URL is required."
      });
    }

    if (
      !["http:", "https:"].includes(parsedWebsite.protocol) ||
      !parsedWebsite.hostname ||
      parsedWebsite.username ||
      parsedWebsite.password
    ) {
      return res.status(400).json({
        error: "Website must be a valid HTTP or HTTPS URL."
      });
    }

    const allowedStatuses = new Set(["PASS", "WARNING", "INFO"]);
    if (checks.some(check => !allowedStatuses.has(check.status))) {
      return res.status(400).json({
        error: "One or more security check statuses are invalid."
      });
    }

    const score = Number(securityScore);

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

    const priorityFindings = checks
      .filter(
        check =>
          String(check?.status || "").toLowerCase() === "warning" ||
          String(check?.status || "").toLowerCase() === "warn"
      )
      .slice(0, 5)
      .map((check, index) => ({
        priority: index + 1,
        title: check?.name || check?.title || "Security Finding",
        status: check?.status || "Warning",
        message:
          check?.message ||
          check?.description ||
          "A security configuration issue was detected.",
        fix:
          check?.fix ||
          check?.recommendation ||
          "Review and improve this security configuration."
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
      scanId: scanId ? String(scanId) : "",
      securityScore: safeScore,
      riskLevel: riskLevel || "Unknown",

      generatedAt: new Date().toISOString(),

      executiveSummary: {
        totalChecks: checks.length,
        passed,
        warnings,
        informational,
        priorityIssues: priorityFindings.length
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
