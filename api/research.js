import { createClient } from "@supabase/supabase-js";
import { createResearchPlanFingerprint } from "./_lib/research-plan-hash.js";
import { evaluateResearchScope } from "./_lib/research-scope-gate.js";
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
  res.setHeader("X-Content-Type-Options", "nosniff");
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
    const action = req.query?.__action === "check_scope" ? "check_scope" : body.action;

    if (action === "check_scope") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return send(res, 405, { error: "Method not allowed." });
      }
      const plan = createResearchPlanFingerprint({
        caseId: body.caseId,
        targetUrl: body.targetUrl,
        method: body.method,
        testCategory: body.testCategory
      });
      if (!plan) return send(res, 400, { error: "The proposed plan is invalid. Use an exact HTTPS URL without query strings or fragments." });

      const { data: authorizationRecord, error: caseError } = await supabaseAdmin
        .from("research_cases")
        .select("id,owner_user_id,authorization_status,authorized_assets,allowed_methods,allowed_test_categories,excluded_methods,scope_starts_at,scope_expires_at")
        .eq("id", plan.case_id)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (caseError) return send(res, 503, { error: "Unable to verify the case authorization record." });
      if (!authorizationRecord) return send(res, 404, { error: "Research case not found." });

      const { data: planApproval, error: approvalError } = await supabaseAdmin
        .from("research_case_approvals")
        .select("case_id,plan_hash,target_origin,target_path,method,test_category,status,reviewer_user_id,approved_at,expires_at")
        .eq("case_id", plan.case_id)
        .eq("plan_hash", plan.plan_hash)
        .maybeSingle();
      if (approvalError) return send(res, 503, { error: "Unable to verify the human approval record." });

      const decision = evaluateResearchScope({
        authorizationRecord,
        planApproval,
        targetUrl: body.targetUrl,
        method: body.method,
        testCategory: body.testCategory,
        trustedPlanHash: plan.plan_hash,
        now: Date.now()
      });
      // Decision only: this action never sends traffic to the target.
      return send(res, decision.allowed ? 200 : 403, {
        allowed: decision.allowed,
        reason: decision.reason,
        decision_only: true
      });
    }

    if (action === "create_case") {
      const title = textField(body.title, 160, true);
      const description = textField(body.description, 5000);
      const authorizationReference = textField(body.authorizationReference, 500, true);
      const assets = Array.isArray(body.authorizedAssets) ? body.authorizedAssets : [];
      const evidence = Array.isArray(body.authorizationEvidence) ? body.authorizationEvidence : [];
      const methods = Array.isArray(body.allowedMethods) ? body.allowedMethods : [];
      const categories = Array.isArray(body.allowedTestCategories) ? body.allowedTestCategories : [];
      const starts = Date.parse(body.scopeStartsAt);
      const expires = Date.parse(body.scopeExpiresAt);
      const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
      const validAssets = assets.length > 0 && assets.length <= 10 && assets.every((asset) => {
        if (!asset || typeof asset !== "object" || typeof asset.origin !== "string" ||
            !Array.isArray(asset.paths) || asset.paths.length < 1 || asset.paths.length > 30 ||
            !Array.isArray(asset.excluded_paths ?? [])) return false;
        try {
          const url = new URL(asset.origin);
          return url.protocol === "https:" && !url.username && !url.password &&
            !url.search && !url.hash && url.pathname === "/" &&
            asset.paths.every((path) => typeof path === "string" && path.startsWith("/") &&
              !path.startsWith("//") && !path.includes("..") && path.length <= 1024) &&
            (asset.excluded_paths ?? []).every((path) => typeof path === "string" &&
              path.startsWith("/") && !path.startsWith("//") && !path.includes("..") && path.length <= 1024);
        } catch { return false; }
      });
      if (!title || description === null || !authorizationReference ||
          evidence.length < 1 || evidence.length > 10 ||
          !evidence.every((item) => item && typeof item === "object" &&
            typeof item.label === "string" && item.label.trim().length <= 120 &&
            typeof item.reference === "string" && item.reference.trim().length <= 500) ||
          !validAssets || methods.length < 1 || methods.some((m) => !safeMethods.has(m)) ||
          categories.length < 1 || categories.length > 10 ||
          categories.some((x) => typeof x !== "string" || !x.trim() || x.length > 80) ||
          !Number.isFinite(starts) || !Number.isFinite(expires) || expires <= starts ||
          expires - starts > 31 * 24 * 60 * 60 * 1000) {
        return send(res, 400, { error: "Provide written authorization evidence, HTTPS assets, safe methods, categories, and a scope window of no more than 31 days." });
      }
      const { data, error } = await supabaseAdmin.from("research_cases").insert({
        owner_user_id: user.id, title, description, authorization_reference: authorizationReference,
        authorization_evidence: evidence, authorized_assets: assets,
        allowed_methods: [...new Set(methods)], allowed_test_categories: [...new Set(categories)],
        excluded_methods: [], scope_starts_at: new Date(starts).toISOString(),
        scope_expires_at: new Date(expires).toISOString(), authorization_status: "draft"
      }).select("id,title,authorization_status,created_at").single();
      if (error) throw error;
      await supabaseAdmin.from("research_case_events").insert({
        case_id: data.id, actor_user_id: user.id, event_type: "case.created",
        details: { authorization_reference_present: true, asset_count: assets.length }
      });
      return send(res, 201, { case: data });
    }

    if (action === "assign_reviewer") {
      if (!validId(body.caseId) || !validId(body.reviewerUserId) || body.reviewerUserId === user.id) {
        return send(res, 400, { error: "Choose a valid case and a different reviewer account." });
      }
      const { data: researchCase, error: caseError } = await supabaseAdmin.from("research_cases")
        .select("id").eq("id", body.caseId).eq("owner_user_id", user.id).maybeSingle();
      if (caseError) throw caseError;
      if (!researchCase) return send(res, 404, { error: "Research case not found." });
      const reviewer = await supabaseAdmin.auth.admin.getUserById(body.reviewerUserId);
      if (reviewer.error || !reviewer.data?.user?.id) return send(res, 404, { error: "Reviewer account not found." });
      const { error } = await supabaseAdmin.from("research_case_reviewers").upsert({
        case_id: researchCase.id, reviewer_user_id: body.reviewerUserId,
        assigned_by: user.id, status: "active"
      }, { onConflict: "case_id,reviewer_user_id" });
      if (error) throw error;
      await supabaseAdmin.from("research_case_events").insert({
        case_id: researchCase.id, actor_user_id: user.id,
        event_type: "reviewer.assigned", details: { reviewer_user_id: body.reviewerUserId }
      });
      return send(res, 200, { assigned: true });
    }

    if (action === "submit_case_for_review") {
      if (!validId(body.caseId)) return send(res, 400, { error: "Choose a valid research case." });
      const { data, error } = await supabaseAdmin.from("research_cases")
        .update({ authorization_status: "pending_review", updated_at: new Date().toISOString() })
        .eq("id", body.caseId).eq("owner_user_id", user.id)
        .in("authorization_status", ["draft", "rejected"])
        .select("id,authorization_status").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 409, { error: "Case cannot be submitted in its current state." });
      await supabaseAdmin.from("research_case_events").insert({
        case_id: data.id, actor_user_id: user.id, event_type: "case.submitted_for_review"
      });
      return send(res, 200, { case: data });
    }

    if (action === "review_case") {
      if (!validId(body.caseId) || !["authorized", "rejected"].includes(body.decision)) {
        return send(res, 400, { error: "Choose a case and an authorized/rejected decision." });
      }
      const { data: researchCase, error: caseError } = await supabaseAdmin.from("research_cases")
        .select("id,owner_user_id,authorization_status,authorization_reference,authorization_evidence,authorized_assets,allowed_methods,allowed_test_categories,scope_starts_at,scope_expires_at")
        .eq("id", body.caseId).maybeSingle();
      if (caseError) throw caseError;
      if (!researchCase) return send(res, 404, { error: "Research case not found." });
      if (researchCase.owner_user_id === user.id) return send(res, 403, { error: "A case owner cannot approve their own authorization." });
      const { data: assignment, error: assignmentError } = await supabaseAdmin.from("research_case_reviewers")
        .select("case_id").eq("case_id", body.caseId).eq("reviewer_user_id", user.id).eq("status", "active").maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return send(res, 403, { error: "You are not an assigned reviewer for this case." });
      if (researchCase.authorization_status !== "pending_review") return send(res, 409, { error: "Case is not awaiting review." });
      if (body.decision === "authorized" &&
          (!researchCase.authorization_reference || !Array.isArray(researchCase.authorization_evidence) ||
           !researchCase.authorization_evidence.length || !Array.isArray(researchCase.authorized_assets) ||
           !researchCase.authorized_assets.length || !researchCase.allowed_methods?.length ||
           !researchCase.allowed_test_categories?.length ||
           !researchCase.scope_starts_at || !researchCase.scope_expires_at ||
           Date.parse(researchCase.scope_expires_at) <= Date.now())) {
        return send(res, 400, { error: "Authorization evidence and a valid future scope window are required." });
      }
      const { data, error } = await supabaseAdmin.from("research_cases")
        .update({ authorization_status: body.decision, updated_at: new Date().toISOString() })
        .eq("id", body.caseId).eq("authorization_status", "pending_review")
        .select("id,authorization_status").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 409, { error: "Case state changed; reload and review again." });
      await supabaseAdmin.from("research_case_events").insert({
        case_id: data.id, actor_user_id: user.id, event_type: "case.reviewed",
        details: { decision: body.decision }
      });
      return send(res, 200, { case: data });
    }

    if (action === "request_plan_approval") {
      const plan = createResearchPlanFingerprint({
        caseId: body.caseId, targetUrl: body.targetUrl, method: body.method, testCategory: body.testCategory
      });
      if (!plan) return send(res, 400, { error: "The proposed plan is invalid." });
      const { data: researchCase, error: caseError } = await supabaseAdmin.from("research_cases")
        .select("id,owner_user_id,authorization_status,scope_expires_at")
        .eq("id", plan.case_id).eq("owner_user_id", user.id).maybeSingle();
      if (caseError) throw caseError;
      if (!researchCase || researchCase.authorization_status !== "authorized" ||
          Date.parse(researchCase.scope_expires_at) <= Date.now()) {
        return send(res, 403, { error: "Only an independently reviewed, currently authorized case can request plan approval." });
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(plan.method)) return send(res, 403, { error: "Only safe read-only methods are supported." });
      const { data: reviewers, error: reviewerError } = await supabaseAdmin.from("research_case_reviewers")
        .select("reviewer_user_id").eq("case_id", plan.case_id).eq("status", "active").neq("reviewer_user_id", user.id).limit(1);
      if (reviewerError) throw reviewerError;
      if (!reviewers?.length) return send(res, 403, { error: "An independent active reviewer must be assigned first." });
      const { data, error } = await supabaseAdmin.from("research_case_approvals").upsert({
        case_id: plan.case_id, plan_hash: plan.plan_hash, target_origin: plan.target_origin,
        target_path: plan.target_path, method: plan.method, test_category: plan.test_category,
        reviewer_user_id: reviewers[0].reviewer_user_id, status: "pending"
      }, { onConflict: "case_id,plan_hash" })
        .select("id,case_id,plan_hash,status,reviewer_user_id,created_at").single();
      if (error) throw error;
      await supabaseAdmin.from("research_case_events").insert({
        case_id: plan.case_id, actor_user_id: user.id, event_type: "plan.submitted_for_approval",
        details: { plan_hash: plan.plan_hash, target_origin: plan.target_origin, target_path: plan.target_path, method: plan.method, test_category: plan.test_category }
      });
      return send(res, 201, { approval: data });
    }

    if (action === "decide_plan_approval") {
      if (!validId(body.approvalId) || !["approved", "rejected"].includes(body.decision)) {
        return send(res, 400, { error: "Choose a valid approval and decision." });
      }
      const { data: approval, error: approvalError } = await supabaseAdmin.from("research_case_approvals")
        .select("id,case_id,reviewer_user_id,status").eq("id", body.approvalId)
        .eq("reviewer_user_id", user.id).maybeSingle();
      if (approvalError) throw approvalError;
      if (!approval || approval.status !== "pending") return send(res, 404, { error: "Pending approval not found for this reviewer." });
      const { data: assignment, error: assignmentError } = await supabaseAdmin.from("research_case_reviewers")
        .select("case_id").eq("case_id", approval.case_id).eq("reviewer_user_id", user.id).eq("status", "active").maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return send(res, 403, { error: "Reviewer assignment is no longer active." });
      const { data, error } = await supabaseAdmin.from("research_case_approvals")
        .update({
          status: body.decision, reviewer_notes: textField(body.notes, 3000) || "",
          approved_at: body.decision === "approved" ? new Date().toISOString() : null,
          expires_at: body.decision === "approved" ? new Date(Math.min(Date.now() + 60 * 60 * 1000, Date.now() + 60 * 60 * 1000)).toISOString() : null
        }).eq("id", approval.id).eq("status", "pending")
        .select("id,case_id,status,approved_at,expires_at").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 409, { error: "Approval was already processed." });
      await supabaseAdmin.from("research_case_events").insert({
        case_id: approval.case_id, actor_user_id: user.id, event_type: "plan.reviewed",
        details: { approval_id: approval.id, decision: body.decision }
      });
      return send(res, 200, { approval: data });
    }

    if (action === "revoke_plan_approval") {
      if (!validId(body.approvalId)) {
        return send(res, 400, { error: "Choose a valid plan approval." });
      }
      const notes = body.notes === undefined ? "Approval revoked by the assigned reviewer." : textField(body.notes, 3000);
      if (notes === null) return send(res, 400, { error: "Reviewer notes must be under 3,000 characters." });

      const { data: approval, error: approvalError } = await supabaseAdmin.from("research_case_approvals")
        .select("id,case_id,reviewer_user_id,status")
        .eq("id", body.approvalId).eq("reviewer_user_id", user.id).maybeSingle();
      if (approvalError) throw approvalError;
      if (!approval || approval.status !== "approved") {
        return send(res, 404, { error: "Active approved plan not found for this reviewer." });
      }
      const { data: assignment, error: assignmentError } = await supabaseAdmin.from("research_case_reviewers")
        .select("case_id").eq("case_id", approval.case_id)
        .eq("reviewer_user_id", user.id).eq("status", "active").maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return send(res, 403, { error: "Reviewer assignment is no longer active." });

      const { data, error } = await supabaseAdmin.from("research_case_approvals")
        .update({ status: "revoked", reviewer_notes: notes })
        .eq("id", approval.id).eq("status", "approved")
        .select("id,case_id,status").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 409, { error: "Approval changed; reload and try again." });
      const { error: eventError } = await supabaseAdmin.from("research_case_events").insert({
        case_id: approval.case_id, actor_user_id: user.id, event_type: "plan.revoked",
        details: { approval_id: approval.id }
      });
      if (eventError) throw eventError;
      return send(res, 200, { approval: data });
    }

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
