import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createSupabaseAdmin, isPreviewDatabaseBlocked } from "../api/_lib/supabase-admin.js";

const routes = [
  "analytics.js",
  "assistant.js",
  "intelligence.js",
  "monitoring-run.js",
  "monitoring.js",
  "organization-admin.js",
  "organization-assets.js",
  "organizations.js",
  "report.js",
  "research.js",
  "scan.js",
  "usage.js"
];

test("Preview deployments are blocked from using the service-role database client", () => {
  assert.equal(isPreviewDatabaseBlocked({ VERCEL_ENV: "preview" }), true);
  assert.equal(isPreviewDatabaseBlocked({ VERCEL_ENV: "production" }), false);
  assert.equal(isPreviewDatabaseBlocked({ VERCEL_ENV: "development" }), false);
  assert.equal(isPreviewDatabaseBlocked({}), false);
  assert.equal(createSupabaseAdmin({
    VERCEL_ENV: "preview",
    SUPABASE_URL: "https://production-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "must-not-be-used"
  }), null);
});

test("every database-backed API route uses the shared preview-safe client", () => {
  for (const route of routes) {
    const source = fs.readFileSync("api/" + route, "utf8");
    assert.match(source, /import \{ createSupabaseAdmin \} from "\.\/\_lib\/supabase-admin\.js"/, route);
    assert.match(source, /createSupabaseAdmin\(\)/, route);
    assert.doesNotMatch(source, /createClient\(process\.env\.SUPABASE_URL/, route);
  }
});
