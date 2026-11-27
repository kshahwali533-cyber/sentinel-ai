import { createSupabaseAdmin } from "./_lib/supabase-admin.js";
import { getMonitoringAppOrigin, isValidMonitoringWorkerSecret } from "./_lib/monitoring.js";
import { processMonitoringQueue } from "./_lib/monitoring-worker.js";

export function createMonitoringWorkerHandler({
  supabaseAdmin = createSupabaseAdmin(),
  fetchImpl = fetch,
  waitImpl,
  env = process.env,
  now
} = {}) {
  function appOrigin(req) {
    return getMonitoringAppOrigin({
      productionUrl: env.VERCEL_ENV === "production"
        ? env.VERCEL_PROJECT_PRODUCTION_URL
        : undefined,
      forwardedHost: req.headers["x-forwarded-host"] || req.headers.host
    });
  }

  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const secret = env.CRON_SECRET;
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
        fetchImpl,
        waitImpl,
        origin: appOrigin(req),
        secret,
        ...(typeof now === "function" ? { now } : {})
      });
      const { persistenceFailures, ...publicSummary } = summary;
      return res.status(200).json({
        ok: persistenceFailures === 0,
        ...publicSummary,
        ...(persistenceFailures > 0 ? { persistenceFailures } : {})
      });
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
  };
}

export default createMonitoringWorkerHandler();
