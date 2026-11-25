import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { processMonitoringQueue } from "../api/_lib/monitoring-worker.js";

function createMemorySupabase(site) {
  const tables = {
    monitoring_sites: [structuredClone(site)],
    monitoring_runs: [],
    monitoring_alerts: []
  };
  let runSequence = 0;

  const client = {
    tables,
    async rpc(name, args) {
      assert.equal(name, "claim_due_monitoring_sites");
      assert.equal(args.p_limit, 3);
      const current = tables.monitoring_sites[0];
      return {
        data: current.status === "active" ? [{
          site_id: current.id,
          owner_id: current.user_id,
          target_url: current.url,
          prior_result: structuredClone(current.last_result)
        }] : [],
        error: null
      };
    },
    from(table) {
      return {
        insert(payload) {
          const row = structuredClone(payload);
          if (table === "monitoring_runs") {
            row.id = "run-" + (++runSequence);
            tables[table].push(row);
            return {
              select() {
                return {
                  single: async () => ({ data: { id: row.id }, error: null })
                };
              }
            };
          }
          tables[table].push(row);
          return Promise.resolve({ data: row, error: null });
        },
        update(patch) {
          return {
            eq: async (column, value) => {
              const row = tables[table].find((item) => item[column] === value);
              if (!row) return { data: null, error: new Error("row not found") };
              Object.assign(row, structuredClone(patch));
              return { data: row, error: null };
            }
          };
        }
      };
    }
  };
  return client;
}

const baseline = {
  score: 90,
  securityScore: 90,
  riskLevel: "Low",
  checks: [{ name: "HSTS", status: "PASS" }]
};

test("monitoring worker persists a risk-only alert and updates the dashboard source data", async () => {
  const db = createMemorySupabase({
    id: "site-1",
    user_id: "user-1",
    url: "https://owned.example",
    status: "active",
    last_result: baseline
  });
  const fixedNow = () => new Date("2026-11-26T12:00:00.000Z");
  const fakeFetch = async (url, options) => {
    assert.equal(url, "https://sentinel.example/api/scan");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["x-sentinel-monitor-worker"], "test-secret");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        website: "https://owned.example",
        score: 90,
        riskLevel: "Medium",
        checks: [{ name: "HSTS", status: "PASS" }]
      })
    };
  };

  const summary = await processMonitoringQueue({
    supabaseAdmin: db,
    fetchImpl: fakeFetch,
    origin: "https://sentinel.example",
    secret: "test-secret",
    now: fixedNow
  });

  assert.deepEqual(summary, {
    claimed: 1,
    succeeded: 1,
    failed: 0,
    alerts: 1,
    retries: 0
  });
  assert.equal(db.tables.monitoring_alerts.length, 1);
  assert.equal(db.tables.monitoring_alerts[0].severity, "medium");
  assert.match(db.tables.monitoring_alerts[0].message, /risk level worsened from Low to Medium/);
  assert.equal(db.tables.monitoring_runs[0].status, "succeeded");
  assert.equal(db.tables.monitoring_sites[0].last_risk_level, "Medium");
  assert.equal(db.tables.monitoring_sites[0].last_result.riskLevel, "Medium");
});

test("unchanged follow-up scan does not create a duplicate alert", async () => {
  const db = createMemorySupabase({
    id: "site-1",
    user_id: "user-1",
    url: "https://owned.example",
    status: "active",
    last_result: { ...baseline, riskLevel: "Medium" }
  });
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      website: "https://owned.example",
      score: 90,
      riskLevel: "Medium",
      checks: [{ name: "HSTS", status: "PASS" }]
    })
  });

  const summary = await processMonitoringQueue({
    supabaseAdmin: db,
    fetchImpl: fakeFetch,
    origin: "https://sentinel.example",
    secret: "test-secret",
    now: () => new Date("2026-11-26T12:15:00.000Z")
  });

  assert.equal(summary.succeeded, 1);
  assert.equal(summary.alerts, 0);
  assert.equal(db.tables.monitoring_alerts.length, 0);
});

test("the real dashboard renderer displays saved alerts and safely escapes untrusted text", async () => {
  const source = await readFile(new URL("../sentinel-app.js", import.meta.url), "utf8");
  const start = source.indexOf("function renderMonitoringDashboard(data) {");
  const end = source.indexOf("\nasync function loadMonitoringDashboard()", start);
  assert.notEqual(start, -1, "dashboard renderer exists");
  assert.notEqual(end, -1, "dashboard renderer boundary exists");
  const rendererSource = source.slice(start, end);
  const nodes = {
    monitorSites: { innerHTML: "" },
    monitorAlerts: { innerHTML: "" },
    monitorRuns: { innerHTML: "" }
  };
  const document = { getElementById: (id) => nodes[id] || null };
  const escapeHTML = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const monitoringDate = () => "Test date";
  const renderMonitoringDashboard = new Function(
    "document",
    "escapeHTML",
    "monitoringDate",
    rendererSource + "\\nreturn renderMonitoringDashboard;"
  )(document, escapeHTML, monitoringDate);
  renderMonitoringDashboard({
    sites: [],
    runs: [],
    alerts: [{
      id: "alert-1",
      title: "Website security posture changed",
      severity: "medium",
      message: "<script>alert(1)</script> risk increased",
      is_read: false,
      created_at: "2026-11-26T12:00:00.000Z"
    }]
  });

  assert.match(nodes.monitorAlerts.innerHTML, /Website security posture changed/);
  assert.match(nodes.monitorAlerts.innerHTML, /medium/);
  assert.match(nodes.monitorAlerts.innerHTML, /data-action="mark-monitoring-alert-read"/);
  assert.match(nodes.monitorAlerts.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(nodes.monitorAlerts.innerHTML, /<script>/);
});
