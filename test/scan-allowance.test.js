import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20261114143419_sentinel_atomic_scan_allowance_20261114.sql",
  "utf8"
);
const scan = fs.readFileSync("api/scan.js", "utf8");

test("monthly scan reservation serializes quota checks per account", () => {
  assert.match(migration, /pg_advisory_xact_lock\s*\(/);
  assert.match(migration, /hashtextextended\(p_user_id::text,\s*0\)/);
  assert.match(migration, /event_type\s*=\s*'scan\.completed'/);
  assert.match(migration, /v_used\s*\+\s*v_reserved\s*>=\s*v_limit/);
});

test("abandoned reservations expire and private RPC access is restricted", () => {
  assert.match(migration, /created_at\s*<\s*pg_catalog\.now\(\)\s*-\s*interval\s+'15 minutes'/);
  assert.match(migration, /create table if not exists private\.scan_usage_reservations/);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.reserve_scan_allowance\(uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.reserve_scan_allowance\(uuid\) to service_role/i);
});

test("authenticated scans reserve, complete, and clean up their allowance", () => {
  const reserve = scan.indexOf('"reserve_scan_allowance"');
  const complete = scan.indexOf('"complete_scan_allowance"');
  const cancel = scan.indexOf('"cancel_scan_allowance"');
  const successResponse = scan.indexOf("return res.status(200).json({", complete);

  assert.ok(reserve > 0, "authenticated scan must reserve quota");
  assert.ok(complete > reserve, "successful scan must complete its reservation");
  assert.ok(cancel > complete, "cleanup must cancel uncompleted reservations");
  assert.ok(successResponse > complete, "usage must be recorded before returning a successful scan");
  assert.match(scan, /if\s*\(authenticatedUser\)\s*\{[\s\S]*?reserve_scan_allowance/);
  assert.match(scan, /finally\s*\{[\s\S]*?cancel_scan_allowance/);
});
