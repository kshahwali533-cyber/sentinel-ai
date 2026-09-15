export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {

    const {
      website,
      securityScore,
      riskLevel,
      checks,
      scanId
    } = req.body || {};

    if (!website) {
      return res.status(400).json({
        error: "Website is required."
      });
    }

    if (!Array.isArray(checks)) {
      return res.status(400).json({
        error: "Security checks are required."
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
