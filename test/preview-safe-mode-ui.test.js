import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("sentinel-app.js", "utf8");
const page = fs.readFileSync("index.html", "utf8");

test("Preview mode fails closed unless the server approves Production", () => {
  assert.match(app, /window\.SENTINEL_RUNTIME_CONFIG\?\.isProduction !== true/);
  assert.ok(app.includes("SENTINEL AI PREVIEW SAFE MODE:") || app.includes("Preview Safe Mode is active."));
});

test("Preview scan guard runs before any scanner request", () => {
  const start = app.indexOf("async function runSecurityScan");
  assert.ok(start >= 0);
  const body = app.slice(start, start + 1400);
  const guard = body.indexOf("if (IS_PREVIEW_SAFE_MODE)");
  const request = body.indexOf('fetch(\n        "/api/scan"');
  assert.ok(guard >= 0, "Preview scan guard must exist");
  assert.ok(request > guard, "Preview guard must run before the scanner request");
  assert.ok(body.includes("No scan request was sent."));
});

test("Preview mode disables account-backed controls and marks private features unavailable", () => {
  assert.ok(app.includes('button[data-action]:not([data-action="run-security-scan"])'));
  assert.ok(app.includes("button.disabled = true;"));
  for (const id of ["analyticsStatus", "monitorStatus", "monitorAlerts", "researchStatus", "organizationStatus", "usageStatus"]) {
    assert.ok(app.includes(id + ":"), `Preview mode must mark ${id} unavailable`);
  }
});

test("server-issued runtime config loads before the application script", () => {
  const configIndex = page.indexOf('/api/scan?runtime_config=1');
  const appIndex = page.indexOf('/sentinel-app.js');
  assert.ok(configIndex >= 0 && appIndex > configIndex);
  assert.ok(page.includes('id="authIntro"'));
});
