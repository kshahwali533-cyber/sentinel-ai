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

/**
 * Do not expose other members' verified asset inventory when workspace
 * sharing is disabled. Also omit assets already shared with the workspace.
 */
export function getAvailableTeamAssets(availableAssets, sharedIds, sharingEnabled) {
  if (!sharingEnabled || !Array.isArray(availableAssets) || !(sharedIds instanceof Set)) {
    return [];
  }
  return availableAssets.filter((asset) => asset && !sharedIds.has(asset.id));
}
