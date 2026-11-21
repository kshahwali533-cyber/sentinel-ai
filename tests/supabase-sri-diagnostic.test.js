import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

test("diagnostic: compute SRI for the pinned Supabase CDN bundle", async () => {
  const response = await fetch("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0");
  assert.equal(response.ok, true, "Supabase CDN bundle must be reachable in CI");
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha384").update(bytes).digest("base64");
  console.log("SUPABASE_SRI_SHA384=sha384-" + digest);
  assert.ok(bytes.length > 10000);
});
