import { normalizeEvidence } from "./_lib/security-evidence.js";
import { calculateScanScore } from "./_lib/scan-score.js";
import { createClient } from "@supabase/supabase-js";
import { isWithinJsonBodyLimit } from "./_lib/request-size.js";

// Reject oversized request bodies before application work begins.
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };


const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  try {

    const body = req.body;

    if (body != null && !isWithinJsonBodyLimit(body, 512 * 1024)) {
      return res.status(413).json({ error: "Report request is too large. Reduce the number or size of security checks and try again." });
    }

    let authenticatedUser = null;
    const authorization = req.headers?.authorization || "";
    if (authorization) {
      const accessToken = typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";
      if (!accessToken || !supabaseAdmin) {
        return res.status(401).json({ error: "A valid signed-in session is required." });
      }
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (authError || !authData?.user?.id) {
        return res.status(401).json({ error: "Your session is invalid. Please sign in again." });
      }
      authenticatedUser = authData.user;
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        error: "Invalid request body."
      });
    }

    const {
      website,
      securityScore,
      riskLevel,
      checks,
      scanId
    } = body;

    if (typeof website !== "string" || !website.trim() || website.length > 2048) {
      return res.status(400).json({
        error: "A valid website URL is required."
      });
    }

    try {
      const parsedWebsite = new URL(website);
      if (!["http:", "https:"].includes(parsedWebsite.protocol) ||
          parsedWebsite.username || parsedWebsite.password) {
        throw new Error("Unsupported URL.");
      }
    } catch {
      return res.status(400).json({
        error: "Website must be a valid HTTP or HTTPS URL."
      });
    }

    if (!Array.isArray(checks) || checks.length > 200) {
      return res.status(400).json({
        error: "Security checks must be an array containing no more than 200 items."
      });
    }

    if (checks.some(check => !check || typeof check !== "object" || Array.isArray(check))) {
      return res.status(400).json({
        error: "Each security check must be a valid object."
      });
    }

    if (typeof securityScore !== "number" || !Number.isFinite(securityScore) ||
        securityScore < 0 || securityScore > 100) {
      return res.status(400).json({
        error: "Security score must be a number between 0 and 100."
      });
    }

    if (riskLevel !== undefined &&
        (typeof riskLevel !== "string" || riskLevel.length > 24)) {
      return res.status(400).json({
        error: "Invalid risk level."
      });
    }

    if (scanId !== undefined &&
        (typeof scanId !== "string" || scanId.length > 128)) {
      return res.status(400).json({
        error: "Invalid scan identifier."
      });
    }

    const safeText = (value, maxLength, fallback) =>
      typeof value === "string" && value.trim()
        ? value.trim().slice(0, maxLength)
        : fallback;

    for (const check of checks) {
      if (check.evidence !== undefined &&
          (!check.evidence || typeof check.evidence !== "object" || Array.isArray(check.evidence))) {
        return res.status(400).json({
          error: "Security evidence must be a valid object."
        });
      }

      if (check.evidence) {
        for (const field of ["source", "signal", "observed", "expected"]) {
          if (check.evidence[field] !== undefined &&
              (typeof check.evidence[field] !== "string" || check.evidence[field].length > 2000)) {
            return res.status(400).json({
              error: "Security evidence contains an invalid or oversized field."
            });
          }
        }
      }

      for (const field of ["name", "title", "status", "message", "description", "fix", "recommendation"]) {
        if (check[field] !== undefined &&
            (typeof check[field] !== "string" || check[field].length > 2000)) {
          return res.status(400).json({
            error: "A security check contains an invalid or oversized text field."
          });
        }
      }
    }

    // Never trust a score or risk label supplied by the browser.
    // Recalculate both from the submitted check statuses so a modified
    // request cannot produce a report with an inflated security score.
    const scoreResult = calculateScanScore(checks);

    const passed = checks.filter(
      check =>
        String(check?.status || "").toLowerCase() === "pass" ||
        String(check?.status || "").toLowerCase() === "passed"
    ).length;

    const warnings = checks.filter(
      check =>
        String(check?.status || "").toLowerCase() === "warning" ||
        String(check?.status || "").toLowerCase() === "warn"
    ).length;

    const informational = checks.filter(
      check =>
        String(check?.status || "").toLowerCase() === "info" ||
        String(check?.status || "").toLowerCase() === "informational"
    ).length;

    const evidenceBackedFindings = checks.filter(
      check => normalizeEvidence(check.evidence) !== null
    ).length;

    const priorityFindings = checks
      .filter(
        check =>
          String(check?.status || "").toLowerCase() === "warning" ||
          String(check?.status || "").toLowerCase() === "warn"
      )
      .slice(0, 5)
      .map((check, index) => ({
        priority: index + 1,
        title: safeText(check.name || check.title, 160, "Security Finding"),
        status: safeText(check.status, 24, "Warning"),
        message: safeText(
          check.message || check.description,
          500,
          "A security configuration issue was detected."
        ),
        fix: safeText(
          check.fix || check.recommendation,
          500,
          "Review and improve this security configuration."
        ),
        ...(normalizeEvidence(check.evidence)
          ? { evidence: normalizeEvidence(check.evidence) }
          : {})
      }));

    const recommendations = priorityFindings.map(
      finding => finding.fix
    );

    const nextSteps = [
      "Review all WARNING findings first.",
      "Apply the recommended security configuration changes.",
      "Run Sentinel AI again to verify the improvements.",
      "Monitor the website security configuration regularly."
    ];

    const report = {
      website: String(website),
      scanId: scanId || "",
      securityScore: scoreResult.score,
      riskLevel: scoreResult.riskLevel,

      generatedAt: new Date().toISOString(),

      executiveSummary: {
        totalChecks: checks.length,
        passed,
        warnings,
        informational,
        priorityIssues: priorityFindings.length,
        evidenceBackedFindings
      },

      priorityFindings,

      recommendations,

      nextSteps,

      disclaimer:
        "Sentinel AI provides security-awareness and defensive guidance based on publicly observable security signals. It is not a substitute for a complete professional security assessment."
    };

    if (authenticatedUser && supabaseAdmin) {
      const { error: usageError } = await supabaseAdmin.from("usage_events").insert({
        user_id: authenticatedUser.id,
        event_type: "report.generated",
        resource_host: new URL(website).hostname,
        metadata: { security_score: scoreResult.score, risk_level: scoreResult.riskLevel }
      });
      if (usageError) console.error("Report usage event could not be recorded:", usageError);
    }

    return res.status(200).json({
      success: true,
      report
    });

  } catch (error) {

    console.error(
      "Report API Error:",
      error
    );

    return res.status(500).json({
      error: "Unable to generate the security report."
    });
  }
}
