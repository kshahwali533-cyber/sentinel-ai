import { timingSafeEqual } from "node:crypto";

import net from "node:net";

export function normalizeMonitoringTarget(value) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("Enter a valid HTTPS website address.");
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid HTTPS website address.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    net.isIP(hostname) ||
    !hostname.includes(".") ||
    /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(hostname)
  ) {
    throw new Error("Monitoring requires a public HTTPS domain on its standard port.");
  }

  parsed.hash = "";
  return { url: parsed.toString(), hostname };
}


export const MONITORING_INTERVAL_MINUTES = 15;

export function getNextMonitoringScanAt(now = new Date()) {
  const base = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(base.getTime())) {
    throw new Error("A valid monitoring timestamp is required.");
  }
  return new Date(
    base.getTime() + MONITORING_INTERVAL_MINUTES * 60 * 1000
  ).toISOString();
}

export function getMonitoringAppOrigin({ productionUrl, forwardedHost } = {}) {
  const host = typeof productionUrl === "string" && productionUrl.trim()
    ? productionUrl.trim()
    : forwardedHost;
  if (typeof host !== "string" || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    throw new Error("Application host is unavailable.");
  }
  return "https://" + host;
}

export function riskRank(value) {
  const risk = String(value || "").toLowerCase();
  if (risk.includes("critical")) return 4;
  if (risk.includes("high")) return 3;
  if (risk.includes("medium")) return 2;
  if (risk.includes("low")) return 1;
  return 0;
}

export function warningNames(result) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  return checks
    .filter((check) => ["WARN", "WARNING", "FAIL", "FAILED"].includes(String(check?.status || "").toUpperCase()))
    .map((check) => String(check?.name || check?.title || check?.id || "Security check").slice(0, 120));
}

export function buildMonitoringAlert(previous, current) {
  if (!previous || typeof previous !== "object") return null;
  const oldWarnings = new Set(warningNames(previous));
  const newWarnings = warningNames(current).filter((name) => !oldWarnings.has(name));
  const oldScore = Number(previous.score ?? previous.securityScore);
  const newScore = Number(current.score ?? current.securityScore);
  const scoreDrop = Number.isFinite(oldScore) && Number.isFinite(newScore) && oldScore - newScore >= 10;
  const riskWorsened = riskRank(current.riskLevel) > riskRank(previous.riskLevel);
  if (!newWarnings.length && !scoreDrop && !riskWorsened) return null;

  const severity = riskRank(current.riskLevel) >= 3 || (scoreDrop && oldScore - newScore >= 20) ? "high" : "medium";
  const reasons = [];
  if (newWarnings.length) reasons.push(newWarnings.length + " new warning(s): " + newWarnings.slice(0, 5).join(", "));
  if (scoreDrop) reasons.push("security score dropped from " + oldScore + " to " + newScore);
  if (riskWorsened) reasons.push("risk level worsened from " + (previous.riskLevel || "unknown") + " to " + (current.riskLevel || "unknown"));
  return {
    alert_type: "security_posture_changed",
    severity,
    title: "Website security posture changed",
    message: reasons.join("; ").slice(0, 1900),
    details: {
      previous_score: Number.isFinite(oldScore) ? oldScore : null,
      current_score: Number.isFinite(newScore) ? newScore : null,
      previous_risk: previous.riskLevel || null,
      current_risk: current.riskLevel || null,
      new_warnings: newWarnings.slice(0, 20)
    }
  };
}

export function isValidMonitoringWorkerSecret(provided, expected) {
  if (typeof expected !== "string" || !expected ||
      typeof provided !== "string" || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);
}

export async function fetchMonitoringScan(
  fetchImpl,
  scanUrl,
  targetUrl,
  secret,
  options = {}
) {
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 45000;
  const wait = typeof options.wait === "function"
    ? options.wait
    : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(scanUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sentinel-monitor-worker": secret
        },
        body: JSON.stringify({ url: targetUrl }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const scan = await response.json().catch(() => ({}));
      if (response.ok && Number.isFinite(Number(scan.score ?? scan.securityScore))) {
        return { scan, attempts: attempt + 1 };
      }
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new Error("MONITORING_SCAN_HTTP_" + response.status);
      lastError.retryable = retryable;
      if (!retryable) throw lastError;
    } catch (error) {
      if (error?.message?.startsWith("MONITORING_SCAN_HTTP_") &&
          error?.retryable === false) throw error;
      lastError = error;
    }
    if (attempt === 0) await wait(1000);
  }

  throw lastError || new Error("MONITORING_SCAN_FAILED");
}
