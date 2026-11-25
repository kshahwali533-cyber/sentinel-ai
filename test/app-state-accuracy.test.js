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

test("monitoring dashboard accurately describes the active scheduler and pending first run", () => {
  assert.ok(app.includes("scheduled for automatic checks every 15 minutes"));
  assert.ok(app.includes("Confirm the first successful monitoring run in Monitoring Activity."));
  assert.ok(!app.includes("Automated scans are not active on this deployment yet."));
});

test("monitoring page and verification API accurately describe scheduler activation", () => {
  assert.ok(page.includes("The 15-minute scheduler is active; scheduled scans begin after a domain is verified."));
  assert.ok(page.includes("Monitoring runs and in-app alerts will appear after the first successful scan."));
  assert.equal((page.match(/name="sentinel-ai-verification"/g) || []).length, 1);
  assert.ok(monitoringApi.includes("Scheduled security checks will begin on the next 15-minute run."));
  assert.ok(!page.includes("worker is configured."));
  assert.ok(!monitoringApi.includes("worker is configured."));
});
