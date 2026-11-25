import test from "node:test";
import assert from "node:assert/strict";
import { isVerifiedMemberAsset } from "../api/_lib/team-assets.js";

test("only verified assets owned by current workspace members can be shared", () => {
  const site = { id: "site-1", user_id: "member-1", verified_at: "2026-11-14T00:00:00Z" };
  assert.equal(isVerifiedMemberAsset(site, ["member-1", "member-2"]), true);
  assert.equal(isVerifiedMemberAsset(site, ["member-2"]), false);
  assert.equal(isVerifiedMemberAsset({ ...site, verified_at: null }, ["member-1"]), false);
  assert.equal(isVerifiedMemberAsset(null, ["member-1"]), false);
});


test("disabled workspace asset sharing exposes no available member assets", () => {
  const available = [
    { id: "site-1", user_id: "member-1", verified_at: "2026-11-14T00:00:00Z" },
    { id: "site-2", user_id: "member-2", verified_at: "2026-11-14T00:00:00Z" }
  ];
  assert.deepEqual(getAvailableTeamAssets(available, new Set(), false), []);
});

test("enabled workspace asset sharing excludes assets already shared", () => {
  const available = [
    { id: "site-1" },
    { id: "site-2" }
  ];
  assert.deepEqual(
    getAvailableTeamAssets(available, new Set(["site-1"]), true),
    [{ id: "site-2" }]
  );
});

test("available asset helper fails closed for invalid inputs", () => {
  assert.deepEqual(getAvailableTeamAssets([{ id: "site-1" }], null, true), []);
  assert.deepEqual(getAvailableTeamAssets(null, new Set(), true), []);
});
