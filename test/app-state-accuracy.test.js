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

test("monitoring dashboard does not claim scheduled scans are active before worker setup", () => {
  assert.ok(app.includes("Automated scans are not active on this deployment yet."));
  assert.ok(app.includes("after the monitoring worker is configured."));
  assert.ok(!app.includes("scheduled security checks run every 15 minutes."));
  assert.ok(!app.includes("scheduled for automatic checks every 15 minutes"));
});

test("monitoring page and verification API describe scheduler activation honestly", () => {
  assert.ok(page.includes("automated monitoring is not active on this deployment yet."));
  assert.ok(page.includes("Scheduled scans will begin only after the monitoring worker is configured."));
  assert.ok(monitoringApi.includes("Automated scans are not active on this deployment yet; scheduled checks will begin after the monitoring worker is configured."));
  assert.ok(!page.includes("Automated 15-minute scheduling is active."));
  assert.ok(!monitoringApi.includes("next 15-minute run"));
});
