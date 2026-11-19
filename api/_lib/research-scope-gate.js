const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const BLOCKED_CATEGORIES = new Set([
  "denial_of_service",
  "credential_theft",
  "data_exfiltration",
  "persistence",
  "destructive_write",
  "social_engineering",
  "privilege_escalation"
]);

function parseIso(value) {
  if (typeof value !== "string" || !value.trim()) return NaN;
  return Date.parse(value);
}

function normalizeTarget(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hash || url.search) return null;
    const port = url.port || "443";
    return {
      origin: `https://${url.hostname.toLowerCase()}:${port}`,
      hostname: url.hostname.toLowerCase(),
      pathname: url.pathname || "/"
    };
  } catch {
    return null;
  }
}

function isPathWithinScope(pathname, allowedPath) {
  if (typeof allowedPath !== "string" || !allowedPath.startsWith("/") || allowedPath.includes("..")) {
    return false;
  }
  const normalized = allowedPath.endsWith("/") ? allowedPath : `${allowedPath}/`;
  return pathname === allowedPath || pathname.startsWith(normalized);
}

/**
 * Pure, deny-by-default authorization decision.
 * The caller MUST load authorizationRecord and planApproval from trusted
 * server-side storage after authenticating the user. Never pass browser data
 * directly as either record. This function does not perform network requests.
 */
export function evaluateResearchScope({
  authorizationRecord,
  planApproval,
  targetUrl,
  method,
  testCategory,
  trustedPlanHash,
  now = Date.now()
}) {
  const deny = (reason) => ({ allowed: false, reason });

  if (!authorizationRecord || typeof authorizationRecord !== "object") {
    return deny("authorization_record_missing");
  }
  if (authorizationRecord.authorization_status !== "authorized") {
    return deny("authorization_not_approved");
  }
  if (!Array.isArray(authorizationRecord.authorized_assets) ||
      !Array.isArray(authorizationRecord.allowed_methods) ||
      !Array.isArray(authorizationRecord.excluded_methods)) {
    return deny("scope_definition_invalid");
  }

  const starts = parseIso(authorizationRecord.scope_starts_at);
  const expires = parseIso(authorizationRecord.scope_expires_at);
  if (!Number.isFinite(starts) || !Number.isFinite(expires) || expires <= starts) {
    return deny("scope_window_invalid");
  }
  if (now < starts) return deny("scope_not_started");
  if (now >= expires) return deny("scope_expired");

  const target = normalizeTarget(targetUrl);
  if (!target) return deny("target_url_invalid");

  const normalizedMethod = typeof method === "string" ? method.toUpperCase() : "";
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    return deny("method_not_permitted_by_safe_mvp");
  }
  if (authorizationRecord.excluded_methods.includes(normalizedMethod)) {
    return deny("method_excluded");
  }
  if (!authorizationRecord.allowed_methods.includes(normalizedMethod)) {
    return deny("method_not_in_scope");
  }
  if (typeof testCategory !== "string" || !testCategory.trim() ||
      BLOCKED_CATEGORIES.has(testCategory.trim().toLowerCase())) {
    return deny("test_category_blocked");
  }
  if (!Array.isArray(authorizationRecord.allowed_test_categories) ||
      !authorizationRecord.allowed_test_categories.includes(testCategory)) {
    return deny("test_category_not_in_scope");
  }

  const asset = authorizationRecord.authorized_assets.find((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.origin !== "string") return false;
    const approvedOrigin = normalizeTarget(entry.origin);
    return approvedOrigin !== null && approvedOrigin.pathname === "/" &&
      approvedOrigin.origin === target.origin;
  });
  if (!asset) return deny("target_origin_out_of_scope");
  if (!Array.isArray(asset.paths) || !Array.isArray(asset.excluded_paths ?? []) ||
      !asset.paths.some((path) => isPathWithinScope(target.pathname, path))) {
    return deny("target_path_out_of_scope");
  }
  if (asset.excluded_paths?.some((path) => isPathWithinScope(target.pathname, path))) {
    return deny("target_path_excluded");
  }

  // Approval is a separate, trusted record for this exact test plan.
  if (!planApproval || planApproval.status !== "approved" ||
      planApproval.case_id !== authorizationRecord.case_id ||
      planApproval.reviewer_user_id == null ||
      typeof planApproval.plan_hash !== "string" || !/^[0-9a-f]{64}$/i.test(planApproval.plan_hash) ||
      typeof trustedPlanHash !== "string" || trustedPlanHash !== planApproval.plan_hash) {
    return deny("human_plan_approval_missing");
  }
  const approvalStart = parseIso(planApproval.approved_at);
  const approvalExpiry = parseIso(planApproval.expires_at);
  if (!Number.isFinite(approvalStart) || !Number.isFinite(approvalExpiry) ||
      approvalExpiry <= approvalStart || now < approvalStart) {
    return deny("human_plan_approval_invalid");
  }
  if (now >= approvalExpiry) return deny("human_plan_approval_expired");
  if (planApproval.target_origin !== target.origin ||
      planApproval.target_path !== target.pathname ||
      planApproval.method !== normalizedMethod ||
      planApproval.test_category !== testCategory) {
    return deny("approved_plan_does_not_match_request");
  }

  return {
    allowed: true,
    reason: "authorized_exact_scope_and_plan",
    target: { origin: target.origin, pathname: target.pathname },
    method: normalizedMethod
  };
}
