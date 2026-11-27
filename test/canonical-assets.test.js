import test from "node:test";
import assert from "node:assert/strict";
import { renderCanonicalAsset } from "../api/_lib/canonical-assets.js";

const env = { VERCEL_PROJECT_PRODUCTION_URL: "project-3jyda.vercel.app" };

test("robots.txt uses the Vercel configured production origin", () => {
  const asset = renderCanonicalAsset("robots", env);
  assert.equal(asset.contentType, "text/plain; charset=utf-8");
  assert.ok(asset.body.includes("Sitemap: https://project-3jyda.vercel.app/sitemap.xml"));
  assert.ok(asset.body.includes("Disallow: /api/"));
});

test("sitemap.xml emits only the canonical production URL", () => {
  const asset = renderCanonicalAsset("sitemap", env);
  assert.equal(asset.contentType, "application/xml; charset=utf-8");
  assert.ok(asset.body.includes("<loc>https://project-3jyda.vercel.app/</loc>"));
});

test("security.txt canonical points to the configured production origin", () => {
  const asset = renderCanonicalAsset("security", env);
  assert.equal(asset.contentType, "text/plain; charset=utf-8");
  assert.ok(asset.body.includes("Canonical: https://project-3jyda.vercel.app/.well-known/security.txt"));
  const expires = asset.body.match(/^Expires: (.+)$/m)?.[1];
  assert.ok(expires && Number.isFinite(Date.parse(expires)));
  assert.ok(Date.parse(expires) > Date.now() + 364 * 24 * 60 * 60 * 1000);
});

test("an explicitly configured canonical hostname takes precedence over the Vercel fallback", () => {
  const asset = renderCanonicalAsset("sitemap", {
    VERCEL_PROJECT_PRODUCTION_URL: "project-3jyda.vercel.app",
    SENTINEL_CANONICAL_HOSTNAME: "security.example.com"
  });
  assert.ok(asset.body.includes("<loc>https://security.example.com/</loc>"));
});

test("canonical origin rejects missing, URL-shaped, and hostile host values", () => {
  for (const value of [undefined, "", "https://example.com", "example.com/path", "example.com:443", "evil.com\nHost: attacker.test", "localhost"]) {
    assert.equal(renderCanonicalAsset("robots", { VERCEL_PROJECT_PRODUCTION_URL: value }), null);
  }
  assert.equal(renderCanonicalAsset("unknown", env), null);
});
