import { createSupabaseAdmin } from "./_lib/supabase-admin.js";
import { aggregateScanAnalytics } from "./_lib/scan-analytics.js";

const supabaseAdmin = createSupabaseAdmin();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Analytics service is not configured." });
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Please sign in to view analytics." });

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id) {
      return res.status(401).json({ error: "Your session is invalid or has expired." });
    }

    const { data, error } = await supabaseAdmin
      .from("scan_history")
      .select("website,security_score,risk_level,checks,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      scope: "your_account",
      window: "latest_200_scans",
      analytics: aggregateScanAnalytics(data || [])
    });
  } catch (error) {
    console.error("Sentinel analytics API error:", error);
    return res.status(500).json({ error: "Unable to load scan analytics." });
  }
}
