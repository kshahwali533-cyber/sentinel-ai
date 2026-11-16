/**
 * Calculate a conservative security-configuration score.
 * INFO checks are neutral; only PASS and WARNING checks affect the score.
 */
export function calculateScanScore(checks) {
  if (!Array.isArray(checks)) {
    throw new TypeError("checks must be an array.");
  }

  const statuses = checks.map(check => String(check?.status || "").toUpperCase());
  const passed = statuses.filter(status => status === "PASS" || status === "PASSED").length;
  const warnings = statuses.filter(status => status === "WARNING" || status === "WARN").length;
  const informational = statuses.filter(status => status === "INFO" || status === "INFORMATIONAL").length;
  const scoredChecks = passed + warnings;

  const score = scoredChecks === 0
    ? 0
    : Math.max(0, Math.min(100, Math.round((passed / scoredChecks) * 100)));

  let riskLevel = "Low";
  if (score < 50 || warnings >= 5) {
    riskLevel = "High";
  } else if (score < 75 || warnings >= 2) {
    riskLevel = "Medium";
  }

  return {
    totalChecks: checks.length,
    passed,
    warnings,
    informational,
    score,
    riskLevel
  };
}
