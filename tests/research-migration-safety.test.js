import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../docs/AI-RESEARCH-LAB-MIGRATION-DRAFT.sql", import.meta.url), "utf8");
const tables = [
  "research_cases",
  "research_case_notes",
  "research_case_evidence",
  "research_case_approvals",
  "research_case_audit"
];

test("migration is explicitly marked review-only and transaction-wrapped", () => {
  assert.match(sql, /STATUS: REVIEW ONLY — NOT APPLIED/);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /^commit;/m);
});

test("creates each expected table exactly once", () => {
  for (const table of tables) {
    const matches = sql.split("create table public." + table + " (").length - 1;
    assert.equal(matches, 1, table);
  }
});

test("enables RLS on every Research Lab table", () => {
  for (const table of tables) {
    assert.equal(sql.includes("alter table public." + table + " enable row level security;"), true, table);
  }
});

test("client roles cannot write approvals or audit records", () => {
  assert.doesNotMatch(sql, /grant\s+(?:all|insert|update|delete)[^;]*research_case_approvals[^;]*to authenticated/is);
  assert.doesNotMatch(sql, /grant\s+(?:all|insert|update|delete)[^;]*research_case_audit[^;]*to authenticated/is);
  assert.match(sql, /revoke all on table[\s\S]*from public, anon, authenticated;/);
});

test("authorization and scope columns are excluded from client write grants", () => {
  const caseInsert = sql.match(/grant insert \(([^)]*)\)\s+on public\.research_cases to authenticated/i)?.[1] || "";
  const caseUpdate = sql.match(/grant update \(([^)]*)\)\s+on public\.research_cases to authenticated/i)?.[1] || "";
  for (const forbidden of ["authorization_status", "authorized_assets", "allowed_methods", "allowed_test_categories", "scope_starts_at", "scope_expires_at", "result_state", "confidence"]) {
    assert.equal(caseInsert.includes(forbidden), false, forbidden + " insert");
    assert.equal(caseUpdate.includes(forbidden), false, forbidden + " update");
  }
});

test("notes and evidence are client append-only", () => {
  assert.match(sql, /grant select, insert on public\.research_case_notes to authenticated/);
  assert.match(sql, /grant select, insert on public\.research_case_evidence to authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*\bupdate\b[^;]*research_case_(?:notes|evidence)/is);
  assert.doesNotMatch(sql, /grant[^;]*\bdelete\b[^;]*research_case_(?:notes|evidence)/is);
});
