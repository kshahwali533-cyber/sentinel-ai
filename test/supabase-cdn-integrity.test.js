import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const scriptTag = html.match(/<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.119\.0" integrity="([^"]+)" crossorigin="anonymous"><\/script>/);

test("Supabase browser client is version-pinned and protected with SHA-384 SRI", () => {
  assert.ok(scriptTag, "pinned Supabase script must include integrity and crossorigin attributes");
  assert.match(scriptTag[1], /^sha384-[A-Za-z0-9+/]{64}$/);
});

test("pinned Supabase CDN response matches the declared SRI hash", async () => {
  assert.ok(scriptTag, "Supabase CDN integrity declaration is required");
  const response = await fetch("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0");
  assert.equal(response.ok, true);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = "sha384-" + createHash("sha384").update(bytes).digest("base64");
  assert.equal(digest, scriptTag[1]);
});
