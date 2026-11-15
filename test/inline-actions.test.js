import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const actions = fs.readFileSync("sentinel-actions.js", "utf8");

test("all former inline click and change handlers are removed", () => {
  assert.equal((html.match(/\son(?:click|change)\s*=/gi) || []).length, 0);
  assert.equal((html.match(/data-action="/g) || []).length, 38);
  assert.match(html, /<script defer src="\/sentinel-actions\.js"><\/script>/);
  assert.match(actions, /document\.addEventListener\("click"/);
  assert.match(actions, /document\.addEventListener\("change"/);
});

test("all delegated UI actions are represented", () => {
  const declared = new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]));
  const clickCases = new Set([...actions.matchAll(/case "([^"]+)"/g)].map((match) => match[1]));
  for (const action of declared) {
    assert.ok(clickCases.has(action) || action === "update-research-finding-status",
      "Missing delegated handler: " + action);
  }
  assert.equal(declared.size, 36);
});

test("delegated action script parses", () => {
  assert.doesNotThrow(() => new vm.Script(actions));
});

test("professional report loads the external delegated print handler", () => {
  assert.ok(html.includes('<script defer src="$' + '{safe(window.location.origin)}/sentinel-actions.js"><\\/script>'));
  assert.match(html, /data-action="print-report"/);
});
