import { randomBytes } from "node:crypto";
import {
  normalizeOrganizationName,
  slugifyOrganizationName,
  hashOrganizationInviteToken,
  isValidOrganizationInviteEmail
} from "./_lib/organizations.js";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

function send(res, status, body) {
  return res.status(status).json(body);
}

async function getUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id || !data.user.email) return null;
  return data.user;
}

async function membership(orgId, userId) {
  const { data, error } = await supabaseAdmin.from("organization_members")
    .select("role").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function audit(orgId, userId, eventType, targetUserId = null, details = {}) {
  const { error } = await supabaseAdmin.from("organization_audit_events").insert({
    organization_id: orgId,
    actor_user_id: userId,
    event_type: eventType,
    target_user_id: targetUserId,
    details
  });
  if (error) throw error;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!supabaseAdmin) return send(res, 503, { error: "Team workspace service is not configured." });
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to use team workspaces." });

    if (req.method === "GET") {
      const { data: memberships, error } = await supabaseAdmin.from("organization_members")
        .select("organization_id,role,joined_at,organizations(id,name,slug,status,created_at)")
        .eq("user_id", user.id).order("joined_at", { ascending: false }).limit(20);
      if (error) throw error;

      const organizations = [];
      for (const item of memberships || []) {
        const org = item.organizations;
        if (!org) continue;
        const [members, invitations, events] = await Promise.all([
          supabaseAdmin.from("organization_members")
            .select("user_id,role,joined_at").eq("organization_id", org.id)
            .order("joined_at", { ascending: true }).limit(100),
          ["owner", "admin"].includes(item.role)
            ? supabaseAdmin.from("organization_invitations")
                .select("id,email,role,expires_at,created_at")
                .eq("organization_id", org.id).is("accepted_at", null)
                .order("created_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [], error: null }),
          ["owner", "admin"].includes(item.role)
            ? supabaseAdmin.from("organization_audit_events")
                .select("id,actor_user_id,event_type,target_user_id,details,created_at")
                .eq("organization_id", org.id).order("created_at", { ascending: false }).limit(30)
            : Promise.resolve({ data: [], error: null })
        ]);
        const failed = [members.error, invitations.error, events.error].find(Boolean);
        if (failed) throw failed;
        organizations.push({
          ...org,
          my_role: item.role,
          members: members.data || [],
          invitations: invitations.data || [],
          audit_events: events.data || []
        });
      }

      const { data: pending, error: pendingError } = await supabaseAdmin.from("organization_invitations")
        .select("id,organization_id,email,role,expires_at,created_at,organizations(name,slug)")
        .ilike("email", user.email).is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(20);
      if (pendingError) throw pendingError;
      return send(res, 200, { organizations, invitations: pending || [] });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const action = body.action;
    const orgId = typeof body.organizationId === "string" ? body.organizationId : "";

    if (action === "create") {
      const name = normalizeOrganizationName(body.name);
      const slug = slugifyOrganizationName(name) + "-" + randomBytes(3).toString("hex");
      const { data, error } = await supabaseAdmin.rpc("create_organization_with_owner", {
        p_user_id: user.id, p_name: name, p_slug: slug
      });
      if (error) throw error;
      return send(res, 201, { organization: data });
    }

    if (action === "accept_invitation") {
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!/^[a-f0-9]{64}$/.test(token)) return send(res, 400, { error: "Invitation token is invalid." });
      const { data, error } = await supabaseAdmin.rpc("accept_organization_invitation", {
        p_user_id: user.id, p_email: user.email, p_token_hash: hashOrganizationInviteToken(token)
      });
      if (error) return send(res, 409, { error: "This invitation is invalid, expired, or belongs to another email address." });
      return send(res, 200, { accepted: true, organizationId: data });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orgId)) return send(res, 400, { error: "A valid workspace ID is required." });
    const actor = await membership(orgId, user.id);
    if (!actor) return send(res, 404, { error: "Workspace not found." });

    if (action === "invite") {
      if (!["owner", "admin"].includes(actor.role)) return send(res, 403, { error: "Only workspace owners and admins can invite members." });
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const role = ["admin", "member", "analyst"].includes(body.role) ? body.role : "member";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        return send(res, 400, { error: "Enter a valid invitation email address." });
      }
      const token = randomBytes(32).toString("hex");
      const { data, error } = await supabaseAdmin.from("organization_invitations").insert({
        organization_id: orgId,
        email,
        role,
        token_hash: hashOrganizationInviteToken(token),
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }).select("id,email,role,expires_at").single();
      if (error) throw error;
      await audit(orgId, user.id, "member.invited", null, { email, role });
      return send(res, 201, { invitation: data, token, delivery: "manual_share" });
    }

    if (action === "change_role") {
      if (actor.role !== "owner") return send(res, 403, { error: "Only the workspace owner can change member roles." });
      const targetUserId = typeof body.userId === "string" ? body.userId : "";
      const role = typeof body.role === "string" ? body.role : "";
      if (!targetUserId || !["admin", "member", "analyst"].includes(role)) {
        return send(res, 400, { error: "Choose a valid member and role." });
      }
      const { data, error } = await supabaseAdmin.from("organization_members")
        .update({ role }).eq("organization_id", orgId).eq("user_id", targetUserId)
        .neq("role", "owner").select("user_id,role").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Member not found or owner role cannot be changed here." });
      await audit(orgId, user.id, "member.role_changed", targetUserId, { role });
      return send(res, 200, { member: data });
    }

    if (action === "remove_member") {
      if (!["owner", "admin"].includes(actor.role)) return send(res, 403, { error: "Only workspace owners and admins can remove members." });
      const targetUserId = typeof body.userId === "string" ? body.userId : "";
      if (!targetUserId || targetUserId === user.id && actor.role === "owner") {
        return send(res, 400, { error: "The owner cannot remove themselves. Transfer ownership first." });
      }
      const { data: target, error: lookupError } = await supabaseAdmin.from("organization_members")
        .select("user_id,role").eq("organization_id", orgId).eq("user_id", targetUserId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!target || target.role === "owner" || actor.role === "admin" && target.role === "admin") {
        return send(res, 404, { error: "Member not found or you do not have permission to remove them." });
      }
      const { error } = await supabaseAdmin.from("organization_members")
        .delete().eq("organization_id", orgId).eq("user_id", targetUserId);
      if (error) throw error;
      await audit(orgId, user.id, "member.removed", targetUserId);
      return send(res, 200, { removed: true });
    }

    if (action === "revoke_invitation") {
      if (!["owner", "admin"].includes(actor.role)) return send(res, 403, { error: "Only workspace owners and admins can revoke invitations." });
      const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
      if (!invitationId) return send(res, 400, { error: "An invitation ID is required." });
      const { data, error } = await supabaseAdmin.from("organization_invitations")
        .delete().eq("id", invitationId).eq("organization_id", orgId)
        .is("accepted_at", null).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Pending invitation not found." });
      await audit(orgId, user.id, "member.invitation_revoked");
      return send(res, 200, { revoked: true });
    }

    return send(res, 400, { error: "Unsupported workspace action." });
  } catch (error) {
    console.error("Sentinel organization API error:", error);
    return send(res, 500, { error: "Unable to process the workspace request safely." });
  }
}
