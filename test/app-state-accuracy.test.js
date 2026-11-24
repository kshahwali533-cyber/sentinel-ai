import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("sentinel-app.js", "utf8");
const page = fs.readFileSync("index.html", "utf8");
const monitoringApi = fs.readFileSync("api/monitoring.js", "utf8");

test("saving a cloud scan refreshes analytics after cloud history", () => {
  const start = app.indexOf("async function saveScanToSupabase");
  const end = app.indexOf("async function loadSupabaseHistory", start);
  assert.notEqual(start, -1, "cloud scan save function must exist");
  assert.ok(end > start, "cloud history function must follow cloud save function");

  const saveFunction = app.slice(start, end);
  const historyRefresh = saveFunction.indexOf("await loadSupabaseHistory()");
  const analyticsRefresh = saveFunction.indexOf("await loadAnalyticsDashboard()");
  assert.ok(historyRefresh !== -1, "cloud history must refresh after a saved scan");
  assert.ok(analyticsRefresh > historyRefresh, "analytics must refresh after cloud history");
});

test("monitoring dashboard accurately describes the active 15-minute scheduler", () => {
  assert.ok(app.includes("scheduled security checks run every 15 minutes."));
  assert.ok(app.includes("Scheduled security checks begin after verification."));
  assert.ok(app.includes("scheduled for automatic checks every 15 minutes"));
  assert.ok(!app.includes("automated runs are not yet active in this deployment"));
});

test("monitoring page and verification API describe scheduler activation honestly", () => {
  assert.ok(page.includes("Automated 15-minute scheduling is active. Verified websites are checked on the next scheduled run."));
  assert.ok(!page.includes("with automated checks every 15 minutes."));
  assert.ok(monitoringApi.includes("Scheduled security checks will begin on the next 15-minute run."));
  assert.ok(!monitoringApi.includes("15-minute monitoring is enabled."));
});


test("protected Preview safe mode uses a release-neutral notice and never starts live scans", () => {
  assert.ok(app.includes("const IS_PREVIEW_SAFE_MODE ="));
  assert.ok(app.includes("SENTINEL AI PREVIEW SAFE MODE:"));
  assert.ok(!app.includes("PR #83 PREVIEW SAFE MODE"));
  assert.match(app, /async function runSecurityScan\(isRescan = false\)\s*\{\s*if \(IS_PREVIEW_SAFE_MODE\)/);
  const start = app.indexOf("async function runSecurityScan");
  const end = app.indexOf("/* =========================", start);
  const scanFunction = app.slice(start, end === -1 ? undefined : end);
  const guard = scanFunction.indexOf("if (IS_PREVIEW_SAFE_MODE)");
  const request = scanFunction.indexOf('fetch(\n        "/api/scan"');
  assert.ok(guard >= 0, "Preview guard must exist in the scan action");
  assert.ok(request > guard, "Preview guard must run before any scanner request");
  assert.ok(scanFunction.includes("No scan request was sent"));
});
