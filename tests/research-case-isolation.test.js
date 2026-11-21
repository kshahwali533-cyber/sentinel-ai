import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../api/research.js", import.meta.url), "utf8");
const access = readFileSync(new URL("../api/_lib/research-access.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261120115348_sentinel_research_authorization_foundation.sql", import.meta.url), "utf8");

test("research workspace loader filters owned cases by authenticated owner ID", () => {
  assert.match(access, /from\("research_cases"\)[\s\S]{0,700}?eq\("owner_user_id", userId\)/);
});

test("reviewer assignments and approvals are filtered by authenticated reviewer ID", () => {
  assert.match(access, /from\("research_case_reviewers"\)[\s\S]{0,350}?eq\("reviewer_user_id", userId\)/);
  assert.match(access, /from\("research_case_approvals"\)[\s\S]{0,500}?eq\("reviewer_user_id", userId\)/);
  assert.match(access, /from\("research_case_reviewers"\)[\s\S]{0,350}?in\("case_id", ownedCaseIds\)/);
});

test("audit events are only fetched for owned or actively assigned case IDs", () => {
  assert.match(access, /assignedCaseIds = \(reviewerAssignments\.data \|\| \[\]\)[\s\S]{0,150}?filter\(item => item\.status === "active"\)/);
  assert.match(access, /accessibleCaseIds = \[\.\.\.new Set\(\[\.\.\.ownedCaseIds, \.\.\.assignedCaseIds\]\)\]/);
  assert.match(access, /from\("research_case_events"\)[\s\S]{0,350}?in\("case_id", accessibleCaseIds\)/);
});

test("API loads the tested workspace access boundary and blocks self-approval", () => {
  assert.match(api, /loadResearchCaseWorkspace\(supabaseAdmin, user\.id\)/);
  assert.match(api, /researchCase\.owner_user_id === user\.id/);
  assert.match(api, /eq\("reviewer_user_id", user\.id\)\.eq\("status", "active"\)/);
});

test("research authorization tables remain RLS enabled and client-inaccessible", () => {
  for (const table of ["research_cases", "research_case_reviewers", "research_case_approvals", "research_case_events"]) {
    assert.ok(migration.includes("alter table public." + table + " enable row level security"), table);
    assert.ok(migration.includes("revoke all on public." + table + " from anon, authenticated"), table);
  }
});

test("every case lifecycle event uses the checked audit writer", () => {
  assert.match(api, /recordResearchCaseEvent\(supabaseAdmin/);
  assert.doesNotMatch(api, /from\("research_case_events"\)\.insert/);
  assert.match(api, /RESEARCH_AUDIT_WRITE_FAILED/);
});
