import { createSupabaseAdmin } from "./_lib/supabase-admin.js";
import { getUsageMonthStart } from "./_lib/usage-metering.js";

const admin = createSupabaseAdmin();

function reply(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return reply(res, 405, { error: "Method not allowed." });
  }
  if (!admin) return reply(res, 503, { error: "Usage service is not configured." });

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return reply(res, 401, { error: "Please sign in to view account usage." });

  try {
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth?.user?.id) return reply(res, 401, { error: "Your session is invalid. Please sign in again." });

    const userId = auth.user.id;
    const now = new Date();
    const monthStart = getUsageMonthStart(now);

    const [entitlement, scans, reports, mentor] = await Promise.all([
      admin.from("account_entitlements")
        .select("plan_code,status,monthly_scan_limit,created_at,updated_at")
        .eq("user_id", userId).maybeSingle(),
      admin.from("usage_events").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("event_type", "scan.completed").gte("occurred_at", monthStart),
      admin.from("usage_events").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("event_type", "report.generated").gte("occurred_at", monthStart),
      admin.from("usage_events").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("event_type", "mentor.used").gte("occurred_at", monthStart)
    ]);

    const failure = [entitlement.error, scans.error, reports.error, mentor.error].find(Boolean);
    if (failure) throw failure;
    const plan = entitlement.data || { plan_code: "beta", status: "active", monthly_scan_limit: 100 };
    return reply(res, 200, {
      period_start: monthStart,
      plan: plan.plan_code,
      status: plan.status,
      monthly_scan_limit: plan.monthly_scan_limit,
      usage: {
        scans: scans.count || 0,
        reports: reports.count || 0,
        mentor_sessions: mentor.count || 0
      },
      billing: {
        connected: false,
        message: "Beta usage metering only. No subscription or payment is active."
      }
    });
  } catch (error) {
    console.error("Sentinel usage API error:", error);
    return reply(res, 500, { error: "Unable to load account usage safely." });
  }
}
