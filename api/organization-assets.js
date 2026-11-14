import { createClient } from "@supabase/supabase-js";
import { isVerifiedMemberAsset } from "./_lib/team-assets.js";

const admin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function reply(res, status, body) { return res.status(status).json(body); }

async function getUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data?.user || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!admin) return reply(res, 503, { error: "Team asset service is not configured." });
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return reply(res, 405, { error: "Method not allowed." });
  }
  try {
    const user = await getUser(req);
    if (!user) return reply(res, 401, { error: "Please sign in." });
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const orgId = typeof (req.method === "GET" ? req.query?.organizationId : body.organizationId) === "string"
      ? (req.method === "GET" ? req.query.organizationId : body.organizationId) : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orgId)) {
      return reply(res, 400, { error: "A valid workspace ID is required." });
    }
    const { data: membership, error: membershipError } = await admin.from("organization_members")
      .select("role").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return reply(res, 404, { error: "Workspace not found." });

    if (req.method === "GET") {
      const { data: members, error: membersError } = await admin.from("organization_members")
        .select("user_id").eq("organization_id", orgId);
      if (membersError) throw membersError;
      const memberIds = (members || []).map((item) => item.user_id);
      const [shared, available] = await Promise.all([
        admin.from("organization_assets")
          .select("id,created_at,monitoring_site:monitoring_sites(id,url,hostname,status,last_scan_at,last_score,last_risk_level,verified_at)")
          .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50),
        memberIds.length ? admin.from("monitoring_sites")
          .select("id,url,hostname,status,last_scan_at,last_score,last_risk_level,verified_at")
          .in("user_id", memberIds).not("verified_at", "is", null)
          .order("created_at", { ascending: false }).limit(50)
          : Promise.resolve({ data: [], error: null })
      ]);
      const failure = shared.error || available.error;
      if (failure) throw failure;
      const sharedIds = new Set((shared.data || []).map((item) => item.monitoring_site?.id));
      return reply(res, 200, {
        assets: shared.data || [],
        available_assets: (available.data || []).filter((item) => !sharedIds.has(item.id)),
        can_manage: ["owner", "admin"].includes(membership.role)
      });
    }

    if (!["owner", "admin"].includes(membership.role)) {
      return reply(res, 403, { error: "Only workspace owners and admins can manage shared assets." });
    }
    if (body.action === "share") {
      const siteId = typeof body.monitoringSiteId === "string" ? body.monitoringSiteId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId)) {
        return reply(res, 400, { error: "A valid verified monitoring site is required." });
      }
      const { data: site, error: siteError } = await admin.from("monitoring_sites")
        .select("id,user_id,hostname,verified_at").eq("id", siteId)
        .not("verified_at", "is", null).maybeSingle();
      if (siteError) throw siteError;
      if (!site) return reply(res, 404, { error: "Verified monitoring asset not found." });
      const { data: owner, error: ownerError } = await admin.from("organization_members")
        .select("user_id").eq("organization_id", orgId).eq("user_id", site.user_id).maybeSingle();
      if (ownerError) throw ownerError;
      if (!owner || !isVerifiedMemberAsset(site, [owner.user_id])) return reply(res, 403, { error: "Only verified assets owned by a current workspace member can be shared." });
      const { data, error } = await admin.from("organization_assets")
        .insert({ organization_id: orgId, monitoring_site_id: site.id, added_by: user.id })
        .select("id,monitoring_site_id,created_at").single();
      if (error?.code === "23505") return reply(res, 409, { error: "This asset is already shared with the workspace." });
      if (error) throw error;
      const { error: auditError } = await admin.from("organization_audit_events").insert({
        organization_id: orgId, actor_user_id: user.id, target_user_id: site.user_id,
        event_type: "asset.shared", details: { hostname: site.hostname }
      });
      if (auditError) console.error("Team asset audit event failed:", auditError);
      return reply(res, 201, { asset: data });
    }

    if (body.action === "remove") {
      const assetId = typeof body.assetId === "string" ? body.assetId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId)) {
        return reply(res, 400, { error: "A valid shared asset ID is required." });
      }
      const { data, error } = await admin.from("organization_assets").delete()
        .eq("id", assetId).eq("organization_id", orgId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return reply(res, 404, { error: "Shared asset not found." });
      await admin.from("organization_audit_events").insert({
        organization_id: orgId, actor_user_id: user.id, event_type: "asset.removed"
      });
      return reply(res, 200, { removed: true });
    }
    return reply(res, 400, { error: "Unsupported asset action." });
  } catch (error) {
    console.error("Sentinel team asset API error:", error);
    return reply(res, 500, { error: "Unable to process the team asset request safely." });
  }
}
