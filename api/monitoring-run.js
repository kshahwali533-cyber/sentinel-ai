import { createSupabaseAdmin } from "./_lib/supabase-admin.js";
import { getMonitoringAppOrigin, isValidMonitoringWorkerSecret } from "./_lib/monitoring.js";
import { processMonitoringQueue } from "./_lib/monitoring-worker.js";

const supabaseAdmin = createSupabaseAdmin();

function appOrigin(req) {
  return getMonitoringAppOrigin({
    productionUrl: process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : undefined,
    forwardedHost: req.headers["x-forwarded-host"] || req.headers.host
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;
  const providedSecret = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!isValidMonitoringWorkerSecret(providedSecret, secret)) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  if (!supabaseAdmin) return res.status(503).json({ error: "Monitoring worker is not configured." });

  try {
    const summary = await processMonitoringQueue({
      supabaseAdmin,
      origin: appOrigin(req),
      secret
    });
    return res.status(200).json({ ok: summary.persistenceFailures === 0, ...summary });
  } catch (error) {
    console.error("Sentinel monitoring worker error:", error);
    return res.status(500).json({
      error: "Monitoring worker failed safely.",
      claimed: 0,
      succeeded: 0,
      failed: 0,
      alerts: 0,
      retries: 0
    });
  }
}
