import {
  buildMonitoringAlert,
  fetchMonitoringScan,
  getNextMonitoringScanAt
} from "./monitoring.js";

export async function processMonitoringQueue({
  supabaseAdmin,
  fetchImpl = fetch,
  origin,
  secret,
  now = () => new Date()
}) {
  const summary = { claimed: 0, succeeded: 0, failed: 0, alerts: 0, retries: 0, persistenceFailures: 0 };
  const { data, error } = await supabaseAdmin.rpc("claim_due_monitoring_sites", { p_limit: 3 });
  if (error) throw error;

  const claimed = data || [];
  summary.claimed = claimed.length;

  for (const site of claimed) {
    let runId = null;
    try {
      const { data: run, error: runError } = await supabaseAdmin.from("monitoring_runs")
        .insert({ site_id: site.site_id, user_id: site.owner_id, status: "running" })
        .select("id").single();
      if (runError) throw runError;
      runId = run.id;

      const scanResult = await fetchMonitoringScan(
        fetchImpl,
        origin + "/api/scan",
        site.target_url,
        secret
      );
      const scan = scanResult.scan;
      summary.retries += Math.max(0, scanResult.attempts - 1);

      const score = Math.max(0, Math.min(100, Math.round(Number(scan.score ?? scan.securityScore))));
      const riskLevel = String(scan.riskLevel || "Unknown").slice(0, 40);
      const snapshot = {
        website: String(scan.website || scan.finalUrl || site.target_url).slice(0, 2048),
        score,
        securityScore: score,
        riskLevel,
        checks: (Array.isArray(scan.checks) ? scan.checks : []).slice(0, 100).map((check) => ({
          name: String(check?.name || check?.title || "Security check").slice(0, 120),
          status: String(check?.status || "INFO").slice(0, 20)
        }))
      };
      const alert = buildMonitoringAlert(site.prior_result, snapshot);
      const timestamp = now().toISOString();

      if (alert) {
        const { error: alertError } = await supabaseAdmin.from("monitoring_alerts")
          .insert({ site_id: site.site_id, user_id: site.owner_id, run_id: runId, ...alert });
        if (alertError) throw alertError;
        summary.alerts += 1;
      }

      const { error: updateSiteError } = await supabaseAdmin.from("monitoring_sites")
        .update({
          last_scan_at: timestamp,
          last_score: score,
          last_risk_level: riskLevel,
          last_result: snapshot,
          next_scan_at: getNextMonitoringScanAt(now()),
          updated_at: timestamp
        }).eq("id", site.site_id);
      if (updateSiteError) throw updateSiteError;

      const { error: updateRunError } = await supabaseAdmin.from("monitoring_runs")
        .update({
          status: "succeeded",
          score,
          risk_level: riskLevel,
          result: snapshot,
          finished_at: timestamp
        }).eq("id", runId);
      if (updateRunError) throw updateRunError;

      summary.succeeded += 1;
    } catch (error) {
      console.error("Monitoring site run failed:", site.site_id, error);
      const timestamp = now().toISOString();
      if (runId) {
        try {
          const { error: failedRunError } = await supabaseAdmin.from("monitoring_runs").update({
            status: "failed",
            error_code: "MONITORING_SCAN_FAILED",
            finished_at: timestamp
          }).eq("id", runId);
          if (failedRunError) {
            summary.persistenceFailures += 1;
            console.error("Monitoring run failure status could not be persisted:", runId, failedRunError);
          }
        } catch (persistenceError) {
          summary.persistenceFailures += 1;
          console.error("Monitoring run failure status could not be persisted:", runId, persistenceError);
        }
      }
      try {
        const { error: rescheduleError } = await supabaseAdmin.from("monitoring_sites").update({
          next_scan_at: getNextMonitoringScanAt(now()),
          updated_at: timestamp
        }).eq("id", site.site_id);
        if (rescheduleError) {
          summary.persistenceFailures += 1;
          console.error("Monitoring site could not be rescheduled after failure:", site.site_id, rescheduleError);
        }
      } catch (persistenceError) {
        summary.persistenceFailures += 1;
        console.error("Monitoring site could not be rescheduled after failure:", site.site_id, persistenceError);
      }
      summary.failed += 1;
    }
  }

  return summary;
}
