import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../sentinel-app.js", import.meta.url), "utf8");

test("research exports exclude evidence and private notes unless the user opts in", () => {
  assert.match(page, /id="researchExportIncludeEvidence" type="checkbox"/);
  assert.match(page, /id="researchExportIncludeNotes" type="checkbox"/);
  assert.match(app, /researchExportIncludeEvidence.*checked === true/);
  assert.match(app, /researchExportIncludeNotes.*checked === true/);
  assert.match(app, /if \(includeEvidence\)/);
  assert.match(app, /if \(includeNotes\)/);
});

test("exports require an explicit warning confirmation when private material is included", () => {
  assert.match(app, /private evidence or research notes/);
  assert.match(app, /review and redact before external disclosure/i);
});

test("common credential patterns are redacted before copying the report", () => {
  for (const pattern of ["Bearer", "api[_ -]?key", "AKIA", "gh[pousr]_", "eyJ"]) {
    assert.ok(app.includes(pattern), pattern);
  }
  assert.match(app, /redactResearchExportText/);
});
