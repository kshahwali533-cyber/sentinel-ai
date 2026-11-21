/**
 * Persist a Research Lab audit event and never silently ignore failures.
 *
 * The surrounding API operations are guarded and state changes are conditional;
 * if audit persistence fails, the caller receives a distinct error and must
 * reload before retrying. Database-level atomicity requires the corresponding
 * transaction RPC migration to be applied separately.
 */
export async function recordResearchCaseEvent(client, event) {
  if (!client || !event || typeof event !== "object") {
    throw new TypeError("A database client and research event are required.");
  }
  const row = {
    case_id: event.caseId,
    actor_user_id: event.actorUserId || null,
    event_type: event.eventType,
    details: event.details && typeof event.details === "object" && !Array.isArray(event.details)
      ? event.details
      : {}
  };
  if (typeof row.case_id !== "string" || !row.case_id ||
      typeof row.event_type !== "string" || !row.event_type) {
    throw new TypeError("Research audit event identifiers are invalid.");
  }
  const { error } = await client.from("research_case_events").insert(row);
  if (error) {
    const failure = new Error("Research case state may have changed, but the audit event could not be recorded.");
    failure.code = "RESEARCH_AUDIT_WRITE_FAILED";
    failure.cause = error;
    throw failure;
  }
}
