import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const actions = fs.readFileSync("sentinel-actions.js", "utf8");
const app = fs.readFileSync("sentinel-app.js", "utf8");
const styles = fs.readFileSync("sentinel.css", "utf8");
const reportStyles = fs.readFileSync("sentinel-report.css", "utf8");
const supabaseVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).dependencies["@supabase/supabase-js"];

test("all former inline click and change handlers are removed", () => {
  assert.equal((html.match(/\son(?:click|change)\s*=/gi) || []).length, 0);
  assert.equal(((html + app).match(/data-action="/g) || []).length, 52);
  assert.match(html, /<script defer src="\/sentinel-actions\.js"><\/script>/);
  assert.match(actions, /document\.addEventListener\("click"/);
  assert.match(actions, /document\.addEventListener\("change"/);
});

test("all delegated UI actions are represented", () => {
  const declared = new Set([...(html + app).matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]));
  const clickCases = new Set([...actions.matchAll(/case "([^"]+)"/g)].map((match) => match[1]));
  for (const action of declared) {
    assert.ok(clickCases.has(action) || action === "update-research-finding-status",
      "Missing delegated handler: " + action);
  }
  assert.equal(declared.size, 48);
  assert.ok(declared.has("verify-monitoring-file"));
});

test("professional report includes safe CSV export and report data payload", () => {
  assert.match(app, /id="sentinelReportData"/);
  assert.match(app, /data-action="export-security-report-csv"/);
  assert.match(actions, /function exportSecurityReportCsv/);
  assert.match(actions, /if \(\/\^\\s\*\[=\+@\\-\]\/\.test\(text\)\)/);
});

test("Supabase SDK is deferred so it does not block initial HTML parsing", () => {
  assert.match(html, new RegExp('<script defer src="https://cdn\\.jsdelivr\\.net/npm/@supabase/supabase-js@' + supabaseVersion + '" integrity="sha384-[A-Za-z0-9+/]{64}" crossorigin="anonymous"><\\/script>'));
});

test("delegated action script parses", () => {
  assert.doesNotThrow(() => new vm.Script(actions));
});

test("main application script parses after Research Lab workflow integration", () => {
  assert.doesNotThrow(() => new vm.Script(app));
  for (const name of [
    "renderResearchCaseWorkflow",
    "createResearchCase",
    "assignResearchReviewer",
    "submitResearchCase",
    "reviewResearchCase",
    "revokeResearchCase",
    "revokeResearchReviewer",
    "requestResearchPlanApproval",
    "decideResearchPlanApproval",
    "revokeResearchPlanApproval",
    "checkResearchScope"
  ]) {
    assert.match(app, new RegExp("function " + name + "\\("), name);
  }
});

test("all application scripts and styles are external", () => {
  assert.equal([...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/gi)].length, 0);
  assert.equal([...html.matchAll(/<style\b/gi)].length, 0);
  assert.equal([...html.matchAll(/\sstyle\s*=/gi)].length, 0);
  assert.match(html, /href="\/sentinel\.css"/);
  assert.match(html, /src="\/sentinel-app\.js"/);
  assert.match(html, /src="\/sentinel-analytics\.js"/);
  assert.doesNotMatch(cspPolicy(), /'unsafe-inline'/);
  assert.doesNotMatch(app, /\.style\.display\s*=/);
  assert.match(styles, /\.is-hidden\s*\{/);
  assert.match(app, /sentinel-report\.css/);
  assert.match(reportStyles, /@media print/);
});

function cspPolicy() {
  const config = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  return config.headers.find((item) => item.source === "/(.*)").headers
    .find((item) => item.key.toLowerCase() === "content-security-policy").value;
}

test("professional report loads the external delegated print handler", () => {
  assert.match(app, /sentinel-actions\.js/);
  assert.match(app, /data-action="print-report"/);
});
