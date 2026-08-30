export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  const { website, securityScore, riskLevel, checks } = req.body || {};

  if (!website || typeof securityScore !== "number" || !Array.isArray(checks)) {
    return res.status(400).json({
      error: "Website, security score and scan checks are required."
    });
  }

  const warnings = checks.filter(
    check => check.status === "WARNING"
  );

  const passed = checks.filter(
    check => check.status === "PASS"
  );

  const info = checks.filter(
    check => check.status === "INFO"
  );

  let recommendation;

  if (securityScore >= 80) {
    recommendation =
      "The website has a good security header baseline. Continue monitoring and regularly review security settings.";
  } else if (securityScore >= 50) {
    recommendation =
      "The website has several security improvements available. Review the warnings and apply the recommended fixes.";
  } else {
    recommendation =
      "The website has important security improvements available. Prioritize the warning findings and review the recommended fixes.";
  }

  return res.status(200).json({
    success: true,
    product: "Sentinel AI",
    report: {
      website,
      securityScore,
      riskLevel,
      generatedAt: new Date().toISOString(),

      summary: {
        totalChecks: checks.length,
        passed: passed.length,
        warnings: warnings.length,
        informational: info.length
      },

      findings: warnings.map(check => ({
        title: check.name,
        status: check.status,
        message: check.message,
        fix: check.fix || "Review this security setting."
      })),

      recommendations: [
        recommendation,
        "Keep HTTPS enabled across the entire website.",
        "Review security headers after major website changes.",
        "Test security settings regularly."
      ],

      disclaimer:
        "This report is an automated security-awareness check. It is not a complete penetration test or security audit."
    }
  });
}
