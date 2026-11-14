const POLICY_KEYS = [
  "allow_member_invites",
  "allow_asset_sharing",
  "audit_export_enabled"
];

export function normalizeOrganizationPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Workspace policy settings are invalid.");
  }
  const policy = {};
  for (const key of POLICY_KEYS) {
    if (typeof value[key] !== "boolean") {
      throw new Error("All workspace policy settings must be true or false.");
    }
    policy[key] = value[key];
  }
  return policy;
}
