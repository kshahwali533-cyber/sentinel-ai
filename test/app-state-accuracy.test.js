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

test("monitoring dashboard does not claim an unconfigured schedule is active", () => {
  assert.ok(!app.includes("Monitoring is ready. Verified websites are checked every 15 minutes."));
  assert.ok(app.includes("Automatic 15-minute checks are not active in this deployment."));
  assert.ok(app.includes("Automatic 15-minute execution is pending scheduler activation"));
});

test("monitoring page and verification API describe scheduler activation honestly", () => {
  assert.ok(page.includes("Automated 15-minute scheduling is pending activation."));
  assert.ok(!page.includes("with automated checks every 15 minutes."));
  assert.ok(monitoringApi.includes("ready for scheduled monitoring once the scheduler is activated"));
  assert.ok(!monitoringApi.includes("15-minute monitoring is enabled."));
});
