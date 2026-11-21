import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../api/research.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261120115348_sentinel_research_authorization_foundation.sql", import.meta.url), "utf8");

test("research case lists are filtered to the signed-in owner", () => {
  assert.match(api, /from\("research_cases"\)[\s\S]{0,700}?eq\("owner_user_id", user\.id\)/);
});

test("reviewer case lists and approvals are filtered to the signed-in reviewer", () => {
  assert.match(api, /from\("research_case_reviewers"\)[\s\S]{0,350}?eq\("reviewer_user_id", user\.id\)/);
  assert.match(api, /from\("research_case_approvals"\)[\s\S]{0,350}?eq\("reviewer_user_id", user\.id\)/);
});

test("audit events are only fetched for owner or assigned-reviewer case IDs", () => {
  assert.match(api, /accessibleCaseIds = \[\.\.\.new Set\(\[\.\.\.ownedCaseIds, \.\.\.assignedCaseIds\]\)\]/);
  assert.match(api, /from\("research_case_events"\)[\s\S]{0,350}?in\("case_id", accessibleCaseIds\)/);
});

test("reviewers cannot approve their own case and must have an active assignment", () => {
  assert.match(api, /researchCase\.owner_user_id === user\.id/);
  assert.match(api, /eq\("reviewer_user_id", user\.id\)\.eq\("status", "active"\)/);
});

test("research authorization tables remain RLS enabled and client-inaccessible", () => {
  for (const table of ["research_cases", "research_case_reviewers", "research_case_approvals", "research_case_events"]) {
    assert.match(migration, new RegExp("alter table public\." + table + " enable row level security"));
    assert.match(migration, new RegExp("revoke all on public\." + table + " from anon, authenticated"));
  }
});

test("every case lifecycle event uses the checked audit writer", () => {
  assert.match(api, /recordResearchCaseEvent\(supabaseAdmin/);
  assert.doesNotMatch(api, /from\("research_case_events"\)\.insert/);
  assert.match(api, /RESEARCH_AUDIT_WRITE_FAILED/);
});
