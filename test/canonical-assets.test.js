import test from "node:test";
import assert from "node:assert/strict";
import { renderCanonicalAsset } from "../api/_lib/canonical-assets.js";

const env = { VERCEL_PROJECT_PRODUCTION_URL: "project-3jyda.vercel.app" };

test("robots.txt uses the Vercel configured production origin", () => {
  const asset = renderCanonicalAsset("robots", env);
  assert.equal(asset.contentType, "text/plain; charset=utf-8");
  assert.match(asset.body, /Sitemap: https:\\/\\/project-3jyda\\.vercel\\.app\\/sitemap\\.xml/);
  assert.match(asset.body, /Disallow: \\/api\\//);
});

test("sitemap.xml emits only the canonical production URL", () => {
  const asset = renderCanonicalAsset("sitemap", env);
  assert.equal(asset.contentType, "application/xml; charset=utf-8");
  assert.match(asset.body, /<loc>https:\\/\\/project-3jyda\\.vercel\\.app\\/\\<\\/loc>/);
});

test("security.txt canonical points to the configured production origin", () => {
  const asset = renderCanonicalAsset("security", env);
  assert.equal(asset.contentType, "text/plain; charset=utf-8");
  assert.match(asset.body, /Canonical: https:\\/\\/project-3jyda\\.vercel\\.app\\/\\.well-known\\/security\\.txt/);
  assert.match(asset.body, /Expires: 2027-11-27T23:59:59\\.000Z/);
});

test("canonical origin rejects missing, URL-shaped, and hostile host values", () => {
  for (const value of [undefined, "", "https://example.com", "example.com/path", "example.com:443", "evil.com\\nHost: attacker.test", "localhost"]) {
    assert.equal(renderCanonicalAsset("robots", { VERCEL_PROJECT_PRODUCTION_URL: value }), null);
  }
  assert.equal(renderCanonicalAsset("unknown", env), null);
});
