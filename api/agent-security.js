import { assessAgentSecurity } from "./_lib/agent-security-assessment.js";
import { isWithinJsonBodyLimit } from "./_lib/request-size.js";

const MAX_AGENT_SECURITY_BODY_BYTES = 16 * 1024;

function reply(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(body);
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { error: "Method not allowed." });
  }

  if (!isWithinJsonBodyLimit(req.body, MAX_AGENT_SECURITY_BODY_BYTES)) {
    return reply(res, 413, { error: "Agent security assessment payload is too large or invalid." });
  }

  const result = assessAgentSecurity(req.body);
  if (!result.valid) {
    return reply(res, 400, { error: result.error });
  }

  return reply(res, 200, result);
}
