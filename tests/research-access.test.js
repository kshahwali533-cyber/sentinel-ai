import test from "node:test";
import assert from "node:assert/strict";
import { loadResearchCaseWorkspace } from "../api/_lib/research-access.js";

const cases = [
  { id: "case-a", owner_user_id: "user-a", title: "A case" },
  { id: "case-b", owner_user_id: "user-b", title: "B case" }
];
const assignments = [
  { case_id: "case-b", reviewer_user_id: "user-a", status: "active" },
  { case_id: "case-a", reviewer_user_id: "user-b", status: "active" },
  { case_id: "case-c", reviewer_user_id: "user-a", status: "revoked" }
];
const approvals = [
  { id: "approval-a", case_id: "case-a", reviewer_user_id: "user-b" },
  { id: "approval-b", case_id: "case-b", reviewer_user_id: "user-a" }
];
const events = [
  { id: "event-a", case_id: "case-a" },
  { id: "event-b", case_id: "case-b" },
  { id: "event-c", case_id: "case-c" }
];

function fakeClient() {
  return {
    from(table) {
      const query = { filters: [], table };
      query.select = () => query;
      query.eq = (field, value) => { query.filters.push(row => row[field] === value); return query; };
      query.in = (field, values) => { query.filters.push(row => values.includes(row[field])); return query; };
      query.order = () => query;
      query.limit = () => query;
      query.then = (resolve, reject) => {
        const source = table === "research_cases" ? cases
          : table === "research_case_reviewers" ? assignments
          : table === "research_case_approvals" ? approvals
          : table === "research_case_events" ? events : [];
        const data = source.filter(row => query.filters.every(filter => filter(row)));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      };
      return query;
    }
  };
}

test("two-user isolation: each owner sees their own cases and only cases assigned to them", async () => {
  const client = fakeClient();
  const [userA, userB] = await Promise.all([
    loadResearchCaseWorkspace(client, "user-a"),
    loadResearchCaseWorkspace(client, "user-b")
  ]);
  assert.deepEqual(userA.research_cases.map(item => [item.id, item.viewer_role]).sort(), [
    ["case-a", "owner"], ["case-b", "reviewer"]
  ]);
  assert.deepEqual(userB.research_cases.map(item => [item.id, item.viewer_role]).sort(), [
    ["case-a", "reviewer"], ["case-b", "owner"]
  ]);
});

test("two-user isolation: approvals and audit events are restricted to owned or assigned cases", async () => {
  const client = fakeClient();
  const [userA, userB] = await Promise.all([
    loadResearchCaseWorkspace(client, "user-a"),
    loadResearchCaseWorkspace(client, "user-b")
  ]);
  assert.deepEqual(userA.case_events.map(item => item.case_id).sort(), ["case-a", "case-b"]);
  assert.deepEqual(userB.case_events.map(item => item.case_id).sort(), ["case-a", "case-b"]);
  assert.deepEqual(userA.case_approvals.map(item => item.case_id), ["case-a"]);
  assert.deepEqual(userA.reviewer_approvals.map(item => item.case_id), ["case-b"]);
  assert.deepEqual(userB.case_approvals.map(item => item.case_id), ["case-b"]);
  assert.deepEqual(userB.reviewer_approvals.map(item => item.case_id), ["case-a"]);
  assert.equal(userA.research_cases.some(item => item.id === "case-c"), false);
  assert.equal(userB.research_cases.some(item => item.id === "case-c"), false);
});

test("revoked reviewer assignments do not expose a reviewer's case details", async () => {
  const workspace = await loadResearchCaseWorkspace(fakeClient(), "user-a");
  assert.equal(workspace.research_cases.some(item => item.id === "case-c"), false);
});
