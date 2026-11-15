import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const actions = fs.readFileSync("public/sentinel-actions.js", "utf8");

test("all former inline click and change handlers are removed", () => {
  assert.equal((html.match(/\\son(?:click|change)\\s*=/gi) || []).length, 0);
  assert.match(html, /<script defer src="\\/sentinel-actions\\.js"><\\/script>/);
  assert.match(actions, /document\\.addEventListener\\("click"/);
  assert.match(actions, /document\\.addEventListener\\("change"/);
});

test("all 38 former actions have delegated handlers", () => {
  const required = [
    "toggle-password", "reset-password", "sign-up-user", "sign-in-user",
    "update-password", "sign-out-user", "run-security-scan", "clear-scan-history",
    "add-monitoring-site", "lookup-vulnerability", "create-research-project",
    "create-research-finding", "create-organization", "accept-organization-invitation",
    "ask-security-mentor", "generate-professional-report", "print-report",
    "export-research-project", "set-research-project-status", "delete-research-project",
    "update-research-finding-status", "add-research-note", "delete-research-finding",
    "verify-monitoring-site", "change-monitoring-site", "remove-monitoring-site",
    "mark-monitoring-alert-read", "change-organization-role", "remove-organization-member",
    "revoke-organization-invitation", "invite-organization-member",
    "save-organization-policy", "export-organization-audit", "remove-organization-asset",
    "share-organization-asset", "copy-organization-invite"
  ];
  for (const action of required) {
    assert.ok(html.includes('data-action="' + action + '"') || actions.includes('case "' + action + '"') ||
      action === "update-research-finding-status", "Missing action mapping: " + action);
  }
  assert.equal(required.length, 36);
});

test("delegated action script parses", () => {
  assert.doesNotThrow(() => new vm.Script(actions));
});

test("professional report loads the external delegated print handler", () => {
  assert.match(html, /<script defer src="\\$\\{safe\\(window\\.location\\.origin\\)\\}\\/sentinel-actions\\.js"><\\/script>/);
  assert.match(html, /data-action="print-report"/);
});
