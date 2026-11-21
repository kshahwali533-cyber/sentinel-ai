/**
 * Load only Research Lab records visible to the current owner/reviewer.
 * The service-role client bypasses RLS, so every query is explicitly scoped.
 */
export async function loadResearchCaseWorkspace(client, userId) {
  if (!client || typeof userId !== "string" || !userId) {
    throw new TypeError("A database client and authenticated user ID are required.");
  }

  const [ownedCases, reviewerAssignments] = await Promise.all([
    client.from("research_cases")
      .select("id,owner_user_id,title,description,authorization_status,authorization_reference,authorization_evidence,authorized_assets,allowed_methods,allowed_test_categories,excluded_methods,scope_starts_at,scope_expires_at,created_at,updated_at")
      .eq("owner_user_id", userId).order("created_at", { ascending: false }).limit(50),
    client.from("research_case_reviewers")
      .select("case_id,reviewer_user_id,status,assigned_at")
      .eq("reviewer_user_id", userId).order("assigned_at", { ascending: false }).limit(50)
  ]);
  const firstError = [ownedCases.error, reviewerAssignments.error].find(Boolean);
  if (firstError) throw firstError;

  const ownedCaseIds = (ownedCases.data || []).map(item => item.id);
  const assignedCaseIds = (reviewerAssignments.data || [])
    .filter(item => item.status === "active")
    .map(item => item.case_id);
  const accessibleCaseIds = [...new Set([...ownedCaseIds, ...assignedCaseIds])];

  const [assignedCases, ownerReviewers, ownerApprovals, reviewerApprovals, caseEvents] = await Promise.all([
    assignedCaseIds.length
      ? client.from("research_cases")
          .select("id,owner_user_id,title,description,authorization_status,authorization_reference,authorization_evidence,authorized_assets,allowed_methods,allowed_test_categories,excluded_methods,scope_starts_at,scope_expires_at,created_at,updated_at")
          .in("id", assignedCaseIds).limit(50)
      : Promise.resolve({ data: [], error: null }),
    ownedCaseIds.length
      ? client.from("research_case_reviewers")
          .select("case_id,reviewer_user_id,status,assigned_at")
          .in("case_id", ownedCaseIds).order("assigned_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    ownedCaseIds.length
      ? client.from("research_case_approvals")
          .select("id,case_id,plan_hash,target_origin,target_path,method,test_category,status,reviewer_user_id,reviewer_notes,created_at,approved_at,expires_at")
          .in("case_id", ownedCaseIds).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    client.from("research_case_approvals")
      .select("id,case_id,plan_hash,target_origin,target_path,method,test_category,status,reviewer_user_id,reviewer_notes,created_at,approved_at,expires_at")
      .eq("reviewer_user_id", userId).order("created_at", { ascending: false }).limit(100),
    accessibleCaseIds.length
      ? client.from("research_case_events")
          .select("id,case_id,actor_user_id,event_type,details,created_at")
          .in("case_id", accessibleCaseIds).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null })
  ]);
  const secondError = [assignedCases.error, ownerReviewers.error, ownerApprovals.error, reviewerApprovals.error, caseEvents.error].find(Boolean);
  if (secondError) throw secondError;

  const caseMap = new Map();
  for (const item of ownedCases.data || []) caseMap.set(item.id, { ...item, viewer_role: "owner" });
  for (const item of assignedCases.data || []) {
    if (!caseMap.has(item.id)) caseMap.set(item.id, { ...item, viewer_role: "reviewer" });
  }

  return {
    research_cases: [...caseMap.values()],
    reviewer_assignments: reviewerAssignments.data || [],
    owner_reviewers: ownerReviewers.data || [],
    case_approvals: ownerApprovals.data || [],
    reviewer_approvals: reviewerApprovals.data || [],
    case_events: caseEvents.data || []
  };
}
