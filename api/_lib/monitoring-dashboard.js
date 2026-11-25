export async function getMonitoringDashboardData(supabaseAdmin, userId) {
  const [sites, alerts, runs] = await Promise.all([
    supabaseAdmin.from("monitoring_sites")
      .select("id,url,hostname,status,verification_token,verified_at,scan_interval_minutes,next_scan_at,last_scan_at,last_score,last_risk_level,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("monitoring_alerts")
      .select("id,site_id,alert_type,severity,title,message,details,is_read,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("monitoring_runs")
      .select("id,site_id,status,score,risk_level,error_code,started_at,finished_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(30)
  ]);

  const failed = [sites.error, alerts.error, runs.error].find(Boolean);
  if (failed) throw failed;

  const safeSites = (sites.data || []).map((site) => {
    if (site.status === "pending") return site;
    const { verification_token, ...safeSite } = site;
    return safeSite;
  });

  return {
    sites: safeSites,
    alerts: alerts.data || [],
    runs: runs.data || []
  };
}
