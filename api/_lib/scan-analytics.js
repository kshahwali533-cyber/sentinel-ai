function safeScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

function riskBucket(value) {
  const risk = String(value || "").toLowerCase();
  if (risk.includes("critical")) return "critical";
  if (risk.includes("high")) return "high";
  if (risk.includes("medium")) return "medium";
  if (risk.includes("low")) return "low";
  return "unknown";
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hostnameOf(value) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Aggregate only the authenticated owner's recent scan rows.
 * Results are descriptive analytics, not a security verdict.
 */
export function aggregateScanAnalytics(rows, now = Date.now()) {
  const source = Array.isArray(rows) ? rows.slice(0, 200) : [];
  const sorted = [...source].sort((a, b) => {
    const aTime = Date.parse(a?.created_at || "") || 0;
    const bTime = Date.parse(b?.created_at || "") || 0;
    return bTime - aTime;
  });

  const scores = sorted.map((row) => safeScore(row?.security_score)).filter((value) => value !== null);
  const risks = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const domains = new Set();
  const warningCounts = new Map();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  let scansLast7Days = 0;
  let highRiskScans = 0;

  for (const row of sorted) {
    const risk = riskBucket(row?.risk_level);
    risks[risk] += 1;
    if (risk === "high" || risk === "critical") highRiskScans += 1;

    const timestamp = Date.parse(row?.created_at || "");
    if (Number.isFinite(timestamp) && timestamp >= sevenDaysAgo && timestamp <= now) {
      scansLast7Days += 1;
    }

    const hostname = hostnameOf(row?.website);
    if (hostname) domains.add(hostname);

    const seenInScan = new Set();
    for (const check of Array.isArray(row?.checks) ? row.checks : []) {
      const status = String(check?.status || "").toUpperCase();
      const name = String(check?.name || check?.title || "").trim().slice(0, 120);
      if (!name || !["WARN", "WARNING", "FAIL", "FAILED"].includes(status) || seenInScan.has(name)) continue;
      seenInScan.add(name);
      warningCounts.set(name, (warningCounts.get(name) || 0) + 1);
    }
  }

  const latestFive = sorted.slice(0, 5).map((row) => safeScore(row?.security_score)).filter((value) => value !== null);
  const previousFive = sorted.slice(5, 10).map((row) => safeScore(row?.security_score)).filter((value) => value !== null);
  let trend = { direction: "insufficient_data", change: null, latest_average: null, previous_average: null };
  if (latestFive.length >= 3 && previousFive.length >= 3) {
    const latestAverage = average(latestFive);
    const previousAverage = average(previousFive);
    const change = Math.round((latestAverage - previousAverage) * 10) / 10;
    trend = {
      direction: change >= 3 ? "improving" : change <= -3 ? "declining" : "stable",
      change,
      latest_average: Math.round(latestAverage * 10) / 10,
      previous_average: Math.round(previousAverage * 10) / 10
    };
  }

  const topWarnings = [...warningCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);

  return {
    records_analyzed: sorted.length,
    total_scans: sorted.length,
    average_score: scores.length ? Math.round(average(scores)) : null,
    valid_score_count: scores.length,
    high_risk_scans: highRiskScans,
    scans_last_7_days: scansLast7Days,
    unique_domains: domains.size,
    latest_scan_at: sorted[0]?.created_at || null,
    risk_breakdown: risks,
    trend,
    recurring_warnings: topWarnings
  };
}
