"use strict";


/* =========================
   SUPABASE CONFIGURATION
========================= */

const IS_PREVIEW_SAFE_MODE =
  window.SENTINEL_RUNTIME_CONFIG?.isProduction !== true;

const SUPABASE_URL = IS_PREVIEW_SAFE_MODE
  ? "https://preview-disabled.invalid"
  : "https://vceqmqwszvisvxxbgbfs.supabase.co";


const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_t4A5zMUDFmPY4Q7bJA0tBA_nrCfe2RC"
;


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

if (IS_PREVIEW_SAFE_MODE) {
  const safetyNotice = document.createElement("div");
  safetyNotice.setAttribute("role", "status");
  safetyNotice.textContent =
    "Preview Safe Mode: live account data and database actions are disabled here. Production is unchanged.";
  safetyNotice.style.cssText =
    "position:sticky;top:0;z-index:99999;padding:12px 16px;background:#7f1d1d;color:#fff;text-align:center;font-weight:700;font-size:14px;";
  document.addEventListener("DOMContentLoaded", () => {
    document.body.prepend(safetyNotice);
  }, { once: true });
}

let latestScan = null;
let authUiRefreshTimer = null;
  function trackEvent(eventName) {
  try {
    if (typeof window.va === "function") {
      window.va("event", {
        name: eventName
      });
    }
  } catch (error) {
    console.error("Analytics event error:", error);
  }
}

/* =========================
   BASIC SECURITY
========================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}




/* =========================
   AUTH UI
========================= */

function scheduleAuthUIRefresh() {
  if (authUiRefreshTimer !== null) {
    window.clearTimeout(authUiRefreshTimer);
  }

  authUiRefreshTimer = window.setTimeout(() => {
    authUiRefreshTimer = null;
    void updateAuthUI();
  }, 0);
}

async function updateAuthUI() {
  const authStatus = document.getElementById("authStatus");
  const authForm = document.getElementById("authForm");
   const passwordResetArea =
    document.getElementById("passwordResetArea");
  const loggedInArea =
    document.getElementById("loggedInArea");
  const loggedInEmail = document.getElementById("loggedInEmail");
  const historyStatus = document.getElementById("historyStatus");

  if (!authStatus) {
    return;
  }

  if (IS_PREVIEW_SAFE_MODE) {
    const previewMessage =
      "Preview Safe Mode is active. Account data, cloud history, AI Mentor, monitoring, research and workspace actions are disabled in this protected Preview. Production is unchanged.";
    authStatus.className = "notice";
    authStatus.textContent = previewMessage;

    const authIntro = document.getElementById("authIntro");
    if (authIntro) {
      authIntro.textContent =
        "Account creation and cloud scan history are unavailable in this protected Preview.";
    }

    for (const areaId of ["authForm", "passwordResetArea", "loggedInArea"]) {
      const area = document.getElementById(areaId);
      if (!area) continue;
      area.classList.add("is-hidden");
      area.querySelectorAll("input, button, select, textarea").forEach((control) => {
        control.disabled = true;
        control.setAttribute("aria-disabled", "true");
      });
    }

    const previewStatuses = {
      historyStatus: "Preview Safe Mode: cloud scan history is disabled here.",
      analyticsStatus: "Preview Safe Mode: private account analytics are unavailable here.",
      analyticsRisk: "Unavailable in protected Preview.",
      analyticsTrend: "Unavailable in protected Preview.",
      analyticsWarnings: "Unavailable in protected Preview.",
      monitorStatus: "Preview Safe Mode: domain verification and scheduled monitoring are disabled here.",
      monitorAlerts: "Security alerts are unavailable in protected Preview.",
      monitorRuns: "Monitoring run history is unavailable in protected Preview.",
      intelStatus: "Preview Safe Mode: account-linked vulnerability intelligence is disabled here.",
      researchStatus: "Preview Safe Mode: private research actions are disabled here.",
      organizationStatus: "Preview Safe Mode: team workspace actions are disabled here.",
      usageStatus: "Preview Safe Mode: account usage data is unavailable here."
    };
    for (const [id, message] of Object.entries(previewStatuses)) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = message;
        element.classList.add("notice");
      }
    }

    for (const id of ["usageSummary", "monitorSites", "intelResults"]) {
      const element = document.getElementById(id);
      if (element) element.textContent = "";
    }

    document.querySelectorAll("button[data-action]").forEach((button) => {
      if (button.dataset.action === "run-security-scan" || button.dataset.action === "toggle-password") {
        return;
      }
      button.disabled = true;
      button.title = "Unavailable in protected Preview Safe Mode.";
      button.setAttribute("aria-disabled", "true");
    });

    for (const sectionId of ["monitoring", "intelligence", "research", "teams"]) {
      const section = document.getElementById(sectionId);
      if (section) {
        section.querySelectorAll("input, textarea, select").forEach((control) => {
          control.disabled = true;
          control.setAttribute("aria-disabled", "true");
        });
      }
    }
    return;
  }

  try {
    console.log("AUTH DEBUG: before getSession");

let sessionResult;
  let sessionTimeoutId;

  try {
    sessionResult = await Promise.race([
      supabaseClient.auth.getSession(),
      new Promise((_, reject) => {
        sessionTimeoutId = window.setTimeout(
          () => reject(new Error("getSession timeout after 8 seconds")),
          8000
        );
      })
    ]);
  } finally {
    if (sessionTimeoutId !== undefined) {
      window.clearTimeout(sessionTimeoutId);
    }
  }

  const {
    data: { session },
    error
  } = sessionResult;

console.log("AUTH DEBUG: after getSession");

if (error) {
  throw error;
}

    const user = session?.user;

    if (user) {
      console.log("AUTH UI: user detected");
      authStatus.className = "success";
      authStatus.textContent =
        "✅ Your Sentinel AI account is active. Your scan history can be saved securely.";

      if (authForm) {
        authForm.classList.add("is-hidden");
      }

      if (loggedInArea) {
        loggedInArea.classList.remove("is-hidden");
      }

      if (loggedInEmail) {
        loggedInEmail.textContent = user.email || "Account user";
      }

      if (historyStatus) {
        historyStatus.textContent =
          "☁️ Cloud history is active for your account.";
      }

      const intelStatus = document.getElementById("intelStatus");
      if (intelStatus) {
        intelStatus.className = "notice";
        intelStatus.textContent =
          "Enter an exact CVE ID to search NIST NVD and the CISA KEV catalog.";
      }

      await loadSupabaseHistory();
      await loadMonitoringDashboard();
      await loadAnalyticsDashboard();
      await loadResearchWorkspace();
      await loadOrganizationWorkspace();
      await loadUsageSummary();

    } else {
      authStatus.className = "notice";
      authStatus.textContent =
        "🔐 Log in or create an account to securely save scan history in the cloud.";

      if (authForm) {
        authForm.classList.remove("is-hidden");
      }

      if (loggedInArea) {
        loggedInArea.classList.add("is-hidden");
      }

      if (loggedInEmail) {
        loggedInEmail.textContent = "";
      }

      if (historyStatus) {
        historyStatus.textContent =
          "📱 Local history is active. Log in to enable cloud history.";
      }

      const intelStatus = document.getElementById("intelStatus");
      if (intelStatus) {
        intelStatus.className = "notice";
        intelStatus.textContent = "Log in to search trusted vulnerability sources.";
      }
      const intelResults = document.getElementById("intelResults");
      if (intelResults) intelResults.innerHTML = "";

      const researchStatus = document.getElementById("researchStatus");
      if (researchStatus) {
        researchStatus.className = "notice";
        researchStatus.textContent = "Log in to use your private research workspace.";
      }
      researchWorkspaceData = {
        projects: [], verified_assets: [], findings: [], notes: [],
        research_cases: [], reviewer_assignments: [], case_approvals: [],
        reviewer_approvals: [], case_events: []
      };
      const researchProjects = document.getElementById("researchProjects");
      const researchFindings = document.getElementById("researchFindings");
      if (researchProjects) researchProjects.innerHTML = "";
      if (researchFindings) researchFindings.innerHTML = "Log in to view research findings.";

      const analyticsStatus = document.getElementById("analyticsStatus");
      if (analyticsStatus) {
        analyticsStatus.className = "notice";
        analyticsStatus.textContent = "Log in to view your private scan analytics.";
      }
      const analyticsWarnings = document.getElementById("analyticsWarnings");
      if (analyticsWarnings) analyticsWarnings.textContent = "Log in to view recurring warnings.";

      const usageStatus = document.getElementById("usageStatus");
      const usageSummary = document.getElementById("usageSummary");
      if (usageStatus) {
        usageStatus.className = "notice";
        usageStatus.textContent = "Sign in to view account usage.";
      }
      if (usageSummary) usageSummary.innerHTML = "";

      const organizationStatus = document.getElementById("organizationStatus");
      if (organizationStatus) {
        organizationStatus.className = "notice";
        organizationStatus.textContent = "Log in to manage team workspaces.";
      }
      const organizationList = document.getElementById("organizationList");
      if (organizationList) organizationList.innerHTML = "";

      const monitorStatus = document.getElementById("monitorStatus");
      if (monitorStatus) {
        monitorStatus.className = "notice";
        monitorStatus.textContent = "Log in to add and manage monitored websites.";
      }
      const monitorSites = document.getElementById("monitorSites");
      const monitorAlerts = document.getElementById("monitorAlerts");
      const monitorRuns = document.getElementById("monitorRuns");
      if (monitorSites) monitorSites.innerHTML = "";
      if (monitorAlerts) monitorAlerts.textContent = "Log in to view security alerts.";
      if (monitorRuns) monitorRuns.textContent = "Log in to view monitoring activity.";
    }

  } catch (error) {
    console.error("Auth UI Error:", error);

    authStatus.className = "error";
    authStatus.textContent =
      "❌ Unable to check account status right now.";
  }
}
function togglePassword() {
  const passwordInput = document.getElementById("authPassword");

  if (!passwordInput) return;

  passwordInput.type =
    passwordInput.type === "password"
      ? "text"
      : "password";
}
async function resetPassword() {
  const emailInput = document.getElementById("authEmail");
  const authStatus = document.getElementById("authStatus");

  if (!emailInput || !authStatus) return;

  const email = emailInput.value.trim();

  if (!email) {
    authStatus.className = "error";
    authStatus.textContent =
      "⚠️ Please enter your email address first.";
    return;
  }

  authStatus.className = "notice";
  authStatus.textContent =
    "📧 Sending password reset email...";

  try {
    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

    if (error) {
      throw error;
    }

    authStatus.className = "success";
    authStatus.textContent =
      "✅ Password reset link sent. Please check your email.";
  } catch (error) {
    console.error("Password Reset Error:", error);

    authStatus.className = "error";
    authStatus.textContent =
      "❌ " +
      (error?.message || "Unable to send password reset email.");
  }
  }
/* =========================
   UPDATE PASSWORD
========================= */

async function updatePassword() {
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const authStatus = document.getElementById("authStatus");

  if (!newPasswordInput || !confirmPasswordInput || !authStatus) {
    console.error("Update Password: Required elements not found.");
    return;
  }

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!newPassword || !confirmPassword) {
    authStatus.className = "error";
    authStatus.textContent =
      "⚠️ Please enter and confirm your new password.";
    return;
  }

  if (newPassword.length < 6) {
    authStatus.className = "error";
    authStatus.textContent =
      "⚠️ Password must be at least 6 characters.";
    return;
  }

  if (newPassword !== confirmPassword) {
    authStatus.className = "error";
    authStatus.textContent =
      "⚠️ Passwords do not match.";
    return;
  }

  authStatus.className = "notice";
  authStatus.textContent =
    "🔐 Updating your password...";

  try {
    const { error } =
      await supabaseClient.auth.updateUser({
        password: newPassword
      });

    if (error) {
      throw error;
    }

    authStatus.className = "success";
    authStatus.textContent =
      "✅ Password updated successfully. You can now use your new password.";

    newPasswordInput.value = "";
    confirmPasswordInput.value = "";

    const passwordResetArea =
      document.getElementById("passwordResetArea");

    if (passwordResetArea) {
      passwordResetArea.classList.add("is-hidden");
    }

    scheduleAuthUIRefresh();

  } catch (error) {
    console.error("Update Password Error:", error);

    authStatus.className = "error";
    authStatus.textContent =
      "❌ " +
      (error?.message || "Unable to update password.");
  }
}
/* =========================
   CREATE ACCOUNT
========================= */

async function signUpUser() {
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const authStatus = document.getElementById("authStatus");

  if (!emailInput || !passwordInput || !authStatus) {
    console.error("Signup: Required elements not found.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authStatus.className = "error";
    authStatus.textContent =
      "⚠️ Please enter your email and password.";
    return;
  }

  if (password.length < 6) {
    authStatus.className = "error";
    authStatus.textContent =
      "⚠️ Password must be at least 6 characters.";
    return;
  }

  authStatus.className = "notice";
  authStatus.textContent =
    "🔐 Creating your Sentinel AI account...";

  try {
    const { data, error } =
      await supabaseClient.auth.signUp({
        email,
        password
      });

    if (error) {
      throw error;
    }
if (data?.user) {
  trackEvent("account_created");
}
    if (data?.session) {
      authStatus.className = "success";
      authStatus.textContent =
        "✅ Account created and logged in successfully.";
    } else {
      authStatus.className = "success";
      authStatus.textContent =
        "✅ Account created. Please check your email to confirm your account, then log in.";
    }

    passwordInput.value = "";
    scheduleAuthUIRefresh();

  } catch (error) {
    console.error("Signup Error:", error);

    authStatus.className = "error";
    authStatus.textContent =
      "❌ " +
      (error?.message || "Unable to create account.");
  }
}


/* =========================
   LOGIN
========================= */

async function signInUser() {
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");
  const authStatus = document.getElementById("authStatus");

  if (!emailInput || !passwordInput || !authStatus) {
    console.error("Login: Required elements not found.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authStatus.className = "error";
    authStatus.textContent =
      "⚠️ Please enter your email and password.";
    return;
  }

  authStatus.className = "notice";
  authStatus.textContent =
    "🔐 Logging you in...";

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }
    trackEvent("login_success");
    
    authStatus.className = "success";
    authStatus.textContent =
      "✅ Login successful. Welcome to Sentinel AI.";

    passwordInput.value = "";
    scheduleAuthUIRefresh();

  } catch (error) {
    console.error("Login Error:", error);

    authStatus.className = "error";
    authStatus.textContent =
      "❌ " +
      (error?.message || "Unable to log in.");
  }
}


/* =========================
   LOGOUT
========================= */

async function signOutUser() {
  const authStatus = document.getElementById("authStatus");

  if (!authStatus) {
    console.error("Logout: authStatus element not found.");
    return;
  }

  authStatus.className = "notice";
  authStatus.textContent =
    "🔐 Logging you out...";

  try {
    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }
    trackSentinelEvent("logout_success");
    scheduleAuthUIRefresh();
    
    const authForm = document.getElementById("authForm");
    const loggedInArea = document.getElementById("loggedInArea");
    const loggedInEmail = document.getElementById("loggedInEmail");
    const historyStatus = document.getElementById("historyStatus");

    if (authForm) {
      authForm.classList.remove("is-hidden");
    }

    if (loggedInArea) {
      loggedInArea.classList.add("is-hidden");
    }

    if (loggedInEmail) {
      loggedInEmail.textContent = "";
    }

    if (historyStatus) {
      historyStatus.textContent =
        "📱 Local history is active. Log in to enable cloud history.";
    }

    authStatus.className = "success";
    authStatus.textContent =
      "✅ You have been logged out successfully.";

  } catch (error) {
    console.error("Logout Error:", error);

    authStatus.className = "error";
    authStatus.textContent =
      "❌ " +
      (error?.message || "Unable to log out right now.");
  }
}


/* =========================
   SAVE SCAN TO SUPABASE
========================= */

async function saveScanToSupabase(scan) {

  try {

    const {
      data,
      error: userError
    } =
      await supabaseClient.auth.getUser();


    if (userError) {
      throw userError;
    }


    const user =
      data?.user;


    if (!user) {

      console.log(
        "Cloud history skipped: user is not logged in."
      );

      return;

    }


    const website =
      scan.website ||
      scan.finalUrl ||
      "";


    const securityScore =
      Number(
        scan.score ??
        scan.securityScore ??
        0
      );


    const riskLevel =
      scan.riskLevel ||
      "Unknown";


    const scanId =
      scan.scanId ||
      "N/A";


    const checks =
      Array.isArray(scan.checks)
        ? scan.checks
        : [];


    const {
      error
    } =
      await supabaseClient
        .from("scan_history")
        .insert({

          user_id:
            user.id,

          website,

          security_score:
            securityScore,

          risk_level:
            riskLevel,

          scan_id:
            scanId,

          checks

        });


    if (error) {
      throw error;
    }


    console.log(
      "Scan saved to Supabase."
    );


    await loadSupabaseHistory();
    await loadAnalyticsDashboard();


  } catch (error) {

    console.error(
      "Supabase Save Error:",
      error
    );
    const historyStatus = document.getElementById("historyStatus");
    if (historyStatus) {
      historyStatus.className = "error";
      historyStatus.textContent = "Cloud history could not be saved. Your scan is still available in this browser; please check your connection and account permissions.";
    }
    return false;

  }

}


/* =========================
   LOAD CLOUD HISTORY
========================= */

async function loadSupabaseHistory() {

  const list =
    document.getElementById(
      "historyList"
    );


  const historyStatus =
    document.getElementById(
      "historyStatus"
    );


  if (!list) {
    return;
  }


  try {

    const {
      data: userData,
      error: userError
    } =
      await supabaseClient.auth.getUser();


    if (userError) {
      throw userError;
    }


    const user =
      userData?.user;


    if (!user) {
      return;
    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("scan_history")
        .select(
          "id,user_id,website,security_score,risk_level,scan_id,checks,created_at"
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(10);


    if (error) {
      throw error;
    }


    if (!data || !data.length) {

      renderScanHistory();


      if (historyStatus) {

        historyStatus.textContent =
          "☁️ No cloud scans yet. Run your first security check.";

      }


      return;

    }


    list.innerHTML =
      data
        .map(
          item => `

            <div class="history-item">

              <strong>
                ${escapeHTML(
                  item.website
                )}
              </strong>

              <div class="history-score">

                Score:
                ${escapeHTML(
                  item.security_score
                )}/100

                ·

                ${escapeHTML(
                  item.risk_level
                )}

              </div>

              <div class="message">

                ${escapeHTML(
                  new Date(
                    item.created_at
                  ).toLocaleString()
                )}

                · Scan ID:

                ${escapeHTML(
                  item.scan_id
                )}

                · ☁️ Cloud

              </div>

            </div>

          `
        )
        .join("");


    if (historyStatus) {

      historyStatus.textContent =
        "☁️ Showing your latest cloud scans.";

    }


  } catch (error) {

    console.error(
      "Supabase History Error:",
      error
    );


    renderScanHistory();


    if (historyStatus) {

      historyStatus.textContent =
        "📱 Showing local history. Cloud history could not be loaded.";

    }

  }

}


/* =========================
   CLEAR CLOUD HISTORY
========================= */

async function clearSupabaseHistory() {

  try {

    const {
      data: userData,
      error: userError
    } =
      await supabaseClient.auth.getUser();


    if (userError) {
      throw userError;
    }


    const user =
      userData?.user;


    if (!user) {

      localStorage.removeItem(
        "sentinelScanHistory"
      );

      renderScanHistory();

      return;

    }


    const {
      error
    } =
      await supabaseClient
        .from("scan_history")
        .delete()
        .eq(
          "user_id",
          user.id
        );


    if (error) {
      throw error;
    }


    localStorage.removeItem(
      "sentinelScanHistory"
    );


    renderScanHistory();


    const historyStatus =
      document.getElementById(
        "historyStatus"
      );


    if (historyStatus) {

      historyStatus.textContent =
        "🗑️ Your cloud and local scan history has been cleared.";

    }


  } catch (error) {

    console.error(
      "Clear History Error:",
      error
    );


    alert(
      "Unable to clear cloud history right now."
    );

  }

}


/* =========================
   START SCANNER
========================= */

async function runSecurityScan(isRescan = false) {
  if (IS_PREVIEW_SAFE_MODE) {
    const previewResult = document.getElementById("result");
    if (previewResult) {
      previewResult.classList.remove("is-hidden");
      previewResult.innerHTML = '<div class="notice">Preview Safe Mode: scanning is disabled in this protected Preview. No scan request was sent. Production is unchanged.</div>';
    }
    return;
  }

  const websiteInput =
    document.getElementById("website");

  const result =
    document.getElementById("result");

  const button =
    document.getElementById("scanButton");


  if (!websiteInput || !result || !button) {
    return;
  }


  let website =
    websiteInput.value.trim();


  result.classList.remove("is-hidden");


  if (!website) {

    result.innerHTML = `
      <div class="error">
        ⚠️ Please enter a website address first.
      </div>
    `;

    return;
  }


  if (!/^https?:\/\//i.test(website)) {

    website =
      "https://" +
      website;

  }


  try {

    const parsed =
      new URL(website);


    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {

      throw new Error(
        "Invalid protocol."
      );

    }


  } catch {

    result.innerHTML = `
      <div class="error">
        ⚠️ Please enter a valid website URL.
      </div>
    `;

    return;

  }


  button.disabled = true;
trackEvent(
  isRescan
    ? "rescan_started"
    : "scan_started"
);

  result.innerHTML = `
    <div class="notice scan-progress" role="status" aria-live="polite">
      <span class="scan-spinner" aria-hidden="true"></span>
      <div>
        <strong>🛡️ Sentinel AI is scanning your website...</strong>
        <br><br>
        Connecting to the scanner and checking HTTPS and security headers. Please wait.
      </div>
    </div>
  `;


  try {

    const { data: scanAuth } = await supabaseClient.auth.getSession();
    const scanAccessToken = scanAuth?.session?.access_token;

    const response =
      await fetch(
        "/api/scan",
        {

          method: "POST",

          headers: {
            "Content-Type": "application/json",
            ...(scanAccessToken ? { "Authorization": "Bearer " + scanAccessToken } : {})
          },

          body: JSON.stringify({
            url: website
          })

        }
      );


    let data = null;


    try {

      data =
        await response.json();

    } catch {

      data = null;

    }


    if (!response.ok) {

      throw new Error(
        data?.error ||
        "Security scan failed."
      );

    }


    if (
      !data ||
      !Array.isArray(data.checks)
    ) {

      throw new Error(
        "Scanner returned an invalid response."
      );

    }


    latestScan = {

      ...data,

      website:
        data.website ||
        data.finalUrl ||
        website

    };

   await saveScanHistory(
      latestScan
    );
console.log(
  "Sentinel technologyFindings:",
  latestScan.technologyFindings
);

    displayScanResults(
      latestScan
    );
trackSentinelEvent("scan_completed");

  } catch (error) {

    console.error(
      "Scanner Error:",
      error
    );
trackSentinelEvent("scan_failed");

    result.innerHTML = `
      <div class="error">
        ❌ ${escapeHTML(
          error?.message ||
          "Unable to scan the website."
        )}
        <br><br>
        Please try again.
      </div>
    `;


  } finally {

    button.disabled = false;

  }

}


// Explicitly expose the scanner for the delegated action handler.
window.runSecurityScan = runSecurityScan;

/* =========================
   DISPLAY RESULTS
========================= */

function displayScanResults(data) {

  const result =
    document.getElementById("result");


  if (!result) {
    return;
  }


  const checks =
    Array.isArray(data.checks)
      ? data.checks
      : [];

    /*
   * ---------------------------------------------------------
   * ADVANCED VULNERABILITY DISCOVERY — SETUP 4
   * DISCOVERED ATTACK SURFACE
   * ---------------------------------------------------------
   */
    const discoveredSurface =
    Array.isArray(data.discoveredSurface)
      ? data.discoveredSurface
      : [];

  const surfaceFindings =
    Array.isArray(data.surfaceFindings)
      ? data.surfaceFindings
      : [];
  const applicationFindings =
  Array.isArray(data.applicationFindings)
    ? data.applicationFindings
    : [];
  
  const clientEndpointFindings =
  Array.isArray(data.clientEndpointFindings)
    ? data.clientEndpointFindings
    : [];
  
  const linkedResourceFindings =
  Array.isArray(data.linkedResourceFindings)
    ? data.linkedResourceFindings
    : [];

  const technologyFindings =
    Array.isArray(data.technologyFindings)
      ? data.technologyFindings
      : [];

  const score =
    Number(
      data.score ??
      data.securityScore ??
      0
    );

  const riskLevel =
    data.riskLevel ||
    "Unknown";

  const passed =
    checks.filter(
      check =>
        check.status === "PASS"
    ).length;

  const warnings =
    checks.filter(
      check =>
        check.status === "WARNING"
    ).length;

  const informational =
    checks.filter(
      check =>
        check.status === "INFO"
    ).length;
  /*
   *
 ---------------------------------------------------------
 * ADVANCED VULNERABILITY DISCOVERY — SETUP 5
 * DISCOVERED RESOURCE DETAILS
 * ---------------------------------------------------------
 */

  let attackSurfaceHTML = "";

  if (
    discoveredSurface.length > 0 ||
    surfaceFindings.length > 0
  ) {

    const resourceListHTML =
      discoveredSurface
        .slice(0, 20)
        .map(resource => `
          <li>
            <strong>
              ${escapeHTML(
                resource.type ||
                "Resource"
              )}
            </strong>
            <br>
            <span>
              ${escapeHTML(
                resource.url ||
                ""
              )}
            </span>
          </li>
        `)
        .join("");

    attackSurfaceHTML = `
      <div class="priority">

        <strong>
          🔎 Discovered Attack Surface
        </strong>

        <br><br>

        ${discoveredSurface.length}
        candidate public paths identified. Guessed common paths may return soft-404 or catch-all pages; verify a route before treating it as an application endpoint.

        ${
          surfaceFindings.length > 0
            ? `<br>
               ${surfaceFindings.length}
               security-relevant surface indicators detected.`
            : ""
        }

        ${
          resourceListHTML
            ? `
              <br><br>

              <strong>
                Candidate Resources (unverified candidates)
              </strong>

              <ul>
                ${resourceListHTML}
              </ul>
            `
            : ""
        }

      </div>
    `;
  }

  let priorityHTML = "";
  
  /*
 * ---------------------------------------------------------
 * ADVANCED VULNERABILITY DISCOVERY — SETUP 7
 * TECHNOLOGY & SERVICE FINGERPRINTING
 * ---------------------------------------------------------
 */

let technologyFindingsHTML = "";

if (technologyFindings.length > 0) {

  const technologyListHTML =
    technologyFindings
      .slice(0, 20)
      .map(finding => `
        <li>
          <strong>
            ${escapeHTML(
              finding.technology ||
              "Technology / Service"
            )}
          </strong>
          <br>
          <span>
            ${escapeHTML(
              finding.indicator ||
              ""
            )}
          </span>
          <br>
          <small>
            Source:
            ${escapeHTML(
              finding.source ||
              "HTTP Response"
            )}
          </small>
        </li>
      `)
      .join("");

  technologyFindingsHTML = `
    <div class="priority">

      <strong>
        🧩 Technology & Service Fingerprinting
      </strong>

      <br><br>

      ${technologyFindings.length}
      public technology/service signals detected.

      <ul>
        ${technologyListHTML}
      </ul>

    </div>
  `;
}
  let clientEndpointFindingsHTML = "";

if (
  clientEndpointFindings &&
  clientEndpointFindings.length > 0
) {

  const clientEndpointListHTML =
    clientEndpointFindings
      .slice(0, 50)
      .map(finding => `
        <li>
          <strong>
            Client-Side Endpoint
          </strong>
          <br>
          <span>
            ${escapeHTML(
              finding.indicator ||
              "Potential client-side endpoint reference detected."
            )}
          </span>
          <br>
          <small>
            Source:
            ${escapeHTML(
              finding.source ||
              "html-javascript"
            )}
            <br>
            URL:
            ${escapeHTML(
              finding.url ||
              ""
            )}
          </small>
        </li>
      `)
      .join("");

  clientEndpointFindingsHTML = `
    <div class="priority">

      <strong>
        🔗 Client-Side Endpoint Discovery
      </strong>

      <br><br>

      ${clientEndpointFindings.length}
      client-side endpoint references detected.

      <ul>
        ${clientEndpointListHTML}
      </ul>

    </div>
  `;
}
  let linkedResourceFindingsHTML = "";

if (
  linkedResourceFindings &&
  linkedResourceFindings.length > 0
) {

  const linkedResourceListHTML =
    linkedResourceFindings
      .slice(0, 50)
      .map(finding => `
        <li>
          <strong>
            Linked Resource
          </strong>
          <br>
          <span>
            Same-origin linked resource detected.
          </span>
          <br>
          <small>
            Source:
            ${escapeHTML(
              finding.source ||
              "html-link"
            )}
            <br>
            Type:
            ${escapeHTML(
              finding.type ||
              "same-origin-linked-resource"
            )}
            <br>
            URL:
            ${escapeHTML(
              finding.url ||
              ""
            )}
          </small>
        </li>
      `)
      .join("");

  linkedResourceFindingsHTML = `
    <div class="priority">

      <strong>
        🔗 Linked Resource Discovery
      </strong>

      <br><br>

      ${linkedResourceFindings.length}
      same-origin linked resources detected.

      <ul>
        ${linkedResourceListHTML}
      </ul>

    </div>
  `;
}
  let applicationFindingsHTML = "";

if (applicationFindings.length > 0) {

  const applicationListHTML =
    applicationFindings
      .slice(0, 50)
      .map(finding => `
        <li>
          <strong>
            ${escapeHTML(
              finding.type ||
              "Application Entry Point"
            )}
          </strong>
          <br>
          <span>
            ${escapeHTML(
              finding.indicator ||
              ""
            )}
          </span>
          <br>
          <small>
            Method:
            ${escapeHTML(
              finding.method ||
              "GET"
            )}
            <br>
            URL:
            ${escapeHTML(
              finding.url ||
              ""
            )}
          </small>
        </li>
      `)
      .join("");

  applicationFindingsHTML = `
    <div class="priority">

      <strong>
        🚪 Application Entry-Point Discovery
      </strong>

      <br><br>

      ${applicationFindings.length}
      application entry points detected.

      <ul>
        ${applicationListHTML}
      </ul>

    </div>
  `;
}
/*
 * ---------------------------------------------------------
 * ADVANCED VULNERABILITY DISCOVERY — SETUP 6
 * SECURITY-RELEVANT FINDINGS DETAILS
 * ---------------------------------------------------------
 */

let surfaceFindingsHTML = "";

if (surfaceFindings.length > 0) {

  const findingsListHTML =
    surfaceFindings
      .slice(0, 20)
      .map(finding => `
        <li>
          <strong>
            ${escapeHTML(
              finding.category ||
              "Security Finding"
            )}
          </strong>
          <br>
          <span>
            ${escapeHTML(
              finding.indicator ||
              ""
            )}
          </span>
          <br>
          <small>
            ${escapeHTML(
              finding.url ||
              ""
            )}
          </small>
        </li>
      `)
      .join("");

  surfaceFindingsHTML = `
    <div class="priority">

      <strong>
        ⚠️ Security-Relevant Findings
      </strong>

      <br><br>

      ${surfaceFindings.length}
      security-relevant surface indicators detected.

      <ul>
        ${findingsListHTML}
      </ul>

    </div>
  `;
}

  const warningChecks =
    checks.filter(
      check =>
        check.status === "WARNING"
    );


  warningChecks
    .slice(0, 5)
    .forEach(
      (check, index) => {

        priorityHTML += `

          <div class="priority">

            <strong>
              Priority ${index + 1}:
              ${escapeHTML(
                check.name ||
                "Security Finding"
              )}
            </strong>

            <br>

            ${escapeHTML(
              check.fix ||
              check.message ||
              "Review this security finding."
            )}

          </div>

        `;

      }
    );


  if (!priorityHTML) {

    priorityHTML = `

      <div class="priority">

        <strong>
          Excellent:
        </strong>

        No WARNING-level findings
        were detected.

      </div>

    `;

  }


  let checksHTML = "";


  checks.forEach(
    (check, index) => {

      const status =
        check.status ||
        "INFO";


      let statusClass =
        "info";


      if (status === "PASS") {
        statusClass = "pass";
      }


      if (status === "WARNING") {
        statusClass = "warning";
      }


      const mentorButton =
        status === "WARNING" || status === "INFO"
          ? `

            <button
              class="mentor-button"
              type="button"
              data-action="ask-security-mentor" data-index="${index}"
            >

              🤖 Explain & Fix with AI Security Mentor

            </button>

          `
          : "";


      checksHTML += `

        <div class="check">

          <div class="check-name">

            ${escapeHTML(
              check.name ||
              "Security Check"
            )}

            —

            <span class="${statusClass}">

              ${escapeHTML(status)}

            </span>

          </div>


          <div class="message">

            ${escapeHTML(
              check.message ||
              ""
            )}

          </div>

          ${
            check.evidence
              ? `
                <div class="message evidence">
                  <strong>Evidence:</strong>
                  ${escapeHTML(check.evidence.source || "Scanner observation")}
                  ${check.evidence.signal ? " — " + escapeHTML(check.evidence.signal) : ""}
                  ${check.evidence.observed ? "<br>Observed: " + escapeHTML(check.evidence.observed) : ""}
                  ${check.evidence.expected ? "<br>Expected: " + escapeHTML(check.evidence.expected) : ""}
                </div>
              `
              : ""
          }


          ${
            check.fix
              ? `

                <div class="fix">

                  🔧 <strong>Fix:</strong>

                  ${escapeHTML(check.fix)}

                </div>

              `
              : ""
          }


          ${mentorButton}

        </div>

      `;

    }
  );


  result.innerHTML = `

    <div class="score-box">

      <div>
        🛡️ Security Score
      </div>

      <div class="score">

        ${escapeHTML(score)}/100

      </div>

      <div class="risk">

        Risk Level:
        ${escapeHTML(riskLevel)}

      </div>

      <div class="scan-id">

        Scan ID:
        ${escapeHTML(
          data.scanId ||
          "N/A"
        )}

      </div>

    </div>


    <div class="health">

      <h3>
        🛡️ Security Health Center
      </h3>

      <p class="message">

        Your security status at a glance,
        with the most important actions first.

      </p>


      <div class="summary">

        <div class="summary-box">

          <div class="summary-number">
            ${checks.length}
          </div>

          Total Checks

        </div>


        <div class="summary-box">

          <div class="summary-number">
            ${passed}
          </div>

          Passed

        </div>


        <div class="summary-box">

          <div class="summary-number">
            ${warnings}
          </div>

          Warnings

        </div>

      </div>


      <h3>
        🎯 Priority Fixes
      </h3>

      ${priorityHTML}
      
      ${attackSurfaceHTML}
      ${surfaceFindingsHTML}
      ${technologyFindingsHTML}
      ${clientEndpointFindingsHTML}
      ${linkedResourceFindingsHTML}
      ${applicationFindingsHTML}

      <div class="action-plan">

        <h3>
          🚀 Recommended Action Plan
        </h3>

        <ol>

          <li>
            Start with the highest-priority warning.
          </li>

          <li>
            Review the defensive fix recommended
            by Sentinel AI.
          </li>

          <li>
            Apply the appropriate configuration
            on your website/server.
          </li>

          <li>
            Run Sentinel AI again to verify the result.
          </li>

        </ol>

      </div>

    </div>


    <div
      class="mentor"
      id="mentorBox"
    >

      <h3>
        🤖 AI Security Mentor
      </h3>

      <div class="ai-badge">

        AI-powered · Defensive guidance only

      </div>

      <p class="message">

        Select a WARNING or INFO finding below to ask
        the AI Security Mentor for an explanation
        and practical defensive guidance.

      </p>

      <div id="mentorOutput"></div>

    </div>


    <div class="report">

      <h3>
        📄 Professional Security Report
      </h3>

      <p class="message">

        Generate a structured security-awareness
        report from this scan.

      </p>

      <button
        type="button"
        data-action="generate-professional-report"
      >

        📄 Generate Professional Security Report

      </button>

    </div>


    <div>

      <h3 class="report-detail-heading">

        🔎 Detailed Security Checks

      </h3>

      ${checksHTML}

    </div>


    <button
      class="secondary-button"
      type="button"
      data-action="run-security-scan" data-rescan="true"
    >

      🔄 Re-scan This Website

    </button>

  `;


  result.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


/* =========================
   AI SECURITY MENTOR
========================= */

async function askSecurityMentor(index) {

  if (
    !latestScan ||
    !Array.isArray(
      latestScan.checks
    )
  ) {

    return;

  }


  const finding =
    latestScan.checks[index];


  if (!finding) {
    return;
  }


  const mentorOutput =
    document.getElementById(
      "mentorOutput"
    );


  const mentorBox =
    document.getElementById(
      "mentorBox"
    );


  if (
    !mentorOutput ||
    !mentorBox
  ) {

    return;

  }


  mentorBox.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });


  mentorOutput.innerHTML = `

    <div class="notice">

      🤖 AI Security Mentor is analyzing:

      <br><br>

      <strong>
        ${escapeHTML(
          finding.name ||
          "Security Finding"
        )}
      </strong>

      <br><br>

      Please wait...

    </div>

  `;


  try {

    const { data: mentorAuth } = await supabaseClient.auth.getSession();
    const mentorAccessToken = mentorAuth?.session?.access_token;

    const response =
      await fetch(
        "/api/assistant",
        {

          method: "POST",

          headers: {
            "Content-Type": "application/json",
            ...(mentorAccessToken ? { "Authorization": "Bearer " + mentorAccessToken } : {})
          },

          body: JSON.stringify({

            finding:
              finding.name ||
              "Security Finding",

            severity:
              finding.severity ||
              (
                finding.status ===
                "WARNING"
                  ? "Medium"
                  : "Info"
              ),

            website:
              latestScan.website ||
              latestScan.finalUrl ||
              "",

            status: finding.status || "UNKNOWN",
            message: finding.message || finding.description || "",
            fix: finding.fix || finding.recommendation || "",
            evidence: finding.evidence || null

          })

        }
      );


    let data = null;


    try {

      data =
        await response.json();

    } catch {

      data = null;

    }


    if (!response.ok) {

      throw new Error(
        data?.error ||
        "AI Security Mentor request failed."
      );

    }


    if (
      !data ||
      !data.assistant
    ) {

      throw new Error(
        "AI Security Mentor returned an invalid response."
      );

    }

trackSentinelEvent("ai_mentor_used");
    const assistant =
      data.assistant;
    const mentorFallbackReasons = {
      missing_api_key: "OpenAI API key is not configured",
      upstream_http_401: "OpenAI rejected the API key",
      upstream_http_429: "OpenAI rate limit or quota was reached",
      upstream_http_400: "OpenAI rejected the request configuration",
      invalid_ai_output: "AI returned an invalid response format",
      empty_ai_output: "AI returned no usable text",
      invalid_upstream_json: "AI service returned invalid JSON",
      upstream_response_too_large: "AI response exceeded the safety size limit",
      upstream_response_timeout: "AI response exceeded the time limit",
      upstream_request_failed: "AI service request failed",
      upstream_unverified: "AI response could not be verified"
    };
    const mentorVerificationText = data.aiPowered === true
      ? "✓ AI-GENERATED — response format and safety checks passed; factual claims are not independently verified."
      : "BUILT-IN GUIDANCE — AI service unavailable: " +
        (mentorFallbackReasons[data.fallbackReason] || "built-in guidance used");


    const steps =
      Array.isArray(
        assistant.steps
      )
        ? assistant.steps
        : [];


    const stepsHTML =
      steps.length
        ? `

          <ol>

            ${steps
              .map(
                step =>
                  `

                    <li>
                      ${escapeHTML(step)}
                    </li>

                  `
              )
              .join("")}

          </ol>

        `
        : `

          <p>
            Review the affected security
            configuration and apply an
            appropriate defensive fix.
          </p>

        `;


    mentorOutput.innerHTML = `

      <div class="mentor-item">

        <strong>
          🔎 Finding
        </strong>

        <p>
          ${escapeHTML(
            assistant.title ||
            finding.name ||
            "Security Finding"
          )}
        </p>

      </div>


      <div class="mentor-item">

        <strong>
          💡 Explanation
        </strong>

        <p>
          ${escapeHTML(
            assistant.explanation ||
            "No explanation was returned."
          )}
        </p>

      </div>


      <div class="mentor-item">

        <strong>
          ⚠️ Why It Matters
        </strong>

        <p>
          ${escapeHTML(
            assistant.why_it_matters ||
            "This finding should be reviewed as part of the website's defensive security configuration."
          )}
        </p>

      </div>


      <div class="mentor-item">

        <strong>
          🛠️ Defensive Action
        </strong>

        <p>
          ${escapeHTML(
            assistant.defensive_action ||
            "Review the affected security configuration."
          )}
        </p>

      </div>


      <div class="mentor-item">

        <strong>
          📋 Recommended Steps
        </strong>

        ${stepsHTML}

      </div>


      <div class="mentor-item">

        <strong>
          ✅ Verification
        </strong>

        <p>
          ${escapeHTML(
            assistant.verification ||
            "Run the Sentinel AI scan again to verify the fix."
          )}
        </p>

      </div>


      <div class="ai-badge">

        ${escapeHTML(mentorVerificationText)}

      </div>

    `;


  } catch (error) {

    console.error(
      "AI Mentor Error:",
      error
    );


    mentorOutput.innerHTML = `

      <div class="error">

        ❌ AI Security Mentor could not
        respond right now.

        <br><br>

        ${escapeHTML(
          error?.message ||
          "Please try again."
        )}

      </div>

    `;

  }

}


/* =========================
   PROFESSIONAL REPORT
========================= */

async function generateProfessionalReport(button) {

  if (!latestScan) {
    alert("Please run a security scan first.");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "📄 Generating Report...";
  }

  try {
    const reportChecks = Array.isArray(latestScan.checks)
      ? latestScan.checks
      : [];

    const { data: reportAuth } = await supabaseClient.auth.getSession();
    const reportAccessToken = reportAuth?.session?.access_token;
    const response = await fetch("/api/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(reportAccessToken ? { "Authorization": "Bearer " + reportAccessToken } : {})
      },
      body: JSON.stringify({
        website: latestScan.website || latestScan.finalUrl || "",
        securityScore: Number(latestScan.score ?? latestScan.securityScore ?? 0),
        riskLevel: latestScan.riskLevel || "Unknown",
        checks: reportChecks,
        scanId: latestScan.scanId || ""
      })
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      throw new Error("The report service returned an unreadable response.");
    }

    if (!response.ok || !payload.success || !payload.report) {
      throw new Error(payload.error || "The report could not be generated.");
    }

    const report = payload.report;
    const summary = report.executiveSummary || {};
    const safe = value => escapeHTML(value == null ? "" : String(value));

    const findingsHTML = reportChecks.map(check => {
      const evidence = check.evidence && typeof check.evidence === "object"
        ? `
          <p><strong>Evidence source:</strong> ${safe(check.evidence.source || "Not supplied")}</p>
          <p><strong>Observed:</strong> ${safe(check.evidence.observed || "Not supplied")}</p>
          <p><strong>Expected:</strong> ${safe(check.evidence.expected || "Not supplied")}</p>
        `
        : "";

      return `
        <article class="finding">
          <h3>${safe(check.name || check.title || "Security Check")}</h3>
          <p><strong>Status:</strong> ${safe(check.status || "INFO")}</p>
          <p>${safe(check.message || check.description || "")}</p>
          ${check.fix || check.recommendation
            ? `<p><strong>Recommended fix:</strong> ${safe(check.fix || check.recommendation)}</p>`
            : ""}
          ${evidence}
        </article>
      `;
    }).join("");

    const priorityHTML = (report.priorityFindings || []).map(item => `
      <li>
        <strong>${safe(item.title)}</strong> — ${safe(item.message)}
        <p><strong>Recommended fix:</strong> ${safe(item.fix)}</p>
      </li>
    `).join("");

    const reportDataJSON = JSON.stringify({ report, checks: reportChecks }).replace(/</g, "\\u003c");
    const reportHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sentinel AI Professional Security Report</title>
<script defer src="/sentinel-actions.js"><\/script>
<link rel="stylesheet" href="/sentinel-report.css">
</head>
<body>
<button class="print" data-action="print-report">Print / Save as PDF</button>
<button class="print" type="button" data-action="export-security-report-csv">Download CSV</button>
<header>
  <h1>🛡️ Sentinel AI</h1>
  <h2>Professional Security-Awareness Report</h2>
  <p><strong>Website:</strong> ${safe(report.website)}</p>
  <p><strong>Scan ID:</strong> ${safe(report.scanId || "N/A")}</p>
  <p><strong>Generated:</strong> ${safe(report.generatedAt)}</p>
  <div class="score">${safe(report.securityScore)}/100</div>
  <p><strong>Risk level:</strong> ${safe(report.riskLevel)}</p>
</header>
<section>
  <h2>Executive Summary</h2>
  <div class="stats">
    <div class="stat"><strong>Total checks</strong><br>${safe(summary.totalChecks ?? 0)}</div>
    <div class="stat"><strong>Passed</strong><br>${safe(summary.passed ?? 0)}</div>
    <div class="stat"><strong>Warnings</strong><br>${safe(summary.warnings ?? 0)}</div>
    <div class="stat"><strong>Informational</strong><br>${safe(summary.informational ?? 0)}</div>
    <div class="stat"><strong>Evidence-backed checks</strong><br>${safe(summary.evidenceBackedFindings ?? 0)}</div>
    <div class="stat"><strong>Priority issues</strong><br>${safe(summary.priorityIssues ?? 0)}</div>
  </div>
</section>
<section>
  <h2>Priority Recommendations</h2>
  ${priorityHTML ? `<ol>${priorityHTML}</ol>` : "<p>No priority warnings were returned by the report service.</p>"}
</section>
<section>
  <h2>Detailed Security Checks</h2>
  ${findingsHTML || "<p>No scan checks were available.</p>"}
</section>
<section>
  <h2>Next Steps</h2>
  <ol>${(report.nextSteps || []).map(step => `<li>${safe(step)}</li>`).join("")}</ol>
</section>
<section>
  <h2>Limitations and Disclaimer</h2>
  <p>${safe(report.disclaimer)}</p>
  <p>Sentinel AI checks publicly observable security signals. This report is not a substitute for a complete professional security assessment.</p>
</section>
<p>Sentinel AI · AI Cybersecurity Scanner &amp; Security Education Platform</p>
<script type="application/json" id="sentinelReportData">${reportDataJSON}</script>
</body>
</html>`;

    const reportBlob = new Blob([reportHTML], { type: "text/html;charset=utf-8" });
    const reportUrl = URL.createObjectURL(reportBlob);

    trackSentinelEvent("report_generated");
    window.location.assign(reportUrl);

  } catch (error) {
    console.error("Professional Report Error:", error);
    alert(error && error.message
      ? "Report generation failed: " + error.message
      : "Report generation failed. Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "📄 Generate Professional Security Report";
    }
  }
}


/* =========================
   LOCAL + CLOUD SCAN HISTORY
========================= */

async function saveScanHistory(scan) {

  try {

    const history =
      JSON.parse(
        localStorage.getItem(
          "sentinelScanHistory"
        ) || "[]"
      );


    const item = {

      website:
        scan.website ||
        scan.finalUrl ||
        "",

      score:
        Number(
          scan.score ??
          scan.securityScore ??
          0
        ),

      riskLevel:
        scan.riskLevel ||
        "Unknown",

      scanId:
        scan.scanId ||
        "N/A",

      date:
        new Date()
          .toLocaleString()

    };


    history.unshift(
      item
    );


    localStorage.setItem(
      "sentinelScanHistory",
      JSON.stringify(
        history.slice(0, 10)
      )
    );


    renderScanHistory();


    /* Save to cloud if logged in */
    await saveScanToSupabase(
      scan
    );


  } catch (error) {

    console.error(
      "History Error:",
      error
    );

  }

}


/* =========================
   RENDER LOCAL HISTORY
========================= */

function renderScanHistory() {

  const list =
    document.getElementById(
      "historyList"
    );


  if (!list) {
    return;
  }


  try {

    const history =
      JSON.parse(
        localStorage.getItem(
          "sentinelScanHistory"
        ) || "[]"
      );


    if (!history.length) {

      list.innerHTML = `

        <div class="empty-history">

          No local scans saved yet.
          Run your first security check above.

        </div>

      `;

      return;

    }


    list.innerHTML =
      history
        .map(
          item => `

            <div class="history-item">

              <strong>
                ${escapeHTML(
                  item.website
                )}
              </strong>

              <div class="history-score">

                Score:
                ${escapeHTML(
                  item.score
                )}/100

                ·

                ${escapeHTML(
                  item.riskLevel
                )}

              </div>

              <div class="message">

                ${escapeHTML(
                  item.date
                )}

                · Scan ID:

                ${escapeHTML(
                  item.scanId
                )}

                · 📱 Local

              </div>

            </div>

          `
        )
        .join("");


  } catch {

    list.innerHTML = `

      <div class="empty-history">

        Unable to load local scan history.

      </div>

    `;

  }

}


/* =========================
   CLEAR LOCAL + CLOUD HISTORY
========================= */

async function clearScanHistory() {

  const confirmed =
    confirm(
      "Clear your Sentinel AI scan history?"
    );


  if (!confirmed) {
    return;
  }


  await clearSupabaseHistory();

}


/* =========================
   VULNERABILITY INTELLIGENCE
========================= */

function renderVulnerabilityIntelligence(result) {
  const node = document.getElementById("intelResults");
  if (!node) return;
  const cve = result?.cve || {};
  const kev = result?.kev || {};
  const meta = result?.meta || {};

  if (!cve.found) {
    node.innerHTML = `
      <div class="intel-result">
        <h3>${escapeHTML(cve.id || "CVE lookup")}</h3>
        <p>No matching record was returned by the NVD API.</p>
        ${kev.listed === true ? '<p><strong>CISA KEV:</strong> This CVE is listed in the KEV catalog.</p>' : ""}
      </div>
    `;
    return;
  }

  const cvss = cve.cvss;
  const kevStatus = kev.listed === true
    ? '<p><strong>CISA KEV:</strong> Listed as a known exploited vulnerability.</p>'
    : kev.listed === false
      ? '<p><strong>CISA KEV:</strong> Not listed in this catalog snapshot. This does not prove that the vulnerability is not exploited.</p>'
      : '<p><strong>CISA KEV:</strong> Catalog unavailable; no KEV determination can be made.</p>';

  const kevEntry = kev.entry ? `
    <div class="intel-result">
      <h4>CISA KEV details</h4>
      <div class="intel-meta">${escapeHTML(kev.entry.vendor || "")} · ${escapeHTML(kev.entry.product || "")}</div>
      <p>${escapeHTML(kev.entry.name || "")}</p>
      <p>${escapeHTML(kev.entry.description || "")}</p>
      <p><strong>Required action:</strong> ${escapeHTML(kev.entry.required_action || "See the official CISA record.")}</p>
      <div class="intel-meta">Added: ${escapeHTML(kev.entry.date_added || "Unknown")} · Due date: ${escapeHTML(kev.entry.due_date || "Not specified")} · Ransomware use: ${escapeHTML(kev.entry.ransomware_use || "Unknown")}</div>
    </div>
  ` : "";

  const affectedProducts = Array.isArray(cve.affected_products) ? cve.affected_products : [];
  const cpe = Array.isArray(cve.cpe_matches) ? cve.cpe_matches : [];
  const references = Array.isArray(cve.references) ? cve.references : [];
  const weaknesses = Array.isArray(cve.weaknesses) ? cve.weaknesses : [];

  node.innerHTML = `
    <div class="intel-result">
      <h3>${escapeHTML(cve.id)}</h3>
      <div class="intel-meta">NVD status: ${escapeHTML(cve.status || "Unknown")} · Published: ${escapeHTML(cve.published || "Unknown")} · Modified: ${escapeHTML(cve.last_modified || "Unknown")}</div>
      <p>${escapeHTML(cve.description || "No English description was supplied.")}</p>
      <h4>CVSS assessment</h4>
      ${cvss
        ? '<span class="intel-chip">CVSS ' + escapeHTML(cvss.version || "Unknown") + '</span><span class="intel-chip">' + escapeHTML(cvss.base_score == null ? "No score" : cvss.base_score + "/10") + '</span><span class="intel-chip">' + escapeHTML(cvss.severity || "Unrated") + '</span><p class="intel-meta">CVSS is a base severity metric, not a complete risk assessment for your environment.</p>'
        : '<p>No NVD CVSS score is currently attached to this record.</p>'}
      ${kevStatus}
      <div class="intel-meta">CISA catalog: ${escapeHTML(kev.catalog_version || "Unavailable")} · Released: ${escapeHTML(kev.date_released || "Unknown")} ${kev.stale ? "· cached/stale snapshot" : ""}</div>
      ${kev.absence_note ? '<p class="intel-meta">' + escapeHTML(kev.absence_note) + '</p>' : ""}
      ${kevEntry}
      <h4>Weakness classifications</h4>
      <p>${weaknesses.length ? weaknesses.map(value => '<span class="intel-chip">' + escapeHTML(value) + '</span>').join("") : "No CWE classification supplied."}</p>
      <h4>NVD affected product/version data</h4>
      ${affectedProducts.length ? affectedProducts.map(item => `
        <div class="monitoring-run">
          <strong>${escapeHTML(item.vendor)} · ${escapeHTML(item.product)}</strong>
          <div class="intel-meta">Version: ${escapeHTML(item.version || "Not specified")} · Less than: ${escapeHTML(item.less_than || "Not specified")} · Type: ${escapeHTML(item.version_type || "Unknown")} · Source status: ${escapeHTML(item.status)}</div>
          ${item.changes?.length ? '<div class="intel-meta">Version changes: ' + item.changes.map(change => escapeHTML(change.at) + ' → ' + escapeHTML(change.status)).join(" · ") + '</div>' : ""}
        </div>
      `).join("") : "<p>No affected product/version data supplied in the NVD record.</p>"}
      <h4>NVD affected-product criteria</h4>
      ${cpe.length ? cpe.map(item => `
        <div class="monitoring-run">
          <div>${escapeHTML(item.criteria)}</div>
          <div class="intel-meta">Vulnerable flag: ${item.vulnerable ? "Yes" : "No"} · Start: ${escapeHTML(item.version_start_including || item.version_start_excluding || "Not specified")} · End: ${escapeHTML(item.version_end_including || item.version_end_excluding || "Not specified")}</div>
        </div>
      `).join("") : "<p>No CPE applicability criteria were supplied.</p>"}
      <p class="notice">${escapeHTML(result.applicability_note || "Verify the exact vendor, product, version, and configuration before treating this CVE as applicable.")}</p>
      <h4>References</h4>
      ${references.length ? references.map(item => '<p><a href="' + escapeHTML(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(item.url) + '</a></p>').join("") : "<p>No references supplied.</p>"}
      <div class="research-actions">
        <a href="${escapeHTML(result.sources?.nvd || "https://nvd.nist.gov/")}" target="_blank" rel="noopener noreferrer">Open NVD record</a>
        <a href="${escapeHTML(result.sources?.cisa_kev || "https://www.cisa.gov/known-exploited-vulnerabilities-catalog")}" target="_blank" rel="noopener noreferrer">Open CISA KEV catalog</a>
      </div>
      <div class="intel-meta">NVD data fetched: ${escapeHTML(meta.nvd_fetched_at || "Unknown")} ${meta.nvd_stale ? "· cached/stale record" : ""}</div>
    </div>
  `;
}

async function lookupVulnerability() {
  const input = document.getElementById("intelCveInput");
  const status = document.getElementById("intelStatus");
  const results = document.getElementById("intelResults");
  const cve = input?.value.trim();
  if (!cve) {
    status.className = "error";
    status.textContent = "Enter a CVE ID first.";
    return;
  }

  status.className = "notice";
  status.textContent = "Checking NVD and CISA sources...";
  if (results) results.innerHTML = "";
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("Log in to use vulnerability intelligence.");

    const response = await fetch("/api/intelligence?cve=" + encodeURIComponent(cve), {
      headers: { "Authorization": "Bearer " + token }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "CVE lookup failed.");
    renderVulnerabilityIntelligence(payload.result);
    status.className = "success";
    status.textContent = "Lookup complete. Verify affected product versions against the official vendor advisory.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to load vulnerability intelligence.";
  }
}


/* =========================
   RESEARCH WORKSPACE
========================= */

let researchWorkspaceData = {
  projects: [],
  verified_assets: [],
  findings: [],
  notes: []
};

async function researchRequest(payload = null) {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error("Please log in to use the research workspace.");

  const response = await fetch("/api/research", {
    method: payload ? "POST" : "GET",
    headers: {
      "Authorization": "Bearer " + token,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(result.error || "Research workspace request failed.");
    failure.payload = result;
    throw failure;
  }
  return result;
}

function renderResearchWorkspace(data) {
  researchWorkspaceData = data;
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const assets = Array.isArray(data.verified_assets) ? data.verified_assets : [];
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const notes = Array.isArray(data.notes) ? data.notes : [];

  const projectSelect = document.getElementById("researchProjectSelect");
  if (projectSelect) {
    projectSelect.innerHTML = '<option value="">Select a research project</option>' +
      projects.filter(project => project.status === "active").map(project =>
        '<option value="' + escapeHTML(project.id) + '">' + escapeHTML(project.name) + '</option>'
      ).join("");
  }

  const assetSelect = document.getElementById("researchAssetSelect");
  if (assetSelect) {
    assetSelect.innerHTML = '<option value="">Select a verified website</option>' +
      assets.map(asset =>
        '<option value="' + escapeHTML(asset.id) + '">' +
        escapeHTML(asset.hostname + " · " + asset.url) + '</option>'
      ).join("");
  }

  const projectsNode = document.getElementById("researchProjects");
  if (projectsNode) {
    projectsNode.innerHTML = projects.length ? projects.map(project => {
      const count = findings.filter(finding => finding.project_id === project.id).length;
      return `
        <div class="research-project">
          <h4>${escapeHTML(project.name)}</h4>
          <div class="research-meta">${escapeHTML(project.status)} · ${count} finding(s)</div>
          ${project.description ? '<p>' + escapeHTML(project.description) + '</p>' : ""}
          <div class="research-actions">
            <button class="secondary-button" type="button" data-action="export-research-project" data-project-id="${escapeHTML(project.id)}">Copy Report</button>
            <button class="secondary-button" type="button" data-action="set-research-project-status" data-project-id="${escapeHTML(project.id)}" data-status="${project.status === "active" ? "archived" : "active"}">${project.status === "active" ? "Archive" : "Reopen"}</button>
            <button class="secondary-button" type="button" data-action="delete-research-project" data-project-id="${escapeHTML(project.id)}">Delete</button>
          </div>
        </div>
      `;
    }).join("") : '<div class="empty-history">Create your first research project above.</div>';
  }

  const findingsNode = document.getElementById("researchFindings");
  if (findingsNode) {
    findingsNode.innerHTML = findings.length ? findings.map(finding => {
      const findingNotes = notes.filter(note => note.finding_id === finding.id);
      return `
        <div class="research-finding">
          <h4>${escapeHTML(finding.title)}</h4>
          <div class="research-meta">${escapeHTML(finding.severity)} · ${escapeHTML(finding.status)} · ${escapeHTML(finding.asset_hostname)}</div>
          <div class="research-meta">Endpoint: ${escapeHTML(finding.endpoint_path)}</div>
          <p>${escapeHTML(finding.description)}</p>
          ${finding.impact ? '<p><strong>Impact:</strong> ' + escapeHTML(finding.impact) + '</p>' : ""}
          ${finding.remediation ? '<p><strong>Remediation:</strong> ' + escapeHTML(finding.remediation) + '</p>' : ""}
          ${Array.isArray(finding.evidence) && finding.evidence.length
            ? '<div class="research-meta"><strong>Evidence:</strong> ' + escapeHTML(finding.evidence.map(item => item.observed).join(" · ")) + '</div>'
            : ""}
          <label for="researchStatus-${escapeHTML(finding.id)}">Finding status</label>
          <select id="researchStatus-${escapeHTML(finding.id)}" data-action="update-research-finding-status" data-finding-id="${escapeHTML(finding.id)}">
            ${["new","triaged","accepted","remediating","resolved","false_positive"].map(status =>
              '<option value="' + status + '"' + (finding.status === status ? " selected" : "") + '>' + status.replace("_"," ") + '</option>'
            ).join("")}
          </select>
          <div class="research-notes">
            <strong>Research notes</strong>
            ${findingNotes.map(note => '<p class="research-meta">' + escapeHTML(note.content) + '</p>').join("")}
            <textarea id="researchNote-${escapeHTML(finding.id)}" rows="2" maxlength="5000" placeholder="Add a private research note"></textarea>
            <div class="research-actions">
              <button class="secondary-button" type="button" data-action="add-research-note" data-finding-id="${escapeHTML(finding.id)}">Add Note</button>
              <button class="secondary-button" type="button" data-action="delete-research-finding" data-finding-id="${escapeHTML(finding.id)}">Delete Finding</button>
            </div>
          </div>
        </div>
      `;
    }).join("") : '<div class="empty-history">No findings yet. Create a project and add a finding for a verified asset.</div>';
  }

  renderResearchCaseWorkflow(data);
}

function renderResearchCaseWorkflow(data) {
  const cases = Array.isArray(data.research_cases) ? data.research_cases : [];
  const ownerCases = cases.filter(item => item.viewer_role === "owner");
  const ownerReviewers = Array.isArray(data.owner_reviewers) ? data.owner_reviewers : [];
  const approvals = [
    ...(Array.isArray(data.case_approvals) ? data.case_approvals.map(item => ({ ...item, viewer_role: "owner" })) : []),
    ...(Array.isArray(data.reviewer_approvals) ? data.reviewer_approvals.map(item => ({ ...item, viewer_role: "reviewer" })) : [])
  ];
  const caseNode = document.getElementById("researchCases");
  if (caseNode) {
    caseNode.innerHTML = cases.length ? cases.map(item => {
      const assets = Array.isArray(item.authorized_assets) ? item.authorized_assets : [];
      const paths = assets.flatMap(asset => Array.isArray(asset.paths) ? asset.paths : []);
      const caseEvents = (data.case_events || []).filter(event => event.case_id === item.id);
      const assignedReviewers = ownerReviewers.filter(reviewer => reviewer.case_id === item.id);
      const reviewerMarkup = assignedReviewers.map(reviewer =>
        '<div class="research-meta">Reviewer: ' + escapeHTML(reviewer.reviewer_user_id) + ' · ' + escapeHTML(reviewer.status) +
        (reviewer.status === "active"
          ? ' <button class="secondary-button" type="button" data-action="revoke-research-reviewer" data-case-id="' + escapeHTML(item.id) + '" data-reviewer-id="' + escapeHTML(reviewer.reviewer_user_id) + '">Revoke Reviewer</button>'
          : "") + '</div>'
      ).join("");
      let actions = "";
      if (item.viewer_role === "owner") {
        if (["draft", "rejected"].includes(item.authorization_status)) {
          actions += '<button class="secondary-button" type="button" data-action="submit-research-case" data-case-id="' + escapeHTML(item.id) + '">Submit for Independent Review</button>';
        }
        if (["authorized", "pending_review"].includes(item.authorization_status)) {
          actions += '<button class="secondary-button" type="button" data-action="revoke-research-case" data-case-id="' + escapeHTML(item.id) + '">Revoke Case Authorization</button>';
        }
      } else if (item.authorization_status === "pending_review") {
        actions += '<button class="secondary-button" type="button" data-action="review-research-case" data-case-id="' + escapeHTML(item.id) + '" data-decision="authorized">Approve Authorization</button><button class="secondary-button" type="button" data-action="review-research-case" data-case-id="' + escapeHTML(item.id) + '" data-decision="rejected">Reject</button>';
      }
      return '<div class="research-project">' +
        '<h4>' + escapeHTML(item.title) + '</h4>' +
        '<div class="research-meta">' + escapeHTML(item.authorization_status) + ' · ' + escapeHTML(item.viewer_role) + '</div>' +
        '<p>' + escapeHTML(item.description || "") + '</p>' +
        '<div class="research-meta">Authorized assets: ' + escapeHTML(assets.map(asset => asset.origin).join(", ")) + '</div>' +
        '<div class="research-meta">Allowed paths: ' + escapeHTML(paths.join(", ")) + '</div>' +
        '<div class="research-meta">Scope expires: ' + escapeHTML(item.scope_expires_at || "Not set") + '</div>' +
        reviewerMarkup +
        '<div class="research-meta">Audit events: ' + caseEvents.length + '</div>' +
        '<div class="research-actions">' + actions + '</div>' +
        '</div>';
    }).join("") : '<div class="empty-history">No authorization cases yet. Create a written-authorization case above.</div>';
  }

  const reviewerCaseSelect = document.getElementById("researchReviewerCaseSelect");
  if (reviewerCaseSelect) {
    reviewerCaseSelect.innerHTML = '<option value="">Select your case</option>' +
      ownerCases.map(item => '<option value="' + escapeHTML(item.id) + '">' +
        escapeHTML(item.title + " · " + item.authorization_status) + '</option>').join("");
  }
  const planCaseSelect = document.getElementById("researchPlanCaseSelect");
  if (planCaseSelect) {
    planCaseSelect.innerHTML = '<option value="">Select an authorized case</option>' +
      ownerCases.filter(item => item.authorization_status === "authorized").map(item =>
        '<option value="' + escapeHTML(item.id) + '">' + escapeHTML(item.title) + '</option>'
      ).join("");
  }

  const approvalsNode = document.getElementById("researchApprovals");
  if (approvalsNode) {
    approvalsNode.innerHTML = approvals.length ? approvals.map(item => {
      const actionButtons = item.viewer_role === "reviewer"
        ? (item.status === "pending"
          ? '<button class="secondary-button" type="button" data-action="decide-research-plan-approval" data-approval-id="' + escapeHTML(item.id) + '" data-decision="approved">Approve Plan</button><button class="secondary-button" type="button" data-action="decide-research-plan-approval" data-approval-id="' + escapeHTML(item.id) + '" data-decision="rejected">Reject Plan</button>'
          : item.status === "approved"
            ? '<button class="secondary-button" type="button" data-action="revoke-research-plan-approval" data-approval-id="' + escapeHTML(item.id) + '">Revoke Approval</button>'
            : "")
        : "";
      return '<div class="research-project">' +
        '<h4>' + escapeHTML(item.target_origin + item.target_path) + '</h4>' +
        '<div class="research-meta">' + escapeHTML(item.method + " · " + item.test_category + " · " + item.status) + '</div>' +
        '<div class="research-meta">Role: ' + escapeHTML(item.viewer_role) + ' · Expires: ' + escapeHTML(item.expires_at || "Not approved") + '</div>' +
        '<div class="research-actions">' + actionButtons + '</div>' +
        '</div>';
    }).join("") : '<div class="empty-history">No per-plan approvals have been requested.</div>';
  }
}

async function loadResearchWorkspace() {
  const status = document.getElementById("researchStatus");
  if (!status) return;
  try {
    const data = await researchRequest();
    renderResearchWorkspace(data);
    status.className = "success";
    status.textContent = data.verified_assets?.length
      ? "Research workspace ready. Only your verified domains can be used as assets."
      : "Create a project now. Verify a domain in Monitoring before recording findings.";
  } catch (error) {
    status.className = "notice";
    status.textContent = error?.message || "Log in to use the research workspace.";
    const projects = document.getElementById("researchProjects");
    const findings = document.getElementById("researchFindings");
    if (projects) projects.innerHTML = "";
    if (findings) findings.innerHTML = "";
  }
}

function researchListInput(value) {
  return String(value || "").split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
}

async function createResearchCase() {
  const status = document.getElementById("researchStatus");
  try {
    const starts = document.getElementById("researchScopeStartsAt")?.value;
    const expires = document.getElementById("researchScopeExpiresAt")?.value;
    const origin = document.getElementById("researchAuthorizedOrigin")?.value.trim();
    const payload = {
      action: "create_case",
      title: document.getElementById("researchCaseTitle")?.value.trim(),
      description: document.getElementById("researchCaseDescription")?.value.trim() || "",
      authorizationReference: document.getElementById("researchAuthorizationReference")?.value.trim(),
      authorizationEvidence: [{
        label: document.getElementById("researchAuthorizationEvidenceLabel")?.value.trim(),
        reference: document.getElementById("researchAuthorizationEvidenceReference")?.value.trim()
      }],
      authorizedAssets: [{
        origin,
        paths: researchListInput(document.getElementById("researchAuthorizedPaths")?.value),
        excluded_paths: researchListInput(document.getElementById("researchExcludedPaths")?.value)
      }],
      allowedMethods: researchListInput(document.getElementById("researchAllowedMethods")?.value).map(value => value.toUpperCase()),
      allowedTestCategories: researchListInput(document.getElementById("researchAllowedCategories")?.value),
      scopeStartsAt: starts ? new Date(starts).toISOString() : "",
      scopeExpiresAt: expires ? new Date(expires).toISOString() : ""
    };
    await researchRequest(payload);
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Authorization case created as a draft. Assign an independent reviewer before submitting it.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to create the authorization case.";
  }
}

async function assignResearchReviewer() {
  const status = document.getElementById("researchStatus");
  try {
    await researchRequest({
      action: "assign_reviewer",
      caseId: document.getElementById("researchReviewerCaseSelect")?.value,
      reviewerUserId: document.getElementById("researchReviewerUserId")?.value.trim()
    });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Independent reviewer assigned.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to assign the reviewer.";
  }
}

async function submitResearchCase(caseId) {
  const status = document.getElementById("researchStatus");
  try {
    await researchRequest({ action: "submit_case_for_review", caseId });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Case submitted for independent review.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to submit the case.";
  }
}

async function reviewResearchCase(caseId, decision) {
  const status = document.getElementById("researchStatus");
  try {
    await researchRequest({ action: "review_case", caseId, decision });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Authorization review recorded.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to review the case.";
  }
}

async function revokeResearchCase(caseId) {
  if (!confirm("Revoke this authorization case and all pending or approved plans?")) return;
  const status = document.getElementById("researchStatus");
  try {
    await researchRequest({ action: "revoke_case_authorization", caseId });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Case authorization revoked. Its pending and approved plans were also revoked.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to revoke the case authorization.";
  }
}

async function revokeResearchReviewer(caseId, reviewerUserId) {
  if (!confirm("Revoke this reviewer assignment and their pending or approved plans?")) return;
  const status = document.getElementById("researchStatus");
  try {
    await researchRequest({ action: "revoke_reviewer", caseId, reviewerUserId });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Reviewer assignment revoked. Their pending and approved plans were also revoked.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to revoke the reviewer assignment.";
  }
}

async function requestResearchPlanApproval() {
  const status = document.getElementById("researchStatus");
  try {
    const result = await researchRequest({
      action: "request_plan_approval",
      caseId: document.getElementById("researchPlanCaseSelect")?.value,
      targetUrl: document.getElementById("researchPlanTargetUrl")?.value.trim(),
      method: document.getElementById("researchPlanMethod")?.value,
      testCategory: document.getElementById("researchPlanCategory")?.value.trim()
    });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Plan sent to the assigned independent reviewer. No target traffic was sent.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to request plan approval.";
  }
}

async function decideResearchPlanApproval(approvalId, decision) {
  const status = document.getElementById("researchStatus");
  try {
    await researchRequest({ action: "decide_plan_approval", approvalId, decision });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Per-plan review decision recorded.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to review the plan.";
  }
}

async function revokeResearchPlanApproval(approvalId) {
  const status = document.getElementById("researchStatus");
  if (!confirm("Revoke this plan approval immediately?")) return;
  try {
    await researchRequest({ action: "revoke_plan_approval", approvalId });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Plan approval revoked.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to revoke the plan approval.";
  }
}

async function checkResearchScope() {
  const output = document.getElementById("researchScopeDecision");
  try {
    const result = await researchRequest({
      action: "check_scope",
      caseId: document.getElementById("researchPlanCaseSelect")?.value,
      targetUrl: document.getElementById("researchPlanTargetUrl")?.value.trim(),
      method: document.getElementById("researchPlanMethod")?.value,
      testCategory: document.getElementById("researchPlanCategory")?.value.trim()
    });
    output.className = result.allowed ? "success" : "notice";
    output.textContent = result.allowed
      ? "Scope decision: ALLOWED for this exact approved plan. This is a decision only; no request was sent to the target."
      : "Scope decision: DENIED (" + (result.reason || "not permitted") + "). No request was sent to the target.";
  } catch (error) {
    const reason = error?.payload?.reason;
    output.className = "notice";
    output.textContent = reason
      ? "Scope decision: DENIED (" + reason + "). No request was sent to the target."
      : error?.message || "Unable to check the research scope.";
  }
}

async function createResearchProject() {
  const name = document.getElementById("researchProjectName")?.value.trim();
  const description = document.getElementById("researchProjectDescription")?.value.trim() || "";
  const status = document.getElementById("researchStatus");
  try {
    await researchRequest({ action: "create_project", name, description });
    document.getElementById("researchProjectName").value = "";
    document.getElementById("researchProjectDescription").value = "";
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Research project created.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to create the research project.";
  }
}

async function createResearchFinding() {
  const status = document.getElementById("researchStatus");
  const evidenceText = document.getElementById("researchFindingEvidence")?.value.trim() || "";
  const evidence = evidenceText ? [{
    source: "Researcher observation",
    signal: "Manual evidence",
    observed: evidenceText,
    expected: "Documented expected behavior"
  }] : [];
  const payload = {
    action: "create_finding",
    projectId: document.getElementById("researchProjectSelect")?.value,
    assetId: document.getElementById("researchAssetSelect")?.value,
    title: document.getElementById("researchFindingTitle")?.value.trim(),
    severity: document.getElementById("researchFindingSeverity")?.value,
    endpointPath: document.getElementById("researchFindingPath")?.value.trim(),
    description: document.getElementById("researchFindingDescription")?.value.trim(),
    impact: document.getElementById("researchFindingImpact")?.value.trim(),
    remediation: document.getElementById("researchFindingRemediation")?.value.trim(),
    evidence
  };
  try {
    await researchRequest(payload);
    ["researchFindingTitle","researchFindingPath","researchFindingDescription","researchFindingImpact","researchFindingRemediation","researchFindingEvidence"].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = "";
    });
    await loadResearchWorkspace();
    status.className = "success";
    status.textContent = "Finding saved under your verified asset.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to save this finding.";
  }
}

async function setResearchProjectStatus(projectId, projectStatus) {
  try {
    await researchRequest({ action: "set_project_status", projectId, status: projectStatus });
    await loadResearchWorkspace();
  } catch (error) {
    const status = document.getElementById("researchStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to update the project.";
  }
}

async function deleteResearchProject(projectId) {
  if (!confirm("Delete this project, its findings, and its research notes?")) return;
  try {
    await researchRequest({ action: "delete_project", projectId });
    await loadResearchWorkspace();
  } catch (error) {
    const status = document.getElementById("researchStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to delete the project.";
  }
}

async function updateResearchFindingStatus(findingId, findingStatus) {
  try {
    await researchRequest({ action: "update_finding", findingId, status: findingStatus });
    await loadResearchWorkspace();
  } catch (error) {
    const status = document.getElementById("researchStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to update the finding.";
  }
}

async function deleteResearchFinding(findingId) {
  if (!confirm("Delete this finding and its notes?")) return;
  try {
    await researchRequest({ action: "delete_finding", findingId });
    await loadResearchWorkspace();
  } catch (error) {
    const status = document.getElementById("researchStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to delete the finding.";
  }
}

async function addResearchNote(findingId) {
  const input = document.getElementById("researchNote-" + findingId);
  const content = input?.value.trim();
  if (!content) return;
  try {
    await researchRequest({ action: "add_note", findingId, content });
    await loadResearchWorkspace();
  } catch (error) {
    const status = document.getElementById("researchStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to add the note.";
  }
}

function redactResearchExportText(value) {
  return String(value ?? "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_ -]?key|access[_ -]?token|client[_ -]?secret|password|passwd|secret)\b(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_JWT]");
}

async function exportResearchProject(projectId) {
  const project = researchWorkspaceData.projects.find(item => item.id === projectId);
  if (!project) return;
  const findings = researchWorkspaceData.findings.filter(item => item.project_id === projectId);
  const includeEvidence = document.getElementById("researchExportIncludeEvidence")?.checked === true;
  const includeNotes = document.getElementById("researchExportIncludeNotes")?.checked === true;
  if ((includeEvidence || includeNotes) &&
      !confirm("This report may include private evidence or research notes. Review and redact it before sharing. Continue?")) {
    return;
  }

  const safe = redactResearchExportText;
  const lines = [
    "# " + safe(project.name),
    "",
    safe(project.description || "Security research project"),
    "",
    "Generated by Sentinel AI",
    "Private account export — review and redact before external disclosure.",
    "Evidence included: " + (includeEvidence ? "yes (secret patterns redacted)" : "no"),
    "Private notes included: " + (includeNotes ? "yes (secret patterns redacted)" : "no"),
    ""
  ];
  for (const finding of findings) {
    lines.push("## [" + safe(finding.severity).toUpperCase() + "] " + safe(finding.title));
    lines.push("");
    lines.push("- Status: " + safe(finding.status));
    lines.push("- Asset: " + safe(finding.asset_hostname));
    lines.push("- Endpoint: " + safe(finding.endpoint_path));
    lines.push("");
    lines.push(safe(finding.description));
    if (finding.impact) lines.push("\\nImpact: " + safe(finding.impact));
    if (finding.remediation) lines.push("\\nRemediation: " + safe(finding.remediation));
    if (includeEvidence) {
      const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
      for (const item of evidence) {
        lines.push("\\nEvidence (" + safe(item.source) + "): " + safe(item.observed));
      }
    }
    if (includeNotes) {
      const notes = researchWorkspaceData.notes.filter(note => note.finding_id === finding.id);
      for (const note of notes) lines.push("\\nPrivate research note: " + safe(note.content));
    }
    lines.push("");
  }
  const markdown = lines.join("\\n");
  try {
    await navigator.clipboard.writeText(markdown);
    const status = document.getElementById("researchStatus");
    status.className = "success";
    status.textContent = "Privacy-reviewed project report copied. Review it again before external disclosure.";
  } catch {
    const manualCopy = prompt("Copy your privacy-reviewed Sentinel AI research report:", markdown);
    const status = document.getElementById("researchStatus");
    if (status) {
      status.className = manualCopy === null ? "notice" : "success";
      status.textContent = manualCopy === null
        ? "Report export was cancelled."
        : "Report text is ready to copy. Review it before sharing.";
    }
  }
}


/* =========================
   PRIVATE SCAN ANALYTICS
========================= */

async function loadAnalyticsDashboard() {
  const status = document.getElementById("analyticsStatus");
  if (!status) return;

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("Log in to view your private scan analytics.");

    const response = await fetch("/api/analytics", {
      headers: { "Authorization": "Bearer " + token }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Analytics could not be loaded.");

    const analytics = payload.analytics || {};
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };

    setText("analyticsTotal", String(analytics.total_scans ?? 0));
    setText("analyticsAverage", analytics.average_score == null ? "—" : analytics.average_score + "/100");
    setText("analyticsHighRisk", String(analytics.high_risk_scans ?? 0));
    setText("analyticsRecent", String(analytics.scans_last_7_days ?? 0));
    setText("analyticsDomains", String(analytics.unique_domains ?? 0));

    const risks = analytics.risk_breakdown || {};
    setText("analyticsRisk",
      "Critical: " + (risks.critical || 0) +
      " · High: " + (risks.high || 0) +
      " · Medium: " + (risks.medium || 0) +
      " · Low: " + (risks.low || 0) +
      " · Unknown: " + (risks.unknown || 0)
    );

    const trend = analytics.trend || {};
    let trendText = "Not enough scan history to calculate a trend yet.";
    if (trend.direction && trend.direction !== "insufficient_data") {
      const change = Number(trend.change || 0);
      const sign = change > 0 ? "+" : "";
      const direction = trend.direction === "improving"
        ? "Improving"
        : trend.direction === "declining" ? "Declining" : "Stable";
      trendText = direction + " · " + sign + change +
        " points for " + (trend.hostname || "the latest website") +
        ", comparing its latest five scans with its previous five.";
    }
    setText("analyticsTrend", trendText);

    const warnings = Array.isArray(analytics.recurring_warnings)
      ? analytics.recurring_warnings
      : [];
    const warningsNode = document.getElementById("analyticsWarnings");
    if (warningsNode) {
      warningsNode.innerHTML = warnings.length
        ? warnings.map(item =>
            '<div class="analytics-warning"><span>' +
            escapeHTML(item.name || "Security warning") +
            '</span><strong>' + escapeHTML(item.count) + ' scans</strong></div>'
          ).join("")
        : "No recurring warning patterns found in the analyzed scans.";
    }

    status.className = analytics.total_scans ? "success" : "notice";
    status.textContent = analytics.total_scans
      ? "Private analytics loaded from your latest " + (analytics.records_analyzed || 0) + " cloud scans."
      : "No cloud scans yet. Run a scan while signed in to begin your analytics history.";
  } catch (error) {
    status.className = "notice";
    status.textContent = error?.message || "Sign in to view your private scan analytics.";
  }
}


/* =========================
   CONTINUOUS MONITORING
========================= */

async function monitoringRequest(payload = null) {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error("Please log in to use continuous monitoring.");

  const response = await fetch("/api/monitoring", {
    method: payload ? "POST" : "GET",
    headers: {
      "Authorization": "Bearer " + token,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Monitoring request failed.");
  return result;
}

function monitoringDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function renderMonitoringDashboard(data) {
  const sitesNode = document.getElementById("monitorSites");
  const alertsNode = document.getElementById("monitorAlerts");
  const runsNode = document.getElementById("monitorRuns");

  if (sitesNode) {
    const sites = Array.isArray(data.sites) ? data.sites : [];
    sitesNode.innerHTML = sites.length ? sites.map(site => {
      const pending = site.status === "pending";
      const active = site.status === "active";
      const verification = pending ? `
        <div class="notice">
          <strong>Verify domain ownership</strong>
          <div class="monitoring-meta">Smart mode — automatically checks all three proof methods and accepts the first exact match:</div>
          <button class="secondary-button" type="button" data-action="verify-monitoring-auto" data-site-id="${escapeHTML(site.id)}">Smart Auto Verify</button>
          <div class="monitoring-meta">Or choose a method manually:</div>
          <div class="monitoring-meta">Option 1 — DNS TXT record</div>
          <div class="monitoring-meta">Record name</div>
          <code class="monitoring-code">${escapeHTML("_sentinel-ai-verification." + site.hostname)}</code>
          <div class="monitoring-meta">Record value</div>
          <code class="monitoring-code">${escapeHTML("sentinel-ai-verification=" + site.verification_token)}</code>
          <button class="secondary-button" type="button" data-action="verify-monitoring-site" data-site-id="${escapeHTML(site.id)}">Verify DNS Record</button>
          <div class="monitoring-meta">Option 2 — HTTPS file (no DNS changes)</div>
          <div class="monitoring-meta">Upload a plain-text file to this exact path on your website:</div>
          <code class="monitoring-code">/.well-known/sentinel-ai-verification.txt</code>
          <div class="monitoring-meta">File contents (one line):</div>
          <code class="monitoring-code">${escapeHTML("sentinel-ai-verification=" + site.verification_token)}</code>
          <button class="secondary-button" type="button" data-action="verify-monitoring-file" data-site-id="${escapeHTML(site.id)}">Verify HTTPS File</button>
          <div class="monitoring-meta">Option 3 — HTML meta tag (no DNS changes or file upload)</div>
          <div class="monitoring-meta">Add this single line inside the homepage head section:</div>
          <code class="monitoring-code">${escapeHTML('<meta name="sentinel-ai-verification" content="' + site.verification_token + '">')}</code>
          <button class="secondary-button" type="button" data-action="verify-monitoring-meta" data-site-id="${escapeHTML(site.id)}">Verify HTML Meta Tag</button>
        </div>
      ` : "";
      return `
        <div class="monitoring-site">
          <h4>${escapeHTML(site.hostname)}</h4>
          <div class="monitoring-meta">Status: ${escapeHTML(site.status)}</div>
          <div class="monitoring-meta">Scan interval: ${escapeHTML((site.scan_interval_minutes || 15) + " minutes")}</div>
          <div class="monitoring-meta">Last scan: ${escapeHTML(monitoringDate(site.last_scan_at))}</div>
          <div class="monitoring-meta">Next scan: ${escapeHTML(monitoringDate(site.next_scan_at))}</div>
          <div class="monitoring-meta">Latest score: ${site.last_score == null ? "Not scanned yet" : escapeHTML(site.last_score + "/100 · " + (site.last_risk_level || "Unknown"))}</div>
          ${verification}
          <div class="monitoring-actions">
            ${active
              ? `<button class="secondary-button" type="button" data-action="change-monitoring-site" data-site-id="${escapeHTML(site.id)}" data-site-action="pause">Pause</button>`
              : (!pending ? `<button type="button" data-action="change-monitoring-site" data-site-id="${escapeHTML(site.id)}" data-site-action="resume">Resume</button>` : "")}
            <button class="secondary-button" type="button" data-action="remove-monitoring-site" data-site-id="${escapeHTML(site.id)}">Remove</button>
          </div>
        </div>
      `;
    }).join("") : '<div class="empty-history">No monitored websites yet.</div>';
  }

  if (alertsNode) {
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    alertsNode.innerHTML = alerts.length ? alerts.map(alert => `
      <div class="monitoring-alert">
        <h4>${escapeHTML(alert.title)}</h4>
        <div class="monitoring-meta">${escapeHTML(alert.severity)} · ${escapeHTML(monitoringDate(alert.created_at))} · ${alert.is_read ? "Read" : "Unread"}</div>
        <p>${escapeHTML(alert.message)}</p>
        ${alert.is_read ? "" : `<button class="secondary-button" type="button" data-action="mark-monitoring-alert-read" data-alert-id="${escapeHTML(alert.id)}">Mark as read</button>`}
      </div>
    `).join("") : '<div class="empty-history">No security-change alerts yet. A first scan creates the baseline.</div>';
  }

  if (runsNode) {
    const runs = Array.isArray(data.runs) ? data.runs : [];
    runsNode.innerHTML = runs.length ? runs.map(run => `
      <div class="monitoring-run">
        <strong>${escapeHTML(run.status)}</strong>
        <div class="monitoring-meta">${escapeHTML(monitoringDate(run.started_at))} · ${run.score == null ? "No score" : escapeHTML(run.score + "/100 · " + (run.risk_level || "Unknown"))}</div>
        ${run.error_code ? `<div class="monitoring-meta">${escapeHTML(run.error_code)}</div>` : ""}
      </div>
    `).join("") : '<div class="empty-history">No monitoring runs yet.</div>';
  }
}

async function loadMonitoringDashboard() {
  const status = document.getElementById("monitorStatus");
  const sitesNode = document.getElementById("monitorSites");
  if (!status) return;

  try {
    const data = await monitoringRequest();
    renderMonitoringDashboard(data);

    const sites = Array.isArray(data.sites) ? data.sites : [];
    const verifiedSites = sites.filter(site => site.status === "active" && site.verified_at);

    if (!sites.length) {
      status.className = "notice";
      status.textContent = "No monitored websites yet. Add and verify a domain; scheduled security checks run every 15 minutes.";
    } else if (!verifiedSites.length) {
      status.className = "notice";
      status.textContent = "Complete DNS ownership verification. Scheduled security checks begin after verification.";
    } else {
      status.className = "notice";
      status.textContent = verifiedSites.length + " verified website(s) are scheduled for automatic checks every 15 minutes; completed runs will appear below.";
    }
  } catch (error) {
    status.className = "notice";
    status.textContent = error?.message || "Log in to manage monitoring.";
    if (sitesNode) sitesNode.innerHTML = "";
  }
}

async function addMonitoringSite() {
  const input = document.getElementById("monitorWebsite");
  const status = document.getElementById("monitorStatus");
  if (!input || !status) return;
  const url = input.value.trim();
  if (!url) {
    status.className = "error";
    status.textContent = "Enter your website address first.";
    return;
  }

  status.className = "notice";
  status.textContent = "Adding website and creating its ownership challenge...";
  try {
    await monitoringRequest({ action: "add", url });
    input.value = "";
    await loadMonitoringDashboard();
    status.className = "success";
    status.textContent = "Website added. Complete any one of the DNS TXT, HTTPS file, or HTML meta tag verification methods shown below.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to add this website.";
  }
}

async function verifyMonitoringSite(siteId) {
  const status = document.getElementById("monitorStatus");
  try {
    await monitoringRequest({ action: "verify", siteId });
    await loadMonitoringDashboard();
    status.className = "success";
    status.textContent = "Domain ownership verified. The website will be checked on the next scheduled 15-minute run.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "DNS verification failed.";
  }
}

async function verifyMonitoringFile(siteId) {
  const status = document.getElementById("monitorStatus");
  try {
    await monitoringRequest({ action: "verify_file", siteId });
    await loadMonitoringDashboard();
    status.className = "success";
    status.textContent = "Website ownership verified by HTTPS file. Ownership is verified. Confirm the first successful monitoring run in Monitoring Activity.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "HTTPS file verification failed.";
  }
}

async function verifyMonitoringAuto(siteId) {
  const status = document.getElementById("monitorStatus");
  try {
    status.className = "notice";
    status.textContent = "Smart verification is checking DNS, HTTPS file, and homepage meta tag...";
    const result = await monitoringRequest({ action: "verify_auto", siteId });
    await loadMonitoringDashboard();
    status.className = "success";
    status.textContent = "Ownership verified automatically using " + (result.verification_method || "a valid proof") + ". Ownership is verified. Confirm the first successful monitoring run in Monitoring Activity.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Smart domain verification failed.";
  }
}

async function verifyMonitoringMeta(siteId) {
  const status = document.getElementById("monitorStatus");
  try {
    await monitoringRequest({ action: "verify_meta", siteId });
    await loadMonitoringDashboard();
    status.className = "success";
    status.textContent = "Website ownership verified by its HTML meta tag. Ownership is verified. Confirm the first successful monitoring run in Monitoring Activity.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "HTML meta tag verification failed.";
  }
}

async function changeMonitoringSite(siteId, action) {
  try {
    await monitoringRequest({ action, siteId });
    await loadMonitoringDashboard();
  } catch (error) {
    const status = document.getElementById("monitorStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to update monitoring status.";
  }
}

async function removeMonitoringSite(siteId) {
  if (!confirm("Remove this website and its monitoring history and alerts?")) return;
  try {
    await monitoringRequest({ action: "remove", siteId });
    await loadMonitoringDashboard();
  } catch (error) {
    const status = document.getElementById("monitorStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to remove this website.";
  }
}

async function markMonitoringAlertRead(alertId) {
  try {
    await monitoringRequest({ action: "mark_read", alertId });
    await loadMonitoringDashboard();
  } catch (error) {
    const status = document.getElementById("monitorStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to update this alert.";
  }
}


/* =========================
   ACCOUNT USAGE
========================= */

async function loadUsageSummary() {
  const status = document.getElementById("usageStatus");
  const summary = document.getElementById("usageSummary");
  if (!status || !summary) return;
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("Sign in to view account usage.");
    const response = await fetch("/api/usage", {
      headers: { "Authorization": "Bearer " + token },
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load account usage.");
    status.className = "success";
    status.textContent = "Beta usage summary · Period starts " + monitoringDate(result.period_start);
    summary.innerHTML = `
      <div class="analytics-grid">
        <div class="analytics-card">
          <span class="analytics-label">Current plan</span>
          <strong>${escapeHTML(result.plan || "beta")}</strong>
        </div>
        <div class="analytics-card">
          <span class="analytics-label">Completed scans</span>
          <strong>${escapeHTML(result.usage?.scans ?? 0)} / ${escapeHTML(result.monthly_scan_limit ?? 100)}</strong>
        </div>
        <div class="analytics-card">
          <span class="analytics-label">Reports generated</span>
          <strong>${escapeHTML(result.usage?.reports ?? 0)}</strong>
        </div>
        <div class="analytics-card">
          <span class="analytics-label">Mentor sessions</span>
          <strong>${escapeHTML(result.usage?.mentor_sessions ?? 0)}</strong>
        </div>
      </div>
      <div class="notice">${escapeHTML(result.billing?.message || "Beta usage only. No billing is active.")}</div>
    `;
  } catch (error) {
    status.className = "notice";
    status.textContent = error?.message || "Unable to load account usage.";
    summary.innerHTML = "";
  }
}


/* =========================
   TEAM WORKSPACES
========================= */

async function organizationRequest(payload = null) {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error("Please log in to use team workspaces.");
  const response = await fetch("/api/organizations", {
    method: payload ? "POST" : "GET",
    headers: {
      "Authorization": "Bearer " + token,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Workspace request failed.");
  return result;
}

let organizationWorkspaceData = { organizations: [], invitations: [] };

function renderOrganizationWorkspace(data) {
  organizationWorkspaceData = data;
  const list = document.getElementById("organizationList");
  const invitations = document.getElementById("organizationInvitations");
  if (invitations) {
    invitations.innerHTML = (data.invitations || []).length
      ? data.invitations.map(invite => `
        <div class="monitoring-site">
          <strong>${escapeHTML(invite.organizations?.name || "Team workspace")}</strong>
          <div class="monitoring-meta">${escapeHTML(invite.email)} · ${escapeHTML(invite.role)} · Expires ${escapeHTML(monitoringDate(invite.expires_at))}</div>
        </div>
      `).join("")
      : '<div class="empty-history">No pending invitations for your account.</div>';
  }
  if (!list) return;
  const orgs = data.organizations || [];
  list.innerHTML = orgs.length ? orgs.map(org => {
    const canManage = ["owner", "admin"].includes(org.my_role);
    const members = (org.members || []).map(member => `
      <div class="monitoring-run">
        <div><strong>${escapeHTML(member.user_id)}</strong></div>
        <div class="monitoring-meta">${escapeHTML(member.role)} · Joined ${escapeHTML(monitoringDate(member.joined_at))}</div>
        ${org.my_role === "owner" && member.role !== "owner" ? `
          <div class="monitoring-actions">
            <select id="orgRole-${escapeHTML(org.id)}-${escapeHTML(member.user_id)}">
              <option value="admin" ${member.role === "admin" ? "selected" : ""}>Admin</option>
              <option value="member" ${member.role === "member" ? "selected" : ""}>Member</option>
              <option value="analyst" ${member.role === "analyst" ? "selected" : ""}>Analyst</option>
            </select>
            <button class="secondary-button" type="button" data-action="change-organization-role" data-organization-id="${escapeHTML(org.id)}" data-user-id="${escapeHTML(member.user_id)}">Save Role</button>
            <button class="secondary-button" type="button" data-action="remove-organization-member" data-organization-id="${escapeHTML(org.id)}" data-user-id="${escapeHTML(member.user_id)}">Remove</button>
          </div>
        ` : ""}
      </div>
    `).join("");
    const inviteRows = (org.invitations || []).map(invite => `
      <div class="monitoring-meta">${escapeHTML(invite.email)} · ${escapeHTML(invite.role)} · Expires ${escapeHTML(monitoringDate(invite.expires_at))}</div>
      <button class="secondary-button" type="button" data-action="revoke-organization-invitation" data-organization-id="${escapeHTML(org.id)}" data-invitation-id="${escapeHTML(invite.id)}">Revoke invitation</button>
    `).join("");
    const auditRows = (org.audit_events || []).slice(0, 10).map(event => `
      <div class="monitoring-meta">${escapeHTML(event.event_type)} · ${escapeHTML(monitoringDate(event.created_at))}</div>
    `).join("");
    return `
      <div class="monitoring-site">
        <h3>${escapeHTML(org.name)}</h3>
        <div class="monitoring-meta">Workspace: ${escapeHTML(org.slug)} · Your role: ${escapeHTML(org.my_role)} · Status: ${escapeHTML(org.status)}</div>
        <h4>Members (${(org.members || []).length})</h4>
        ${members || '<div class="monitoring-meta">No members yet.</div>'}
        <h4>Shared verified assets</h4>
        <div id="orgAssets-${escapeHTML(org.id)}" class="monitoring-meta">Loading shared assets...</div>
        <div id="orgAdmin-${escapeHTML(org.id)}" class="monitoring-meta">Loading workspace settings...</div>
        ${canManage ? `
          <div class="analytics-panel">
            <h4>Invite a collaborator</h4>
            <input id="orgInviteEmail-${escapeHTML(org.id)}" type="email" maxlength="254" placeholder="collaborator@example.com">
            <select id="orgInviteRole-${escapeHTML(org.id)}">
              <option value="member">Member</option>
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
            <button type="button" data-action="invite-organization-member" data-organization-id="${escapeHTML(org.id)}">Create Invitation</button>
            <div id="orgInviteResult-${escapeHTML(org.id)}"></div>
          </div>
          <h4>Pending invitations</h4>
          ${inviteRows || '<div class="monitoring-meta">No pending invitations.</div>'}
          <h4>Recent audit events</h4>
          ${auditRows || '<div class="monitoring-meta">No audit events yet.</div>'}
        ` : ""}
      </div>
    `;
  }).join("") : '<div class="empty-history">No team workspaces yet. Create one to get started.</div>';
  orgs.forEach((org) => {
    loadOrganizationAssets(org.id);
    loadOrganizationAdmin(org.id);
  });
}

async function organizationAdminRequest(organizationId, payload = null) {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error("Please log in to manage workspace policies.");
  const response = await fetch("/api/organization-admin" + (payload ? "" : "?organizationId=" + encodeURIComponent(organizationId)), {
    method: payload ? "POST" : "GET",
    headers: {
      "Authorization": "Bearer " + token,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    ...(payload ? { body: JSON.stringify({ ...payload, organizationId }) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Workspace administration request failed.");
  return result;
}

async function loadOrganizationAdmin(organizationId) {
  const node = document.getElementById("orgAdmin-" + organizationId);
  if (!node) return;
  try {
    const data = await organizationAdminRequest(organizationId);
    const p = data.policy || {};
    const ownerControls = data.can_manage ? `
      <label><input id="orgPolicyInvites-${escapeHTML(organizationId)}" type="checkbox" ${p.allow_member_invites ? "checked" : ""}> Allow new member invitations</label>
      <label><input id="orgPolicyAssets-${escapeHTML(organizationId)}" type="checkbox" ${p.allow_asset_sharing ? "checked" : ""}> Allow sharing verified assets</label>
      <label><input id="orgPolicyAudit-${escapeHTML(organizationId)}" type="checkbox" ${p.audit_export_enabled ? "checked" : ""}> Allow audit log exports</label>
      <button type="button" data-action="save-organization-policy" data-organization-id="${escapeHTML(organizationId)}">Save Security Policies</button>
    ` : "";
    const canExport = ["owner", "admin"].includes(data.my_role) && p.audit_export_enabled;
    node.innerHTML = `
      <div class="analytics-panel">
        <h4>Workspace Security Policies</h4>
        <div class="monitoring-meta">Only the owner can change these controls. Last update: ${escapeHTML(monitoringDate(p.updated_at))}</div>
        ${ownerControls || `<div class="monitoring-meta">Invitations: ${p.allow_member_invites ? "Enabled" : "Disabled"} · Asset sharing: ${p.allow_asset_sharing ? "Enabled" : "Disabled"} · Audit exports: ${p.audit_export_enabled ? "Enabled" : "Disabled"}</div>`}
        ${canExport ? `<button class="secondary-button" type="button" data-action="export-organization-audit" data-organization-id="${escapeHTML(organizationId)}">Export Audit Log (JSON)</button>` : ""}
      </div>
    `;
  } catch (error) {
    node.className = "error";
    node.textContent = error?.message || "Unable to load workspace policies.";
  }
}

async function saveOrganizationPolicy(organizationId) {
  const getChecked = (id) => Boolean(document.getElementById(id)?.checked);
  try {
    await organizationAdminRequest(organizationId, {
      action: "update_policy",
      allow_member_invites: getChecked("orgPolicyInvites-" + organizationId),
      allow_asset_sharing: getChecked("orgPolicyAssets-" + organizationId),
      audit_export_enabled: getChecked("orgPolicyAudit-" + organizationId)
    });
    await loadOrganizationAdmin(organizationId);
    const status = document.getElementById("organizationStatus");
    status.className = "success";
    status.textContent = "Workspace security policies saved.";
  } catch (error) {
    const status = document.getElementById("organizationStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to save workspace policies.";
  }
}

async function exportOrganizationAudit(organizationId) {
  try {
    const data = await organizationAdminRequest(organizationId, { action: "export_audit" });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sentinel-workspace-audit-" + organizationId + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    const status = document.getElementById("organizationStatus");
    status.className = "success";
    status.textContent = "Audit log export created.";
  } catch (error) {
    const status = document.getElementById("organizationStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to export audit log.";
  }
}

async function organizationAssetRequest(organizationId, payload = null) {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error("Please log in to manage shared assets.");
  const response = await fetch("/api/organization-assets" + (payload ? "" : "?organizationId=" + encodeURIComponent(organizationId)), {
    method: payload ? "POST" : "GET",
    headers: {
      "Authorization": "Bearer " + token,
      ...(payload ? { "Content-Type": "application/json" } : {})
    },
    ...(payload ? { body: JSON.stringify({ ...payload, organizationId }) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Team asset request failed.");
  return result;
}

async function loadOrganizationAssets(organizationId) {
  const node = document.getElementById("orgAssets-" + organizationId);
  if (!node) return;
  try {
    const data = await organizationAssetRequest(organizationId);
    const assets = data.assets || [];
    const available = data.available_assets || [];
    const sharedHtml = assets.length ? assets.map((asset) => {
      const site = asset.monitoring_site || {};
      return `
        <div class="monitoring-run">
          <strong>${escapeHTML(site.hostname || site.url || "Verified asset")}</strong>
          <div class="monitoring-meta">${escapeHTML(site.status || "Unknown")} · Score: ${site.last_score == null ? "Not scanned" : escapeHTML(site.last_score + "/100")} · Added ${escapeHTML(monitoringDate(asset.created_at))}</div>
          ${data.can_manage ? `<button class="secondary-button" type="button" data-action="remove-organization-asset" data-organization-id="${escapeHTML(organizationId)}" data-asset-id="${escapeHTML(asset.id)}">Remove shared asset</button>` : ""}
        </div>
      `;
    }).join("") : '<div class="monitoring-meta">No verified assets are shared with this workspace yet.</div>';
    const selectHtml = data.can_manage && data.sharing_enabled && available.length ? `
      <div class="analytics-panel">
        <select id="orgAssetSelect-${escapeHTML(organizationId)}">
          ${available.map((asset) => `<option value="${escapeHTML(asset.id)}">${escapeHTML(asset.hostname || asset.url)}</option>`).join("")}
        </select>
        <button type="button" data-action="share-organization-asset" data-organization-id="${escapeHTML(organizationId)}">Share verified asset</button>
      </div>
    ` : data.can_manage && !data.sharing_enabled ? '<div class="monitoring-meta">Asset sharing is disabled by the workspace owner.</div>' : data.can_manage ? '<div class="monitoring-meta">No other verified member-owned assets are available to share.</div>' : "";
    node.innerHTML = sharedHtml + selectHtml;
  } catch (error) {
    node.className = "error";
    node.textContent = error?.message || "Unable to load shared assets.";
  }
}

async function shareOrganizationAsset(organizationId) {
  const select = document.getElementById("orgAssetSelect-" + organizationId);
  if (!select?.value) return;
  try {
    await organizationAssetRequest(organizationId, { action: "share", monitoringSiteId: select.value });
    await loadOrganizationAssets(organizationId);
    const status = document.getElementById("organizationStatus");
    status.className = "success";
    status.textContent = "Verified asset shared with the workspace.";
  } catch (error) {
    const status = document.getElementById("organizationStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to share this asset.";
  }
}

async function removeOrganizationAsset(organizationId, assetId) {
  if (!confirm("Remove this asset from the shared workspace?")) return;
  try {
    await organizationAssetRequest(organizationId, { action: "remove", assetId });
    await loadOrganizationAssets(organizationId);
  } catch (error) {
    const status = document.getElementById("organizationStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to remove this asset.";
  }
}

async function loadOrganizationWorkspace() {
  const status = document.getElementById("organizationStatus");
  if (!status) return;
  try {
    const inviteFromLink = new URLSearchParams(location.search).get("org_invite");
    if (inviteFromLink) {
      history.replaceState(null, "", location.pathname + location.hash);
      const tokenInput = document.getElementById("organizationInviteToken");
      if (tokenInput) tokenInput.value = inviteFromLink;
      await acceptOrganizationInvitation(inviteFromLink);
      return;
    }
    const data = await organizationRequest();
    renderOrganizationWorkspace(data);
    status.className = "success";
    status.textContent = "Team workspace ready. Membership and invitations are private to your account.";
  } catch (error) {
    status.className = "notice";
    status.textContent = error?.message || "Log in to manage team workspaces.";
    const list = document.getElementById("organizationList");
    if (list) list.innerHTML = "";
  }
}

async function createOrganization() {
  const input = document.getElementById("organizationName");
  const status = document.getElementById("organizationStatus");
  try {
    const result = await organizationRequest({ action: "create", name: input.value.trim() });
    input.value = "";
    await loadOrganizationWorkspace();
    status.className = "success";
    status.textContent = "Workspace created. You are its owner.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to create workspace.";
  }
}

async function acceptOrganizationInvitation(tokenValue) {
  const input = document.getElementById("organizationInviteToken");
  const token = (tokenValue || input?.value || "").trim();
  const status = document.getElementById("organizationStatus");
  try {
    await organizationRequest({ action: "accept_invitation", token });
    if (input) input.value = "";
    await loadOrganizationWorkspace();
    status.className = "success";
    status.textContent = "Invitation accepted. The workspace is now available in your account.";
  } catch (error) {
    status.className = "error";
    status.textContent = error?.message || "Unable to accept this invitation.";
  }
}

async function inviteOrganizationMember(organizationId) {
  const emailInput = document.getElementById("orgInviteEmail-" + organizationId);
  const roleInput = document.getElementById("orgInviteRole-" + organizationId);
  const resultNode = document.getElementById("orgInviteResult-" + organizationId);
  try {
    const result = await organizationRequest({
      action: "invite",
      organizationId,
      email: emailInput.value.trim(),
      role: roleInput.value
    });
    const inviteUrl = location.origin + "/?org_invite=" + encodeURIComponent(result.token) + "#teams";
    resultNode.innerHTML = `
      <div class="notice">
        Invitation created. Share this link privately with ${escapeHTML(result.invitation.email)}.
        It expires in seven days. Email is not sent automatically.
        <code class="monitoring-code">${escapeHTML(inviteUrl)}</code>
        <button type="button" data-action="copy-organization-invite" data-invite-url="${escapeHTML(inviteUrl)}">Copy Invitation Link</button>
      </div>
    `;
    emailInput.value = "";
    await loadOrganizationWorkspace();
  } catch (error) {
    resultNode.className = "error";
    resultNode.textContent = error?.message || "Unable to create invitation.";
  }
}

async function copyOrganizationInvite(value) {
  try {
    await navigator.clipboard.writeText(value);
    const status = document.getElementById("organizationStatus");
    status.className = "success";
    status.textContent = "Invitation link copied.";
  } catch {
    const status = document.getElementById("organizationStatus");
    status.className = "notice";
    status.textContent = "Copy was blocked by the browser. Select and copy the invitation link above.";
  }
}

async function changeOrganizationRole(organizationId, userId) {
  const role = document.getElementById("orgRole-" + organizationId + "-" + userId)?.value;
  try {
    await organizationRequest({ action: "change_role", organizationId, userId, role });
    await loadOrganizationWorkspace();
  } catch (error) {
    const status = document.getElementById("organizationStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to change member role.";
  }
}

async function removeOrganizationMember(organizationId, userId) {
  if (!confirm("Remove this member from the workspace?")) return;
  try {
    await organizationRequest({ action: "remove_member", organizationId, userId });
    await loadOrganizationWorkspace();
  } catch (error) {
    const status = document.getElementById("organizationStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to remove member.";
  }
}

async function revokeOrganizationInvitation(organizationId, invitationId) {
  if (!confirm("Revoke this pending invitation?")) return;
  try {
    await organizationRequest({ action: "revoke_invitation", organizationId, invitationId });
    await loadOrganizationWorkspace();
  } catch (error) {
    const status = document.getElementById("organizationStatus");
    status.className = "error";
    status.textContent = error?.message || "Unable to revoke invitation.";
  }
}


/* =========================
   PAGE LOAD
========================= */

document.addEventListener("DOMContentLoaded", function() {
  renderScanHistory();

  // Supabase auth callbacks must stay synchronous. Schedule UI work after the
  // callback returns so Supabase can release its internal auth lock.
  supabaseClient.auth.onAuthStateChange(function(event) {
    if (event === "INITIAL_SESSION") {
      return;
    }

    if (event === "PASSWORD_RECOVERY") {
      const passwordResetArea =
        document.getElementById("passwordResetArea");
      if (passwordResetArea) {
        passwordResetArea.classList.remove("is-hidden");
      }

      const authStatus = document.getElementById("authStatus");
      if (authStatus) {
        authStatus.className = "success";
        authStatus.textContent =
          "🔑 Password recovery verified. Please create a new password.";
      }
    }

    scheduleAuthUIRefresh();
    });;

  // Subscribe first, then perform the initial state refresh.
  void updateAuthUI();
});
