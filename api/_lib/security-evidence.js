const MAX_EVIDENCE_FIELD_LENGTH = 500;

function cleanEvidenceText(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\\u0000-\\u001f\\u007f]/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_EVIDENCE_FIELD_LENGTH);
}

/**
 * Keep only small, display-safe evidence fields supplied by the scanner.
 * Evidence is descriptive metadata, never executable markup or HTML.
 */
export function normalizeEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return null;
  }

  const normalized = {};
  for (const field of ["source", "signal", "observed", "expected"]) {
    const value = cleanEvidenceText(evidence[field]);
    if (value) normalized[field] = value;
  }

  return Object.keys(normalized).length ? normalized : null;
}
