import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const privateApiRoutes = [
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

for (const route of privateApiRoutes) {
  test(`/api/${route} prevents caching of API responses`, async () => {
    const source = await readFile(new URL(`../api/${route}`, import.meta.url), "utf8");
    assert.match(
      source,
      /setHeader\(["']Cache-Control["'],\s*["'](?:private,\s*)?no-store["']\)/i,
      "sensitive API responses must explicitly use Cache-Control: no-store"
    );
  });
}
