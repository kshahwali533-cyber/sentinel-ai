import test from "node:test";
import assert from "node:assert/strict";
import { aggregateScanAnalytics } from "../api/_lib/scan-analytics.js";

const now = Date.parse("2026-11-14T12:00:00Z");

test("empty history returns a safe zero-state summary", () => {
  const result = aggregateScanAnalytics([], now);
  assert.equal(result.total_scans, 0);
  assert.equal(result.average_score, null);
  assert.equal(result.scans_last_7_days, 0);
  assert.equal(result.unique_domains, 0);
  assert.equal(result.trend.direction, "insufficient_data");
});

test("aggregates score, risk, recent scans and unique domains", () => {
  const rows = [
    { website: "https://a.example.com", security_score: 70, risk_level: "High", created_at: "2026-11-14T10:00:00Z", checks: [] },
    { website: "https://a.example.com/path", security_score: 90, risk_level: "Low", created_at: "2026-11-13T10:00:00Z", checks: [] },
    { website: "https://b.example.com", security_score: 80, risk_level: "Medium", created_at: "2026-11-01T10:00:00Z", checks: [] }
  ];
  const result = aggregateScanAnalytics(rows, now);
  assert.equal(result.total_scans, 3);
  assert.equal(result.average_score, 80);
  assert.equal(result.high_risk_scans, 1);
  assert.equal(result.scans_last_7_days, 2);
  assert.equal(result.unique_domains, 2);
  assert.equal(result.risk_breakdown.medium, 1);
});

test("score trend compares the latest five scans with the prior five", () => {
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push({
    website: "https://site.example",
    security_score: 90,
    risk_level: "Low",
    created_at: new Date(now - i * 60_000).toISOString(),
    checks: []
  });
  for (let i = 5; i < 10; i++) rows.push({
    website: "https://site.example",
    security_score: 70,
    risk_level: "Medium",
    created_at: new Date(now - i * 60_000).toISOString(),
    checks: []
  });
  const result = aggregateScanAnalytics(rows, now);
  assert.equal(result.trend.direction, "improving");
  assert.equal(result.trend.change, 20);
});

test("recurring warnings count each check once per scan", () => {
  const rows = [
    { website: "https://site.example", security_score: 60, risk_level: "High", created_at: "2026-11-14T10:00:00Z", checks: [
      { name: "HSTS", status: "WARNING" },
      { name: "HSTS", status: "WARNING" },
      { name: "CSP", status: "INFO" }
    ] },
    { website: "https://site.example", security_score: 60, risk_level: "High", created_at: "2026-11-13T10:00:00Z", checks: [
      { name: "HSTS", status: "WARNING" }
    ] }
  ];
  const result = aggregateScanAnalytics(rows, now);
  assert.deepEqual(result.recurring_warnings, [{ name: "HSTS", count: 2 }]);
});

test("invalid scores and malformed website URLs are ignored safely", () => {
  const result = aggregateScanAnalytics([
    { website: "javascript:alert(1)", security_score: 120, risk_level: "Unknown", created_at: "bad-date", checks: [] }
  ], now);
  assert.equal(result.average_score, null);
  assert.equal(result.unique_domains, 0);
  assert.equal(result.valid_score_count, 0);
});
