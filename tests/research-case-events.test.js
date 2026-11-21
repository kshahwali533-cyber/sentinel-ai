import test from "node:test";
import assert from "node:assert/strict";
import { recordResearchCaseEvent } from "../api/_lib/research-case-events.js";

test("writes a bounded, structured research audit event", async () => {
  let received;
  const client = {
    from(table) {
      assert.equal(table, "research_case_events");
      return {
        async insert(row) {
          received = row;
          return { error: null };
        }
      };
    }
  };
  await recordResearchCaseEvent(client, {
    caseId: "case-1",
    actorUserId: "user-2",
    eventType: "case.reviewed",
    details: { decision: "authorized" }
  });
  assert.deepEqual(received, {
    case_id: "case-1",
    actor_user_id: "user-2",
    event_type: "case.reviewed",
    details: { decision: "authorized" }
  });
});

test("does not silently swallow audit persistence errors", async () => {
  const client = {
    from() {
      return {
        async insert() {
          return { error: { message: "database unavailable" } };
        }
      };
    }
  };
  await assert.rejects(
    recordResearchCaseEvent(client, {
      caseId: "case-1",
      actorUserId: "user-2",
      eventType: "plan.revoked"
    }),
    error => error.code === "RESEARCH_AUDIT_WRITE_FAILED"
  );
});

test("rejects malformed event data before touching the database", async () => {
  let touched = false;
  const client = { from() { touched = true; throw new Error("should not be called"); } };
  await assert.rejects(recordResearchCaseEvent(client, { caseId: "", eventType: "x" }), TypeError);
  assert.equal(touched, false);
});
