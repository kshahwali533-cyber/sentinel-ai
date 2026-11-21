import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../api/organizations.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261114121509_sentinel_organization_workspaces_20261114.sql", import.meta.url), "utf8");

test("workspace owners cannot create redundant invitations to their own account", () => {
  assert.match(api, /email === user\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(api, /You already belong to this workspace/);
});

test("invitation acceptance requires a verified account email and a 64-character token", () => {
  assert.match(api, /if \(!user\.email_confirmed_at && !user\.confirmed_at\)/);
  assert.match(api, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(api, /hashOrganizationInviteToken\(token\)/);
});

test("invitation acceptance is bound to the authenticated user's ID and email", () => {
  assert.match(api, /p_user_id: user\.id, p_email: user\.email, p_token_hash:/);
});

test("invitations store only token hashes and expire after seven days", () => {
  assert.match(api, /token_hash: hashOrganizationInviteToken\(token\)/);
  assert.match(api, /Date\.now\(\) \+ 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(api, /delivery: "manual_share"/);
  assert.doesNotMatch(migration, /token\s+text\s+not null/i);
});

test("database acceptance locks the invitation and validates email, expiry, and unused status", () => {
  const start = migration.indexOf("create or replace function public.accept_organization_invitation");
  const end = migration.indexOf("$function$;", start + 20);
  const fn = migration.slice(start, end);
  assert.match(fn, /where token_hash = p_token_hash/);
  assert.match(fn, /lower\(email\) = lower\(p_email\)/);
  assert.match(fn, /accepted_at is null/);
  assert.match(fn, /expires_at > pg_catalog\.now\(\)/);
  assert.match(fn, /for update/);
  assert.match(fn, /insert into public\.organization_members/);
  assert.match(fn, /set accepted_at = pg_catalog\.now\(\)/);
  assert.match(fn, /member\.invitation_accepted/);
});

test("invitation acceptance RPC is unavailable to anon and authenticated clients", () => {
  assert.match(migration, /revoke all on function public\.accept_organization_invitation\(uuid,text,text\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.accept_organization_invitation\(uuid,text,text\) to service_role/);
});

test("workspace audit failures are surfaced as a refresh-before-retry response", () => {
  assert.match(api, /ORGANIZATION_AUDIT_WRITE_FAILED/);
  assert.match(api, /Refresh before retrying/);
});
