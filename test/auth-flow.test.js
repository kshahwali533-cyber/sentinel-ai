import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("sentinel-app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const actions = fs.readFileSync("sentinel-actions.js", "utf8");
const analytics = fs.readFileSync("sentinel-analytics.js", "utf8");

test("Supabase auth-state callback is synchronous and defers UI refresh", () => {
  const start = app.indexOf("supabaseClient.auth.onAuthStateChange(function(event)");
  assert.ok(start >= 0, "auth-state listener is registered");
  const end = app.indexOf("\n    });", start);
  assert.ok(end > start, "auth-state callback closes");
  const callback = app.slice(start, end);
  assert.doesNotMatch(callback, /async\s+function|\bawait\b/);
  assert.match(callback, /scheduleAuthUIRefresh\(\)/);
  assert.match(callback, /event === "INITIAL_SESSION"/);
  assert.match(app, /supabaseClient\.auth\.onAuthStateChange[\s\S]*?void updateAuthUI\(\)/);
});

test("auth UI refreshes are coalesced and the session timeout is cleared", () => {
  assert.match(app, /function scheduleAuthUIRefresh\(\)/);
  assert.match(app, /window\.clearTimeout\(authUiRefreshTimer\)/);
  assert.match(app, /window\.clearTimeout\(sessionTimeoutId\)/);
  assert.match(app, /sessionTimeoutId = window\.setTimeout/);
});

test("login, signup, password update and logout defer refresh instead of awaiting auth UI", () => {
  for (const name of ["signUpUser", "signInUser", "signOutUser", "updatePassword"]) {
    const start = app.indexOf("async function " + name + "(");
    assert.ok(start >= 0, name + " exists");
    const next = app.indexOf("\nasync function ", start + 1);
    const body = app.slice(start, next < 0 ? app.length : next);
    assert.doesNotMatch(body, /await updateAuthUI\(\)/, name + " must not run overlapping UI refresh");
    assert.match(body, /scheduleAuthUIRefresh\(\)/, name + " schedules a single refresh");
  }
});

test("password recovery UI retains the supported email and OTP recovery flow", () => {
  assert.match(app, /resetPasswordForEmail\(email/);
  assert.match(app, /event === "PASSWORD_RECOVERY"/);
  assert.match(html, /id="passwordResetArea"/);
  assert.match(html, /data-action="update-password"/);
  assert.match(app, /verifyPasswordResetOtp/);
  assert.match(app, /type:\s*"recovery"/);
  assert.match(html, /id="otpResetArea"/);
  assert.match(html, /id="resetOtp"/);
});

test("login and logout buttons remain connected to delegated handlers and analytics", () => {
  for (const action of ["sign-up-user", "sign-in-user", "sign-out-user", "reset-password", "update-password"]) {
    assert.match(html, new RegExp('data-action="' + action + '"'));
    assert.match(actions, new RegExp('case "' + action + '"'));
  }
  assert.match(analytics, /function trackSentinelEvent\(/);
  assert.match(app, /trackSentinelEvent\("logout_success"\)/);
});
