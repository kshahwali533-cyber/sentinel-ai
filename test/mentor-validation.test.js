import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMentorInput,
  normalizeMentorResponse,
  buildMentorFallback
} from "../api/_lib/mentor-validation.js";

test("mentor input validates finding and removes URL paths and query data", () => {
  const input = normalizeMentorInput({
    finding: "HSTS",
    severity: "Medium",
    status: "WARNING",
    website: "https://example.org/private?token=secret",
    message: "Header missing",
    fix: "Add HSTS"
  });
  assert.equal(input.website, "https://example.org");
  assert.equal(input.status, "WARNING");
  assert.equal(input.message, "Header missing");
  assert.doesNotMatch(input.website, /token|private/);
});

test("mentor input rejects invalid websites and oversized findings", () => {
  assert.equal(normalizeMentorInput({ finding: "HSTS", website: "javascript:alert(1)" }), null);
  assert.equal(normalizeMentorInput({ finding: "x".repeat(161) }), null);
});

test("mentor evidence is normalized and bounded", () => {
  const input = normalizeMentorInput({
    finding: "HSTS",
    evidence: { source: "HTTP response", signal: "strict-transport-security", observed: "Header not present" }
  });
  assert.equal(input.evidence.signal, "strict-transport-security");
  assert.equal(normalizeMentorInput({ finding: "HSTS", evidence: { observed: "x".repeat(3000) } }), null);
});

test("AI response cannot change scanner severity or status", () => {
  const input = { finding: "HSTS", severity: "Low", status: "WARNING" };
  const response = normalizeMentorResponse({
    title: "HSTS",
    severity: "Critical",
    status: "PASS",
    explanation: "Observed header is missing.",
    why_it_matters: "HTTPS downgrade risk.",
    defensive_action: "Add HSTS.",
    steps: ["Review HTTPS", "Add the header"],
    verification: "Rescan."
  }, input);
  assert.equal(response.severity, "Low");
  assert.equal(response.status, "WARNING");
});

test("AI response rejects empty, excessive, or malformed steps", () => {
  const input = { severity: "Unknown", status: "INFO" };
  const base = {
    title: "Finding",
    explanation: "Explanation",
    why_it_matters: "Why",
    defensive_action: "Action",
    verification: "Verify",
    steps: ["One"]
  };
  assert.equal(normalizeMentorResponse({ ...base, steps: [""] }, input), null);
  assert.equal(normalizeMentorResponse({ ...base, steps: new Array(9).fill("step") }, input), null);
  assert.equal(normalizeMentorResponse({ ...base, steps: [42] }, input), null);
});

test("PASS findings receive positive, non-alarmist fallback guidance", () => {
  const fallback = buildMentorFallback({
    finding: "HSTS",
    severity: "Unknown",
    status: "PASS",
    message: "Strict-Transport-Security is present."
  });
  assert.match(fallback.explanation, /present/);
  assert.match(fallback.why_it_matters, /does not prove/);
  assert.equal(fallback.status, "PASS");
});

test("informational findings are not described as confirmed vulnerabilities", () => {
  const fallback = buildMentorFallback({
    finding: "HTTP Response Status",
    severity: "Unknown",
    status: "INFO",
    message: "HTTP 200 returned."
  });
  assert.match(fallback.explanation, /not, by itself, proof/);
});

test("warning fallback uses known defensive guidance when available", () => {
  const fallback = buildMentorFallback({
    finding: "HSTS",
    severity: "Medium",
    status: "WARNING"
  }, {
    HSTS: {
      explanation: "HSTS is missing.",
      why_it_matters: "It reduces downgrade risk.",
      defensive_action: "Configure HSTS.",
      steps: ["Enable HTTPS", "Add HSTS"],
      verification: "Rescan."
    }
  });
  assert.equal(fallback.defensive_action, "Configure HSTS.");
  assert.equal(fallback.severity, "Medium");
});
