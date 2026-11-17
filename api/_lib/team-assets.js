export function isVerifiedMemberAsset(site, memberIds) {
  return Boolean(
    site &&
    typeof site.id === "string" &&
    typeof site.user_id === "string" &&
    site.verified_at &&
    Array.isArray(memberIds) &&
    memberIds.includes(site.user_id)
  );
}

/** Only workspace owners/admins may enumerate members' unshared assets. */
export function getAvailableAssetOwnerIds(role, memberIds) {
  if (!["owner", "admin"].includes(role) || !Array.isArray(memberIds)) return [];
  return [...new Set(memberIds.filter((id) => typeof id === "string" && id.length > 0))];
}
