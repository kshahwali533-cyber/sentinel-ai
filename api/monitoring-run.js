import { createClient } from "@supabase/supabase-js";

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

function riskRank(value) {
  const risk = String(value || "").toLowerCase();
  if (risk.includes("critical")) return 4;
  if (risk.includes("high")) return 3;
  if (risk.includes("medium")) return 2;
  if (risk.includes("low")) return 1;
  return 0;
}

function warningNames(result) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  return checks
    .filter((check) => ["WARN", "WARNING", "FAIL", "FAILED"].includes(String(check?.status || "").toUpperCase()))
    .map((check) => String(check?.name || check?.title || check?.id || "Security check").slice(0, 120));
}

function buildAlert(previous, current) {
  if (!previous || typeof previous !== "object") return null;
  const oldWarnings = new Set(warningNames(previous));
  const newWarnings = warningNames(current).filter((name) => !oldWarnings.has(name));
  const oldScore = Number(previous.score ?? previous.securityScore);
  const newScore = Number(current.score ?? current.securityScore);
  const scoreDrop = Number.isFinite(oldScore) && Number.isFinite(newScore) && oldScore - newScore >= 10;
  const riskWorsened = riskRank(current.riskLevel) > riskRank(previous.riskLevel);
  if (!newWarnings.length && !scoreDrop && !riskWorsened) return null;

  const severity = riskRank(current.riskLevel) >= 3 || (scoreDrop && oldScore - newScore >= 20) ? "high" : "medium";
  const reasons = [];
  if (newWarnings.length) reasons.push(newWarnings.length + " new warning(s): " + newWarnings.slice(0, 5).join(", "));
  if (scoreDrop) reasons.push("security score dropped from " + oldScore + " to " + newScore);
  if (riskWorsened) reasons.push("risk level worsened from " + (previous.riskLevel || "unknown") + " to " + (current.riskLevel || "unknown"));
  return {
    alert_type: "security_posture_changed",
    severity,
    title: "Website security posture changed",
    message: reasons.join("; ").slice(0, 1900),
    details: {
      previous_score: Number.isFinite(oldScore) ? oldScore : null,
      current_score: Number.isFinite(newScore) ? newScore : null,
      previous_risk: previous.riskLevel || null,
      current_risk: current.riskLevel || null,
      new_warnings: newWarnings.slice(0, 20)
    }
  };
}

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
        const alert = buildAlert(site.prior_result, scan);
        const now = new Date().toISOString();
        const { error: updateRunError } = await supabaseAdmin.from("monitoring_runs")
          .update({
            status: "succeeded",
            score,
            risk_level: String(scan.riskLevel || "Unknown").slice(0, 40),
            result: scan,
            finished_at: now
          }).eq("id", runId);
        if (updateRunError) throw updateRunError;

        const { error: updateSiteError } = await supabaseAdmin.from("monitoring_sites")
          .update({
            last_scan_at: now,
            last_score: score,
            last_risk_level: String(scan.riskLevel || "Unknown").slice(0, 40),
            last_result: scan,
            next_scan_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            updated_at: now
          }).eq("id", site.site_id);
        if (updateSiteError) throw updateSiteError;

        if (alert) {
          const { error: alertError } = await supabaseAdmin.from("monitoring_alerts")
            .insert({ site_id: site.site_id, user_id: site.owner_id, run_id: runId, ...alert });
          if (alertError) throw alertError;
          summary.alerts += 1;
        }
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
