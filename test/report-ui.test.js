import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
  .filter((match) => !/\\bsrc\\s*=/.test(match[1]))
  .filter((match) => !/type\\s*=\\s*["']application\\/(?:json|ld\\+json)["']/i.test(match[1]))
  .map((match) => match[2])
  .filter((source) => source.trim());

test("inline browser scripts parse without syntax errors", () => {
  assert.ok(scripts.length > 0, "Expected inline application scripts in index.html");
  for (const [index, source] of scripts.entries()) {
    assert.doesNotThrow(() => new vm.Script(source), `inline script ${index + 1} should parse`);
  }
});

test("professional report waits for the API and does not open an empty popup", () => {
  const start = html.indexOf("async function generateProfessionalReport(button) {");
  const end = html.indexOf("/* =========================\\n   LOCAL + CLOUD SCAN HISTORY", start);
  assert.notEqual(start, -1, "report function should exist");
  assert.notEqual(end, -1, "report function end should be identifiable");
  const fn = html.slice(start, end);
  assert.ok(fn.includes('fetch("/api/report"'), "report should request the report API");
  assert.ok(fn.indexOf("await fetch") < fn.indexOf("window.location.assign"), "report should wait for the API before navigating");
  assert.ok(fn.includes("payload.success") && fn.includes("payload.report"), "report should validate the API response");
  assert.ok(!fn.includes("window.open("), "report should not open a blank popup");
  assert.ok(fn.includes("Report generation failed"), "API errors should be shown to the user");
});
