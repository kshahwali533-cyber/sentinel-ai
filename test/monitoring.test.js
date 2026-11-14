import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMonitoringTarget,
  riskRank,
  warningNames,
  buildMonitoringAlert
} from "../api/_lib/monitoring.js";

test("monitoring accepts standard public HTTPS domains and removes fragments", () => {
  assert.deepEqual(
    normalizeMonitoringTarget("https://Example.org/account#section"),
    { url: "https://example.org/account", hostname: "example.org" }
  );
});

test("monitoring rejects insecure, credentialed, IP and local targets", () => {
  for (const value of [
    "http://example.org",
    "https://user:pass@example.org",
    "https://127.0.0.1",
    "https://localhost",
    "https://service.internal",
    "https://example.org:8443"
  ]) {
    assert.throws(() => normalizeMonitoringTarget(value));
  }
});

test("warning extraction ignores informational and passed checks", () => {
  assert.deepEqual(
    warningNames({ checks: [
      { name: "HSTS", status: "WARNING" },
      { name: "CSP", status: "INFO" },
      { name: "Frame", status: "PASS" }
    ] }),
    ["HSTS"]
  );
});

test("risk ranking is monotonic", () => {
  assert.ok(riskRank("Low") < riskRank("Medium"));
  assert.ok(riskRank("Medium") < riskRank("High"));
  assert.ok(riskRank("High") < riskRank("Critical"));
});

test("first monitoring scan establishes a baseline without an alert", () => {
  assert.equal(buildMonitoringAlert(null, { score: 70, riskLevel: "Medium" }), null);
});

test("unchanged monitoring results do not create noise", () => {
  const baseline = { score: 80, riskLevel: "Low", checks: [{ name: "HSTS", status: "PASS" }] };
  const current = { score: 80, riskLevel: "Low", checks: [{ name: "HSTS", status: "PASS" }] };
  assert.equal(buildMonitoringAlert(baseline, current), null);
});

test("new warnings and material score deterioration create an alert", () => {
  const baseline = { score: 90, riskLevel: "Low", checks: [{ name: "HSTS", status: "PASS" }] };
  const current = { score: 65, riskLevel: "High", checks: [{ name: "HSTS", status: "WARNING" }] };
  const alert = buildMonitoringAlert(baseline, current);
  assert.equal(alert.alert_type, "security_posture_changed");
  assert.equal(alert.severity, "high");
  assert.match(alert.message, /HSTS/);
  assert.equal(alert.details.previous_score, 90);
  assert.equal(alert.details.current_score, 65);
});

test("minor score changes below ten points do not alert by themselves", () => {
  const baseline = { score: 80, riskLevel: "Low", checks: [] };
  const current = { score: 75, riskLevel: "Low", checks: [] };
  assert.equal(buildMonitoringAlert(baseline, current), null);
});
