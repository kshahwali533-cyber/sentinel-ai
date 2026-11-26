import { createClient } from "@supabase/supabase-js";
import { normalizeOrganizationPolicy } from "./_lib/organization-policies.js";
import { isWithinJsonBodyLimit } from "./_lib/request-size.js";

// Bound incoming JSON before route-specific work.
export const config = { api: { bodyParser: { sizeLimit: "32kb" } } };

const admin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function reply(res, status, body) {
  return res.status(status).json(body);
}

async function getUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data?.user || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!admin) return reply(res, 503, { error: "Workspace administration is not configured." });
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return reply(res, 405, { error: "Method not allowed." });
  }

  if (req.method === "POST" && req.body != null && !isWithinJsonBodyLimit(req.body, 16384)) {
    return reply(res, 413, { error: "Workspace policy request is too large." });
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

    const { data: policy, error: policyError } = await admin.from("organization_policies")
      .select("allow_member_invites,allow_asset_sharing,audit_export_enabled,updated_at")
      .eq("organization_id", orgId).maybeSingle();
    if (policyError) throw policyError;
    const effectivePolicy = policy || {
      allow_member_invites: true,
      allow_asset_sharing: true,
      audit_export_enabled: true,
      updated_at: null
    };

    if (req.method === "GET") {
      return reply(res, 200, {
        policy: effectivePolicy,
        my_role: membership.role,
        can_manage: membership.role === "owner"
      });
    }

    if (body.action === "update_policy") {
      if (membership.role !== "owner") return reply(res, 403, { error: "Only the workspace owner can change security policies." });
      let normalizedPolicy;
      try {
        normalizedPolicy = normalizeOrganizationPolicy(body);
      } catch (error) {
        return reply(res, 400, { error: error.message });
      }
      const now = new Date().toISOString();
      const { data, error } = await admin.from("organization_policies").upsert({
        organization_id: orgId,
        ...normalizedPolicy,
        updated_by: user.id,
        updated_at: now
      }).select("allow_member_invites,allow_asset_sharing,audit_export_enabled,updated_at").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("organization_audit_events").insert({
        organization_id: orgId,
        actor_user_id: user.id,
        event_type: "workspace.security_policy_updated",
        details: {
          allow_member_invites: data.allow_member_invites,
          allow_asset_sharing: data.allow_asset_sharing,
          audit_export_enabled: data.audit_export_enabled
        }
      });
      if (auditError) console.error("Workspace policy audit event failed:", auditError);
      return reply(res, 200, { policy: data });
    }

    if (body.action === "export_audit") {
      if (!["owner", "admin"].includes(membership.role)) return reply(res, 403, { error: "Only workspace owners and admins can export audit events." });
      if (!effectivePolicy.audit_export_enabled) return reply(res, 403, { error: "Audit export is disabled by the workspace owner." });
      const { data: organization, error: organizationError } = await admin.from("organizations")
        .select("name,slug").eq("id", orgId).single();
      if (organizationError) throw organizationError;
      const { data: events, error: eventsError } = await admin.from("organization_audit_events")
        .select("id,actor_user_id,event_type,target_user_id,details,created_at")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1000);
      if (eventsError) throw eventsError;
      const { error: auditError } = await admin.from("organization_audit_events").insert({
        organization_id: orgId,
        actor_user_id: user.id,
        event_type: "workspace.audit_exported",
        details: { exported_rows: (events || []).length, format: "json" }
      });
      if (auditError) console.error("Audit export event failed:", auditError);
      return reply(res, 200, {
        exported_at: new Date().toISOString(),
        organization,
        count: (events || []).length,
        events: events || [],
        truncated: (events || []).length === 1000
      });
    }

    return reply(res, 400, { error: "Unsupported workspace administration action." });
  } catch (error) {
    console.error("Sentinel organization admin API error:", error);
    return reply(res, 500, { error: "Unable to process the workspace administration request safely." });
  }
}
