import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("browser Supabase SDK is pinned to the exact lockfile version", async () => {
  const [html, packageJsonText, lockText, vercelText] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8")
  ]);

  const packageJson = JSON.parse(packageJsonText);
  const lock = JSON.parse(lockText);
  const vercel = JSON.parse(vercelText);
  const expectedVersion = packageJson.dependencies["@supabase/supabase-js"];
  const browserScript = html.match(/<script defer src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+)" integrity="(sha384-[^"]+)" crossorigin="anonymous"><\/script>/);

  assert.ok(expectedVersion, "Supabase SDK must be a declared dependency");
  assert.equal(lock.packages["node_modules/@supabase/supabase-js"].version, expectedVersion);
  assert.ok(browserScript, "Browser must load the Supabase SDK from the pinned CDN package");
  assert.equal(
    browserScript[1],
    `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${expectedVersion}`,
    "Browser SDK version must exactly match package.json and package-lock.json"
  );
  assert.match(browserScript[2], /^sha384-[A-Za-z0-9+/]{64}$/, "Browser SDK must use a SHA-384 integrity hash");

  const csp = vercel.headers
    .flatMap((entry) => entry.headers || [])
    .find((header) => header.key.toLowerCase() === "content-security-policy");
  assert.ok(csp, "A Content-Security-Policy header must be configured");
  assert.match(csp.value, /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
});
