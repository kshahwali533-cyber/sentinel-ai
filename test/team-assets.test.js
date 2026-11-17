import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getAvailableAssetOwnerIds, isVerifiedMemberAsset } from "../api/_lib/team-assets.js";

test("only verified assets owned by current workspace members can be shared", () => {
  const site = { id: "site-1", user_id: "member-1", verified_at: "2026-11-14T00:00:00Z" };
  assert.equal(isVerifiedMemberAsset(site, ["member-1", "member-2"]), true);
  assert.equal(isVerifiedMemberAsset(site, ["member-2"]), false);
  assert.equal(isVerifiedMemberAsset({ ...site, verified_at: null }, ["member-1"]), false);
  assert.equal(isVerifiedMemberAsset(null, ["member-1"]), false);
});

test("only workspace owners and admins can enumerate unshared member assets", () => {
  const members = ["member-1", "member-2", "member-1", null];
  assert.deepEqual(getAvailableAssetOwnerIds("owner", members), ["member-1", "member-2"]);
  assert.deepEqual(getAvailableAssetOwnerIds("admin", members), ["member-1", "member-2"]);
  assert.deepEqual(getAvailableAssetOwnerIds("member", members), []);
  assert.deepEqual(getAvailableAssetOwnerIds("analyst", members), []);
  assert.deepEqual(getAvailableAssetOwnerIds("owner", null), []);
});


test("team asset API filters unshared asset discovery through the role guard", () => {
  const source = fs.readFileSync("api/organization-assets.js", "utf8");
  assert.match(source, /getAvailableAssetOwnerIds\(membership\.role, memberIds\)/);
  assert.match(source, /\.in\("user_id", availableOwnerIds\)/);
  assert.doesNotMatch(source, /\.in\("user_id", memberIds\)/);
});
