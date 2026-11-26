import assert from "node:assert/strict";
import test from "node:test";

import { processMonitoringQueue } from "../api/_lib/monitoring-worker.js";

function createSupabaseWithFailedPersistence(siteCount = 1) {
  const writes = [];
  return {
    writes,
    async rpc(name) {
      assert.equal(name, "claim_due_monitoring_sites");
      return {
        data: Array.from({ length: siteCount }, (_, index) => ({
          site_id: "site-" + (index + 1),
          owner_id: "user-1",
          target_url: "https://owned.example",
          prior_result: null
        })),
        error: null
      };
    },
    from(table) {
      return {
        insert() {
          assert.equal(table, "monitoring_runs");
          return {
            select() {
              return {
                async single() {
                  return { data: { id: "run-1" }, error: null };
                }
              };
            }
          };
        },
        update(payload) {
          return {
            async eq(column, value) {
              writes.push({ table, payload, column, value });
              return { error: new Error("simulated database write failure") };
            }
          };
        }
      };
    }
  };
}

test("monitoring worker reports failed run and reschedule persistence", async () => {
  const supabaseAdmin = createSupabaseWithFailedPersistence(2);
  const result = await processMonitoringQueue({
    supabaseAdmin,
    origin: "https://sentinel.example",
    secret: "cron-test-secret",
    now: () => new Date("2026-11-26T00:00:00.000Z"),
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() { return {}; }
    })
  });

  assert.equal(result.claimed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.persistenceFailures, 2);
  assert.deepEqual(
    supabaseAdmin.writes.map((write) => write.table),
    ["monitoring_runs", "monitoring_sites"]
  );
});

test("monitoring worker continues processing when failure-state writes fail", async () => {
  const supabaseAdmin = createSupabaseWithFailedPersistence();
  const result = await processMonitoringQueue({
    supabaseAdmin,
    origin: "https://sentinel.example",
    secret: "cron-test-secret",
    now: () => new Date("2026-11-26T00:00:00.000Z"),
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() { return {}; }
    })
  });

  assert.equal(result.claimed, 2);
  assert.equal(result.failed, 2);
  assert.equal(result.persistenceFailures, 4);
});
