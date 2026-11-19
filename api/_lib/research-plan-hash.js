import { createHash } from "node:crypto";

export function createResearchPlanFingerprint({ caseId, targetUrl, method, testCategory }) {
  if (typeof caseId !== "string" || !/^[0-9a-f-]{36}$/i.test(caseId)) return null;
  if (typeof targetUrl !== "string" || typeof method !== "string" || typeof testCategory !== "string") return null;
  try {
    const url = new URL(targetUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) return null;
    const origin = `https://${url.hostname.toLowerCase()}:${url.port || "443"}`;
    const normalizedMethod = method.toUpperCase();
    const category = testCategory.trim();
    if (!category || category.length > 80) return null;
    const plan = {
      case_id: caseId,
      target_origin: origin,
      target_path: url.pathname || "/",
      method: normalizedMethod,
      test_category: category
    };
    const planHash = createHash("sha256").update(JSON.stringify(plan), "utf8").digest("hex");
    return { ...plan, plan_hash: planHash };
  } catch {
    return null;
  }
}
