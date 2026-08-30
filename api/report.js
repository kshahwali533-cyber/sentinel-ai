export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  const {
    website,
    securityScore,
    riskLevel,
    checks,
    scanId
  } = req.body || {};

  if (
    !website ||
    typeof securityScore !== "number" ||
    !Array.isArray(checks)
  ) {
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

  const criticalFindings = warnings.filter(
    check =>
      [
        "HSTS",
        "Content Security Policy",
        "Clickjacking Protection",
        "X-Content-Type-Options",
        "Cookie Security",
        "CORS Policy"
      ].includes(check.name)
  );

  let recommendation;

  if (securityScore >= 90) {
    recommendation =
      "Excellent security baseline. Continue monitoring security headers, browser protections and configuration changes regularly.";
  } else if (securityScore >= 80) {
    recommendation =
      "Good security baseline. Review the remaining findings and continue regular security monitoring.";
  } else if (securityScore >= 60) {
    recommendation =
      "The website has several security improvements available. Prioritize warnings and review the informational findings.";
  } else if (securityScore >= 40) {
    recommendation =
      "The website has important security improvements available. Prioritize the warning findings and apply defensive fixes.";
  } else {
    recommendation =
      "The website has significant security weaknesses in the checked areas. Prioritize the highest-risk findings before making the website publicly available.";
  }

  const priorityFindings = warnings
    .map((check, index) => ({
      priority: index + 1,
      title: check.name,
      status: check.status,
      message: check.message,
      fix:
        check.fix ||
        "Review this security configuration and apply an appropriate defensive fix."
    }));

  const informationalFindings = info.map(check => ({
    title: check.name,
    status: check.status,
    message: check.message,
    fix: check.fix || ""
  }));

  const passedChecks = passed.map(check => ({
    title: check.name,
    status: check.status,
    message: check.message
  }));

  return res.status(200).json({
    success: true,

    product: "Sentinel AI",

    report: {
      website,
      securityScore,
      riskLevel,
      scanId: scanId || null,

      generatedAt: new Date().toISOString(),

      executiveSummary: {
        overallRisk: riskLevel,
        securityScore,
        totalChecks: checks.length,
        passed: passed.length,
        warnings: warnings.length,
        informational: info.length,
        priorityIssues: criticalFindings.length
      },

      priorityFindings,

      passedChecks,

      informationalFindings,

      recommendations: [
        recommendation,
        "Keep HTTPS enabled across the entire website.",
        "Review security headers after major website changes.",
        "Apply fixes in priority order and re-scan after changes.",
        "Monitor security configuration regularly.",
        "Only test websites you own or are authorized to assess."
      ],

      nextSteps: [
        "Review all WARNING findings.",
        "Apply the recommended defensive fixes.",
        "Re-scan the website after configuration changes.",
        "Compare the new security score with the previous scan.",
        "Continue monitoring the security baseline."
      ],

      limitations: [
        "This report checks publicly observable HTTPS and security configuration signals.",
        "It does not perform exploitation or unauthorized penetration testing.",
        "A complete professional security assessment may require additional application, infrastructure and manual testing."
      ],

      disclaimer:
        "Sentinel AI provides automated security-awareness checks and defensive guidance. This report is not a complete penetration test, vulnerability assessment or professional security audit."
    }
  });
}
