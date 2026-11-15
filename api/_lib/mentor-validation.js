import { normalizeEvidence } from "./security-evidence.js";

const SEVERITIES = ["Critical", "High", "Medium", "Low", "Info", "Unknown"];
const STATUSES = ["PASS", "WARN", "WARNING", "FAIL", "FAILED", "INFO", "UNKNOWN"];

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeWebsite(value) {
  if (!value) return "";
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeMentorInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (typeof body.finding !== "string" || body.finding.trim().length > 160) return null;
  const finding = cleanText(body.finding, 160);
  if (!finding) return null;

  const website = normalizeWebsite(body.website);
  if (website === null) return null;

  const requestedSeverity = cleanText(body.severity, 30);
  const severity = SEVERITIES.includes(requestedSeverity) ? requestedSeverity : "Unknown";
  const requestedStatus = cleanText(body.status, 20).toUpperCase();
  const status = STATUSES.includes(requestedStatus) ? requestedStatus : "UNKNOWN";
  const evidence = body.evidence == null ? null : normalizeEvidence(body.evidence);
  if (body.evidence != null && !evidence) return null;

  return {
    finding,
    severity,
    status,
    website,
    message: cleanText(body.message, 2000),
    fix: cleanText(body.fix, 2000),
    evidence
  };
}

export function normalizeMentorResponse(value, input) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const title = cleanText(value.title, 160);
  const explanation = cleanText(value.explanation, 2000);
  const whyItMatters = cleanText(value.why_it_matters, 2000);
  const defensiveAction = cleanText(value.defensive_action, 2000);
  const verification = cleanText(value.verification, 2000);
  const steps = Array.isArray(value.steps) ? value.steps : [];

  if (!title || !explanation || !whyItMatters || !defensiveAction || !verification ||
      steps.length < 1 || steps.length > 8 ||
      !steps.every((step) => typeof step === "string" && step.trim().length > 0 && step.length <= 500)) {
    return null;
  }

  return {
    title,
    severity: input.severity,
    status: input.status,
    explanation,
    why_it_matters: whyItMatters,
    defensive_action: defensiveAction,
    steps: steps.map((step) => step.trim()),
    verification
  };
}

export function buildMentorFallback(input, guidanceMap = {}) {
  if (input.status === "PASS") {
    return {
      title: input.finding,
      severity: input.severity,
      status: input.status,
      explanation: input.message || "The scanner observed the expected security configuration for this check.",
      why_it_matters: "A passing check is a positive signal, but it does not prove that the entire website is secure.",
      defensive_action: "Keep this configuration in place and review it whenever the website or hosting setup changes.",
      steps: [
        "Keep the current security configuration.",
        "Review the setting after application or hosting changes.",
        "Check related security controls rather than relying on this result alone."
      ],
      verification: "Run Sentinel AI again after configuration changes and confirm that this check still passes."
    };
  }

  if (input.status === "INFO" || input.status === "UNKNOWN") {
    return {
      title: input.finding,
      severity: input.severity,
      status: input.status,
      explanation: input.message || "This is an informational observation and is not, by itself, proof of a vulnerability.",
      why_it_matters: "Use this information to understand the website's security posture and decide whether additional review is appropriate.",
      defensive_action: input.fix || "Review the observation in the context of the application's design and security requirements.",
      steps: [
        "Review the observed response and the affected component.",
        "Compare the configuration with the application's actual requirements.",
        "Document whether any defensive change is necessary."
      ],
      verification: "Re-run the check after any change and confirm the observed response matches the intended configuration."
    };
  }

  const guidance = guidanceMap[input.finding] || {
    explanation: "The scanner reported a security configuration concern that should be reviewed; this result alone does not prove exploitability.",
    why_it_matters: "Unreviewed configuration weaknesses can increase exposure, depending on the application's architecture and threat model.",
    defensive_action: input.fix || "Review the affected setting and apply a defensive configuration appropriate to the application.",
    steps: [
      "Review the scanner's observed response and evidence.",
      "Identify the component responsible for the setting.",
      "Apply a change that matches the application's requirements.",
      "Re-run Sentinel AI and compare the result."
    ],
    verification: "Re-run the same check and confirm that the expected response is now observed."
  };

  return {
    title: input.finding,
    severity: input.severity,
    status: input.status,
    explanation: guidance.explanation,
    why_it_matters: guidance.why_it_matters,
    defensive_action: guidance.defensive_action,
    steps: Array.isArray(guidance.steps) ? guidance.steps.slice(0, 8) : [],
    verification: guidance.verification
  };
}
