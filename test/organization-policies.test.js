import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOrganizationPolicy } from "../api/_lib/organization-policies.js";

test("workspace policy accepts only explicit boolean settings", () => {
  assert.deepEqual(normalizeOrganizationPolicy({
    allow_member_invites: false,
    allow_asset_sharing: true,
    audit_export_enabled: false
  }), {
    allow_member_invites: false,
    allow_asset_sharing: true,
    audit_export_enabled: false
  });
  assert.throws(() => normalizeOrganizationPolicy({ allow_member_invites: true }));
  assert.throws(() => normalizeOrganizationPolicy(null));
  assert.throws(() => normalizeOrganizationPolicy(["true", true, true]));
});
