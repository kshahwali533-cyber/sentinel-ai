import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("sentinel-app.js", "utf8");
const analytics = fs.readFileSync("sentinel-analytics.js", "utf8");
const scripts = [app, analytics];

test("external browser scripts parse without inline scripts", () => {
  assert.equal([...html.matchAll(/<script\\b(?![^>]*\\bsrc=)[^>]*>/gi)].length, 0);
  assert.ok(scripts.length > 0, "Expected external application scripts");
  for (const source of scripts) {
    assert.doesNotThrow(() => new vm.Script(source), "External browser script should parse");
  }
});

test("professional report waits for the API and does not open an empty popup", () => {
  const start = app.indexOf("async function generateProfessionalReport(button) {");
  const end = app.indexOf("LOCAL + CLOUD SCAN HISTORY", start);
  assert.notEqual(start, -1, "report function should exist");
  assert.notEqual(end, -1, "report function end should be identifiable");
  const fn = app.slice(start, end);
  assert.ok(fn.includes('fetch("/api/report"'), "report should request the report API");
  assert.ok(fn.indexOf("await fetch") < fn.indexOf("window.location.assign"), "report should wait for the API before navigating");
  assert.ok(fn.includes("payload.success") && fn.includes("payload.report"), "report should validate the API response");
  assert.ok(!fn.includes("window.open("), "report should not open a blank popup");
  assert.ok(fn.includes("Report generation failed"), "API errors should be shown to the user");
});
