import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routes = [
  { path: "api/scan.js", parserLimit: "32kb", applicationLimit: "16 * 1024" },
  { path: "api/assistant.js", parserLimit: "64kb", applicationLimit: "32 * 1024" },
  { path: "api/report.js", parserLimit: "1mb", applicationLimit: "512 * 1024" }
];

test("security-sensitive JSON APIs enforce a Vercel parser limit before handler execution", () => {
  for (const route of routes) {
    const source = fs.readFileSync(route.path, "utf8");
    assert.ok(
      source.includes('export const config = { api: { bodyParser: { sizeLimit: "' + route.parserLimit + '" } } }'),
      route.path + " must cap Vercel body parsing"
    );
    assert.ok(
      source.includes("isWithinJsonBodyLimit(body, " + route.applicationLimit + ")"),
      route.path + " must retain its application-level byte guard"
    );
  }
});
