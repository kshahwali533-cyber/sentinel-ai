import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrganizationName,
  slugifyOrganizationName,
  hashOrganizationInviteToken,
  isValidOrganizationInviteEmail
} from "../api/_lib/organizations.js";

test("organization names are trimmed and bounded", () => {
  assert.equal(normalizeOrganizationName("  Sentinel Team  "), "Sentinel Team");
  assert.throws(() => normalizeOrganizationName("x"));
  assert.throws(() => normalizeOrganizationName("a".repeat(101)));
});

test("organization slugs contain only normalized URL-safe characters", () => {
  assert.equal(slugifyOrganizationName("Chitral Security Team"), "chitral-security-team");
  assert.equal(slugifyOrganizationName("Équipe Sécurité"), "equipe-securite");
  assert.match(slugifyOrganizationName("!!"), /^[a-z0-9-]+$/);
});

test("invitation tokens are stored as SHA-256 hashes", () => {
  const hash = hashOrganizationInviteToken("a".repeat(64));
  assert.equal(hash.length, 64);
  assert.notEqual(hash, "a".repeat(64));
  assert.equal(hashOrganizationInviteToken("a".repeat(64)), hash);
});

test("invitation email validation rejects malformed or oversized values", () => {
  assert.equal(isValidOrganizationInviteEmail("member@example.com"), true);
  assert.equal(isValidOrganizationInviteEmail("not-an-email"), false);
  assert.equal(isValidOrganizationInviteEmail("x@x"), false);
  assert.equal(isValidOrganizationInviteEmail("a".repeat(250) + "@example.com"), false);
});
