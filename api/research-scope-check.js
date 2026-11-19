import { createClient } from "@supabase/supabase-js";
import { createResearchPlanFingerprint } from "./_lib/research-plan-hash.js";
import { evaluateResearchScope } from "./_lib/research-scope-gate.js";

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
  if (error || !data?.user?.id) return null;
  return data.user;
}

/**
 * Read-only scope decision endpoint.
 * It never makes a request to the target. All authorization and approval
 * records are loaded from Supabase server-side; browser-provided approval
 * state is ignored. A positive decision is NOT itself a scan command.
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }
  if (!supabaseAdmin) return send(res, 503, { error: "Research authorization service is not configured." });

  try {
    const user = await getUser(req);
    if (!user) return send(res, 401, { error: "Sign in is required." });

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
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

    // This endpoint is a decision check only. It never triggers external traffic.
    return send(res, decision.allowed ? 200 : 403, {
      allowed: decision.allowed,
      reason: decision.reason,
      decision_only: true
    });
  } catch {
    return send(res, 500, { error: "Unable to evaluate the research scope safely." });
  }
}
