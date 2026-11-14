import { createClient } from "@supabase/supabase-js";
import {
  normalizeResearchText as textField,
  isValidResearchId as validId,
  sanitizeResearchAssetUrl,
  normalizeResearchEndpointPath as normalizeEndpointPath,
  normalizeResearchEvidence as normalizeEvidence
} from "./_lib/research-validation.js";

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

const FINDING_SELECT =
  "id,project_id,site_id,asset_hostname,asset_url,title,severity,status,endpoint_path,description,impact,remediation,evidence,discovered_at,created_at,updated_at";

function send(res, status, body) {
  return res.status(status).json(body);
}

async function getUser(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!supabaseAdmin) return send(res, 503, { error: "Research workspace is not configured." });
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to use the research workspace." });

    if (req.method === "GET") {
      const [projects, assets, findings, notes] = await Promise.all([
        supabaseAdmin.from("research_projects")
          .select("id,name,description,status,created_at,updated_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabaseAdmin.from("monitoring_sites")
          .select("id,url,hostname,status,verified_at")
          .eq("user_id", user.id).not("verified_at", "is", null)
          .order("created_at", { ascending: false }).limit(50),
        supabaseAdmin.from("research_findings")
          .select(FINDING_SELECT)
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("research_notes")
          .select("id,finding_id,project_id,content,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(200)
      ]);
      const failure = [projects.error, assets.error, findings.error, notes.error].find(Boolean);
      if (failure) throw failure;
      const verifiedAssets = (assets.data || []).map((asset) => ({
        id: asset.id,
        hostname: asset.hostname,
        url: sanitizeResearchAssetUrl(asset.url),
        status: asset.status,
        verified_at: asset.verified_at
      })).filter((asset) => asset.url);
      return send(res, 200, {
        projects: projects.data || [],
        verified_assets: verifiedAssets,
        findings: findings.data || [],
        notes: notes.data || []
      });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const action = body.action;

    if (action === "create_project") {
      const name = textField(body.name, 120, true);
      const description = textField(body.description, 1000);
      if (name === null || description === null) return send(res, 400, { error: "Enter a project name and a description under 1,000 characters." });

      const { count, error: countError } = await supabaseAdmin.from("research_projects")
        .select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (countError) throw countError;
      if ((count || 0) >= 20) return send(res, 429, { error: "The beta limit is 20 research projects per account." });

      const { data, error } = await supabaseAdmin.from("research_projects")
        .insert({ user_id: user.id, name, description })
        .select("id,name,description,status,created_at,updated_at").single();
      if (error?.code === "23505") return send(res, 409, { error: "A project with this name already exists." });
      if (error) throw error;
      return send(res, 201, { project: data });
    }

    if (action === "set_project_status") {
      if (!validId(body.projectId) || !["active", "archived"].includes(body.status)) {
        return send(res, 400, { error: "Choose a valid project and status." });
      }
      const { data, error } = await supabaseAdmin.from("research_projects")
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq("id", body.projectId).eq("user_id", user.id)
        .select("id,name,status").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Research project not found." });
      return send(res, 200, { project: data });
    }

    if (action === "delete_project") {
      if (!validId(body.projectId)) return send(res, 400, { error: "Choose a valid project." });
      const { data, error } = await supabaseAdmin.from("research_projects")
        .delete().eq("id", body.projectId).eq("user_id", user.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Research project not found." });
      return send(res, 200, { deleted: true });
    }

    if (action === "create_finding") {
      if (!validId(body.projectId) || !validId(body.assetId)) {
        return send(res, 400, { error: "Select a research project and a verified website asset." });
      }
      const title = textField(body.title, 160, true);
      const description = textField(body.description, 5000, true);
      const impact = textField(body.impact, 3000);
      const remediation = textField(body.remediation, 3000);
      const severity = ["critical", "high", "medium", "low", "info"].includes(body.severity) ? body.severity : null;
      const evidence = normalizeEvidence(body.evidence);
      if (title === null || description === null || impact === null || remediation === null || !severity || evidence === null) {
        return send(res, 400, { error: "Check the finding title, description, severity, impact, remediation, and evidence fields." });
      }

      const [{ data: project, error: projectError }, { data: asset, error: assetError }] = await Promise.all([
        supabaseAdmin.from("research_projects").select("id")
          .eq("id", body.projectId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabaseAdmin.from("monitoring_sites").select("id,url,hostname,verified_at")
          .eq("id", body.assetId).eq("user_id", user.id).not("verified_at", "is", null).maybeSingle()
      ]);
      if (projectError || assetError) throw projectError || assetError;
      if (!project) return send(res, 404, { error: "Active research project not found." });
      if (!asset) return send(res, 403, { error: "Only a domain verified in your Monitoring workspace can be used as a research asset." });

      const endpointPath = normalizeEndpointPath(body.endpointPath, asset.url);
      const assetUrl = sanitizeResearchAssetUrl(asset.url);
      if (!endpointPath || !assetUrl) return send(res, 400, { error: "Endpoint must be a path on the verified HTTPS domain, such as /account/profile." });

      const { count: findingCount, error: findingCountError } = await supabaseAdmin.from("research_findings")
        .select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("user_id", user.id);
      if (findingCountError) throw findingCountError;
      if ((findingCount || 0) >= 500) return send(res, 429, { error: "The beta limit is 500 findings per project." });

      const { data, error } = await supabaseAdmin.from("research_findings")
        .insert({
          project_id: project.id,
          site_id: asset.id,
          user_id: user.id,
          asset_hostname: asset.hostname,
          asset_url: assetUrl,
          title,
          severity,
          status: "new",
          endpoint_path: endpointPath,
          description,
          impact,
          remediation,
          evidence
        })
        .select(FINDING_SELECT).single();
      if (error) throw error;
      return send(res, 201, { finding: data });
    }

    if (action === "update_finding") {
      if (!validId(body.findingId)) return send(res, 400, { error: "Choose a valid finding." });
      const patch = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) {
        patch.title = textField(body.title, 160, true);
        if (patch.title === null) return send(res, 400, { error: "Finding title is required and must be under 160 characters." });
      }
      if (body.description !== undefined) {
        patch.description = textField(body.description, 5000, true);
        if (patch.description === null) return send(res, 400, { error: "Finding description is required and must be under 5,000 characters." });
      }
      if (body.impact !== undefined) {
        patch.impact = textField(body.impact, 3000);
        if (patch.impact === null) return send(res, 400, { error: "Impact must be under 3,000 characters." });
      }
      if (body.remediation !== undefined) {
        patch.remediation = textField(body.remediation, 3000);
        if (patch.remediation === null) return send(res, 400, { error: "Remediation must be under 3,000 characters." });
      }
      if (body.severity !== undefined) {
        if (!["critical", "high", "medium", "low", "info"].includes(body.severity)) return send(res, 400, { error: "Invalid finding severity." });
        patch.severity = body.severity;
      }
      if (body.status !== undefined) {
        if (!["new", "triaged", "accepted", "remediating", "resolved", "false_positive"].includes(body.status)) return send(res, 400, { error: "Invalid finding status." });
        patch.status = body.status;
      }
      if (body.evidence !== undefined) {
        patch.evidence = normalizeEvidence(body.evidence);
        if (patch.evidence === null) return send(res, 400, { error: "Evidence must contain up to ten valid evidence items." });
      }

      const { data, error } = await supabaseAdmin.from("research_findings")
        .update(patch).eq("id", body.findingId).eq("user_id", user.id)
        .select(FINDING_SELECT).maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Research finding not found." });
      return send(res, 200, { finding: data });
    }

    if (action === "delete_finding") {
      if (!validId(body.findingId)) return send(res, 400, { error: "Choose a valid finding." });
      const { data, error } = await supabaseAdmin.from("research_findings")
        .delete().eq("id", body.findingId).eq("user_id", user.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Research finding not found." });
      return send(res, 200, { deleted: true });
    }

    if (action === "add_note") {
      if (!validId(body.findingId)) return send(res, 400, { error: "Choose a valid finding." });
      const content = textField(body.content, 5000, true);
      if (content === null) return send(res, 400, { error: "Enter a note under 5,000 characters." });
      const { data: finding, error: findingError } = await supabaseAdmin.from("research_findings")
        .select("id,project_id").eq("id", body.findingId).eq("user_id", user.id).maybeSingle();
      if (findingError) throw findingError;
      if (!finding) return send(res, 404, { error: "Research finding not found." });
      const { count: noteCount, error: noteCountError } = await supabaseAdmin.from("research_notes")
        .select("id", { count: "exact", head: true }).eq("finding_id", finding.id).eq("user_id", user.id);
      if (noteCountError) throw noteCountError;
      if ((noteCount || 0) >= 100) return send(res, 429, { error: "The beta limit is 100 notes per finding." });
      const { data, error } = await supabaseAdmin.from("research_notes")
        .insert({ finding_id: finding.id, project_id: finding.project_id, user_id: user.id, content })
        .select("id,finding_id,project_id,content,created_at").single();
      if (error) throw error;
      return send(res, 201, { note: data });
    }

    return send(res, 400, { error: "Unsupported research workspace action." });
  } catch (error) {
    console.error("Sentinel research API error:", error);
    return send(res, 500, { error: "Unable to process the research workspace request safely." });
  }
}
