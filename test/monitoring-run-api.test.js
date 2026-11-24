import assert from "node:assert/strict";
import test from "node:test";

const previous = {
  cron: process.env.CRON_SECRET,
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY
};
delete process.env.CRON_SECRET;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { default: handler, createMonitoringWorkerHandler } = await import("../api/monitoring-run.js");

for (const [key, value] of [
  ["CRON_SECRET", previous.cron],
  ["SUPABASE_URL", previous.supabaseUrl],
  ["SUPABASE_SERVICE_ROLE_KEY", previous.serviceRole]
]) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function invoke(worker, method, authorization) {
  let statusCode = null;
  let payload = null;
  let allow = null;
  const res = {
    setHeader(name, value) {
      if (name.toLowerCase() === "allow") allow = value;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    }
  };
  await worker({ method, headers: { authorization, host: "preview.sentinel.test" } }, res);
  return { statusCode, payload, allow };
}

test("monitoring worker accepts only GET requests", async () => {
  const result = await invoke(handler, "POST", undefined);
  assert.equal(result.statusCode, 405);
  assert.equal(result.allow, "GET");
});

test("monitoring worker rejects requests when CRON_SECRET is absent", async () => {
  const worker = createMonitoringWorkerHandler({ supabaseAdmin: {}, env: {} });
  const result = await invoke(worker, "GET", undefined);
  assert.equal(result.statusCode, 401);
  assert.match(result.payload.error, /Unauthorized/);
});

test("monitoring worker refuses to run without Supabase service configuration", async () => {
  const worker = createMonitoringWorkerHandler({
    supabaseAdmin: null,
    env: { CRON_SECRET: "test-only-cron-secret" }
  });
  const result = await invoke(worker, "GET", "Bearer test-only-cron-secret");
  assert.equal(result.statusCode, 503);
  assert.match(result.payload.error, /not configured/i);
});

test("monitoring worker rejects an incorrect bearer secret before accessing Supabase", async () => {
  const worker = createMonitoringWorkerHandler({
    supabaseAdmin: { rpc() { throw new Error("must not be called"); } },
    env: { CRON_SECRET: "expected-test-secret" }
  });
  const result = await invoke(worker, "GET", "Bearer wrong-test-secret");
  assert.equal(result.statusCode, 401);
  assert.match(result.payload.error, /Unauthorized/);
});

test("monitoring worker rejects non-string authorization headers", async () => {
  const worker = createMonitoringWorkerHandler({
    supabaseAdmin: {},
    env: { CRON_SECRET: "expected-test-secret" }
  });
  const result = await invoke(worker, "GET", ["Bearer expected-test-secret"]);
  assert.equal(result.statusCode, 401);
  assert.match(result.payload.error, /Unauthorized/);
});

test("monitoring worker completes a claimed scan, records a change alert, and updates both records", async () => {
  const writes = [];
  const site = {
    site_id: "site-test-1",
    owner_id: "user-test-1",
    target_url: "https://owned.example",
    prior_result: {
      score: 92,
      riskLevel: "Low",
      checks: [{ name: "HSTS", status: "PASS" }]
    }
  };
  const admin = {
    async rpc(name, args) {
      assert.equal(name, "claim_due_monitoring_sites");
      assert.deepEqual(args, { p_limit: 3 });
      return { data: [site], error: null };
    },
    from(table) {
      return {
        insert(record) {
          writes.push({ operation: "insert", table, record });
          return {
            select() {
              return {
                async single() {
                  assert.equal(table, "monitoring_runs");
                  return { data: { id: "run-test-1" }, error: null };
                }
              };
            },
            then(resolve, reject) {
              return Promise.resolve({ error: null }).then(resolve, reject);
            }
          };
        },
        update(record) {
          return {
            async eq(column, value) {
              writes.push({ operation: "update", table, column, value, record });
              return { error: null };
            }
          };
        }
      };
    }
  };
  const fetchCalls = [];
  const fakeFetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          score: 64,
          riskLevel: "High",
          website: "https://owned.example/",
          checks: [
            { name: "HSTS", status: "WARNING" },
            { name: "CSP", status: "PASS" }
          ]
        };
      }
    };
  };
  const worker = createMonitoringWorkerHandler({
    supabaseAdmin: admin,
    fetchImpl: fakeFetch,
    env: { CRON_SECRET: "isolated-test-secret", VERCEL_ENV: "preview" }
  });

  const result = await invoke(worker, "GET", "Bearer isolated-test-secret");

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload, {
    ok: true,
    claimed: 1,
    succeeded: 1,
    failed: 0,
    alerts: 1,
    retries: 0
  });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://preview.sentinel.test/api/scan");
  assert.equal(fetchCalls[0].options.method, "POST");
  assert.equal(fetchCalls[0].options.headers["x-sentinel-monitor-worker"], "isolated-test-secret");
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { url: "https://owned.example" });

  const runInsert = writes.find((entry) => entry.operation === "insert" && entry.table === "monitoring_runs");
  assert.deepEqual(runInsert.record, {
    site_id: "site-test-1",
    user_id: "user-test-1",
    status: "running"
  });

  const alertInsert = writes.find((entry) => entry.operation === "insert" && entry.table === "monitoring_alerts");
  assert.equal(alertInsert.record.site_id, "site-test-1");
  assert.equal(alertInsert.record.user_id, "user-test-1");
  assert.equal(alertInsert.record.run_id, "run-test-1");
  assert.equal(alertInsert.record.alert_type, "security_posture_changed");
  assert.equal(alertInsert.record.severity, "high");
  assert.match(alertInsert.record.message, /HSTS/);

  const siteUpdate = writes.find((entry) => entry.operation === "update" && entry.table === "monitoring_sites");
  assert.equal(siteUpdate.column, "id");
  assert.equal(siteUpdate.value, "site-test-1");
  assert.equal(siteUpdate.record.last_score, 64);
  assert.equal(siteUpdate.record.last_risk_level, "High");
  assert.equal(siteUpdate.record.last_result.checks[0].status, "WARNING");
  assert.ok(Date.parse(siteUpdate.record.next_scan_at) > Date.now());

  const runUpdate = writes.find((entry) => entry.operation === "update" &&
    entry.table === "monitoring_runs" && entry.record.status === "succeeded");
  assert.equal(runUpdate.column, "id");
  assert.equal(runUpdate.value, "run-test-1");
  assert.equal(runUpdate.record.score, 64);
  assert.equal(runUpdate.record.risk_level, "High");
  assert.equal(runUpdate.record.result.score, 64);
  assert.ok(runUpdate.record.finished_at);
});


test("monitoring worker marks a run failed and reschedules after repeated scan failure", async () => {
  const writes = [];
  const admin = {
    async rpc(name) {
      assert.equal(name, "claim_due_monitoring_sites");
      return {
        data: [{
          site_id: "site-failure-1",
          owner_id: "user-failure-1",
          target_url: "https://owned.example",
          prior_result: { score: 90, riskLevel: "Low", checks: [] }
        }],
        error: null
      };
    },
    from(table) {
      return {
        insert(record) {
          writes.push({ operation: "insert", table, record });
          return {
            select() {
              return {
                async single() {
                  return { data: { id: "run-failure-1" }, error: null };
                }
              };
            },
            then(resolve, reject) {
              return Promise.resolve({ error: null }).then(resolve, reject);
            }
          };
        },
        update(record) {
          return {
            async eq(column, value) {
              writes.push({ operation: "update", table, column, value, record });
              return { error: null };
            }
          };
        }
      };
    }
  };
  let scanCalls = 0;
  const worker = createMonitoringWorkerHandler({
    supabaseAdmin: admin,
    fetchImpl: async () => {
      scanCalls += 1;
      return { ok: false, status: 503, async json() { return {}; } };
    },
    waitImpl: async () => {},
    env: { CRON_SECRET: "failure-test-secret", VERCEL_ENV: "preview" }
  });

  const result = await invoke(worker, "GET", "Bearer failure-test-secret");

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload, {
    ok: true,
    claimed: 1,
    succeeded: 0,
    failed: 1,
    alerts: 0,
    retries: 0
  });
  assert.equal(scanCalls, 2);
  assert.equal(writes.filter((entry) => entry.operation === "insert" && entry.table === "monitoring_alerts").length, 0);

  const failedRun = writes.find((entry) => entry.operation === "update" &&
    entry.table === "monitoring_runs" && entry.record.status === "failed");
  assert.equal(failedRun.value, "run-failure-1");
  assert.equal(failedRun.record.error_code, "MONITORING_SCAN_FAILED");
  assert.ok(failedRun.record.finished_at);

  const rescheduledSite = writes.find((entry) => entry.operation === "update" && entry.table === "monitoring_sites");
  assert.equal(rescheduledSite.value, "site-failure-1");
  assert.ok(Date.parse(rescheduledSite.record.next_scan_at) > Date.now());
});
