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
