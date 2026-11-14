import { createClient } from "@supabase/supabase-js";
import { buildMonitoringAlert } from "./_lib/monitoring.js";

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

function appOrigin(req) {
  if (process.env.VERCEL_URL) return "https://" + process.env.VERCEL_URL;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (typeof host !== "string" || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    throw new Error("Application host is unavailable.");
  }
  return "https://" + host;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== "Bearer " + secret) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  if (!supabaseAdmin) return res.status(503).json({ error: "Monitoring worker is not configured." });

  let claimed = [];
  const summary = { claimed: 0, succeeded: 0, failed: 0, alerts: 0 };
  try {
    const { data, error } = await supabaseAdmin.rpc("claim_due_monitoring_sites", { p_limit: 3 });
    if (error) throw error;
    claimed = data || [];
    summary.claimed = claimed.length;
    const origin = appOrigin(req);

    for (const site of claimed) {
      let runId = null;
      try {
        const { data: run, error: runError } = await supabaseAdmin.from("monitoring_runs")
          .insert({ site_id: site.site_id, user_id: site.owner_id, status: "running" })
          .select("id").single();
        if (runError) throw runError;
        runId = run.id;

        const response = await fetch(origin + "/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json", "x-sentinel-monitor-worker": "1" },
          body: JSON.stringify({ url: site.target_url }),
          signal: AbortSignal.timeout(90000)
        });
        const scan = await response.json().catch(() => ({}));
        if (!response.ok || !Number.isFinite(Number(scan.score ?? scan.securityScore))) {
          throw new Error("SCAN_FAILED");
        }

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
        const now = new Date().toISOString();

        if (alert) {
          const { error: alertError } = await supabaseAdmin.from("monitoring_alerts")
            .insert({ site_id: site.site_id, user_id: site.owner_id, run_id: runId, ...alert });
          if (alertError) throw alertError;
          summary.alerts += 1;
        }

        const { error: updateSiteError } = await supabaseAdmin.from("monitoring_sites")
          .update({
            last_scan_at: now,
            last_score: score,
            last_risk_level: riskLevel,
            last_result: snapshot,
            next_scan_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            updated_at: now
          }).eq("id", site.site_id);
        if (updateSiteError) throw updateSiteError;

        const { error: updateRunError } = await supabaseAdmin.from("monitoring_runs")
          .update({
            status: "succeeded",
            score,
            risk_level: riskLevel,
            result: snapshot,
            finished_at: now
          }).eq("id", runId);
        if (updateRunError) throw updateRunError;

        summary.succeeded += 1;
      } catch (error) {
        console.error("Monitoring site run failed:", site.site_id, error);
        const now = new Date().toISOString();
        if (runId) {
          await supabaseAdmin.from("monitoring_runs").update({
            status: "failed",
            error_code: "MONITORING_SCAN_FAILED",
            finished_at: now
          }).eq("id", runId);
        }
        await supabaseAdmin.from("monitoring_sites").update({
          next_scan_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: now
        }).eq("id", site.site_id);
        summary.failed += 1;
      }
    }

    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    console.error("Sentinel monitoring worker error:", error);
    return res.status(500).json({ error: "Monitoring worker failed safely.", ...summary });
  }
}
