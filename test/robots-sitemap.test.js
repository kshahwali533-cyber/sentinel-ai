import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("robots.txt is served from the project root and points to the sitemap", () => {
  const robots = fs.readFileSync("robots.txt", "utf8");
  assert.match(robots, /^User-agent: \*/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Sitemap: https:\/\/project-3jyda\.vercel\.app\/sitemap\.xml$/m);
});

test("sitemap contains the canonical production homepage", () => {
  const sitemap = fs.readFileSync("sitemap.xml", "utf8");
  assert.match(sitemap, /<urlset[^>]+sitemaps\.org\/schemas\/sitemap\/0\.9/);
  assert.match(sitemap, /<loc>https:\/\/project-3jyda\.vercel\.app\/<\/loc>/);
});
