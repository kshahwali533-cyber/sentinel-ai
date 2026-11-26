const CAPABILITY_KEYS = Object.freeze([
  "networkAccess",
  "shellExecution",
  "fileWrite",
  "secretsAccess",
  "databaseWrite",
  "externalMessaging",
  "browserAutomation"
]);

const CONTROL_KEYS = Object.freeze([
  "humanApproval",
  "toolAllowlist",
  "sandboxedExecution",
  "scopedSecrets",
  "outputValidation",
  "auditLogging",
  "promptInjectionTesting",
  "dataExfiltrationControls"
]);

const SEVERITY_POINTS = Object.freeze({
  critical: 30,
  high: 18,
  medium: 10,
  low: 4
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describeUnknownFields(source, keys, prefix) {
  return keys
    .filter((key) => typeof source?.[key] !== "boolean")
    .map((key) => prefix + "." + key);
}

/**
 * Perform a deterministic, defensive configuration review of an AI agent.
 * This function never executes tools, contacts targets, or interprets prompts.
 */
export function assessAgentSecurity(input) {
  if (!isRecord(input)) {
    return {
      valid: false,
      error: "Provide an agent configuration object.",
      assessmentType: "static-configuration-review"
    };
  }

  const capabilities = isRecord(input.capabilities) ? input.capabilities : {};
  const controls = isRecord(input.controls) ? input.controls : {};
  const unknownFields = [
    ...describeUnknownFields(capabilities, CAPABILITY_KEYS, "capabilities"),
    ...describeUnknownFields(controls, CONTROL_KEYS, "controls")
  ];

  const findings = [];
  let provisionalRiskScore = 0;

  function addFinding(id, severity, title, evidence, recommendation) {
    findings.push({ id, severity, title, evidence, recommendation });
    provisionalRiskScore += SEVERITY_POINTS[severity];
  }

  if (capabilities.shellExecution === true && controls.sandboxedExecution !== true) {
    addFinding(
      "shell-execution-without-sandbox",
      "critical",
      "Shell execution is not confirmed to be sandboxed",
      "The agent declares shell execution, but sandboxedExecution is not true.",
      "Run shell tools in an isolated, short-lived sandbox with restricted filesystem, process, and network access."
    );
  }

  if (capabilities.secretsAccess === true && controls.scopedSecrets !== true) {
    addFinding(
      "secrets-without-scoping",
      "critical",
      "Secret access is not confirmed to be scoped",
      "The agent declares access to secrets, but scopedSecrets is not true.",
      "Use short-lived, task-scoped credentials; expose only the minimum secret material required and prevent secrets from entering prompts or logs."
    );
  }

  if (capabilities.networkAccess === true && controls.toolAllowlist !== true) {
    addFinding(
      "network-without-allowlist",
      "high",
      "Network access lacks a confirmed destination allowlist",
      "The agent declares network access, but toolAllowlist is not true.",
      "Restrict outbound requests to approved destinations and block private, loopback, link-local, and metadata-service addresses."
    );
  }

  if (capabilities.databaseWrite === true && controls.humanApproval !== true) {
    addFinding(
      "database-write-without-approval",
      "high",
      "Database write actions lack confirmed human approval",
      "The agent declares database write access, but humanApproval is not true.",
      "Require explicit human approval for destructive or externally visible database changes and enforce row- and tenant-level authorization."
    );
  }

  if (capabilities.externalMessaging === true && controls.humanApproval !== true) {
    addFinding(
      "external-messaging-without-approval",
      "high",
      "External messages can be sent without confirmed approval",
      "The agent declares external messaging, but humanApproval is not true.",
      "Require user confirmation before sending email, chat messages, or other external communications."
    );
  }

  if (capabilities.browserAutomation === true && controls.promptInjectionTesting !== true) {
    addFinding(
      "browser-agent-without-injection-testing",
      "high",
      "Browser automation lacks confirmed prompt-injection testing",
      "The agent declares browser automation, but promptInjectionTesting is not true.",
      "Test indirect prompt injection from pages, documents, and tool output; keep untrusted content separate from trusted instructions and gate consequential actions."
    );
  }

  if (capabilities.fileWrite === true && controls.sandboxedExecution !== true) {
    addFinding(
      "file-write-without-sandbox",
      "high",
      "File modification is not confirmed to be isolated",
      "The agent declares file-write capability, but sandboxedExecution is not true.",
      "Restrict writes to an isolated workspace, enforce path boundaries, and prevent writes to credentials, application configuration, and system files."
    );
  }

  if (controls.outputValidation !== true) {
    addFinding(
      "output-validation-missing",
      "medium",
      "Tool outputs are not confirmed to be validated",
      "outputValidation is false or was not supplied.",
      "Validate tool arguments and results against strict schemas; treat tool output as untrusted data before using it in later actions."
    );
  }

  if (controls.auditLogging !== true) {
    addFinding(
      "audit-logging-missing",
      "medium",
      "Security-relevant agent actions are not confirmed to be audited",
      "auditLogging is false or was not supplied.",
      "Record actor, tool, action, authorization decision, timestamp, and outcome while redacting credentials and sensitive payloads."
    );
  }

  const sensitiveCapabilityEnabled = [
    "networkAccess",
    "shellExecution",
    "fileWrite",
    "secretsAccess",
    "databaseWrite",
    "externalMessaging",
    "browserAutomation"
  ].some((key) => capabilities[key] === true);

  if (sensitiveCapabilityEnabled && controls.dataExfiltrationControls !== true) {
    addFinding(
      "data-exfiltration-controls-missing",
      "high",
      "Data-exfiltration safeguards are not confirmed",
      "At least one sensitive capability is enabled, but dataExfiltrationControls is not true.",
      "Apply data classification, outbound data filtering, sensitive-field redaction, and policy checks before data leaves the trusted boundary."
    );
  }

  if (unknownFields.length > 0) {
    findings.push({
      id: "assessment-incomplete",
      severity: "medium",
      title: "Assessment is incomplete",
      evidence: "Boolean declarations are missing or invalid for: " + unknownFields.join(", ") + ".",
      recommendation: "Complete every capability and control declaration. An unknown value must never be interpreted as a disabled capability or an enabled safeguard."
    });
  }

  const riskScore = Math.min(100, provisionalRiskScore);
  const safeCapabilities = Object.fromEntries(CAPABILITY_KEYS.map((key) => [
    key,
    typeof capabilities[key] === "boolean" ? capabilities[key] : null
  ]));
  const safeControls = Object.fromEntries(CONTROL_KEYS.map((key) => [
    key,
    typeof controls[key] === "boolean" ? controls[key] : null
  ]));
  const complete = unknownFields.length === 0;
  const hasCriticalFinding = findings.some((finding) => finding.severity === "critical");
  const riskLevel = !complete
    ? "Unknown"
    : hasCriticalFinding || riskScore >= 70
      ? "Critical"
      : riskScore >= 40
        ? "High"
        : riskScore >= 20
          ? "Medium"
          : "Low";

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((left, right) =>
    severityOrder[left.severity] - severityOrder[right.severity] ||
    left.id.localeCompare(right.id)
  );

  return {
    valid: true,
    assessmentType: "static-configuration-review",
    assessmentStatus: complete ? "complete" : "incomplete",
    riskLevel,
    riskScore: complete ? riskScore : null,
    provisionalRiskScore: complete ? null : riskScore,
    capabilities: safeCapabilities,
    controls: safeControls,
    unknownFields,
    findings,
    limitations: [
      "This is a configuration review, not a runtime penetration test.",
      "It does not execute tools, inspect source code, or verify deployed permissions.",
      "A low-risk result is not a guarantee that the agent is secure."
    ]
  };
}
