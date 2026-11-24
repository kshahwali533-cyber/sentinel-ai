import { createSupabaseAdmin } from "./_lib/supabase-admin.js";
import { readTextLimited } from "./_lib/read-limited.js";
import {
  normalizeCveId,
  normalizeNvdCve,
  normalizeKevCatalog,
  buildIntelligenceResult
} from "./_lib/vulnerability-intelligence.js";

const NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const CISA_KEV_FEED = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CVE_CACHE_MS = 6 * 60 * 60 * 1000;
const KEV_CACHE_MS = 6 * 60 * 60 * 1000;

const supabaseAdmin = createSupabaseAdmin();

function send(res, status, body) {
  return res.status(status).json(body);
}

async function getUser(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user;
}

async function allowRate(scope, limit, windowMs) {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const { data, error } = await supabaseAdmin.rpc("check_intelligence_rate_limit", {
    p_scope_key: scope,
    p_window_start: windowStart,
    p_rate_limit: limit
  });
  if (error) throw error;
  return data === true;
}

async function fetchJson(url, timeoutMs, maxBytes, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    const error = new Error("UPSTREAM_" + response.status);
    error.status = response.status;
    throw error;
  }
  let text;
  try {
    // Enforce the limit while streaming so an oversized provider response
    // cannot be fully buffered in memory before it is rejected.
    text = await readTextLimited(response, maxBytes, timeoutMs);
  } catch (error) {
    const code = error?.code === "RESPONSE_TOO_LARGE"
      ? "UPSTREAM_RESPONSE_TOO_LARGE"
      : error?.code === "RESPONSE_BODY_TIMEOUT"
        ? "UPSTREAM_BODY_TIMEOUT"
        : "UPSTREAM_BODY_READ_FAILED";
    const upstreamError = new Error(code);
    upstreamError.cause = error;
    throw upstreamError;
  }
  return JSON.parse(text);
}

async function loadNvdCve(cveId) {
  const { data: cached, error: cacheError } = await supabaseAdmin.from("vulnerability_cache")
    .select("data,fetched_at,expires_at")
    .eq("cve_id", cveId).maybeSingle();
  if (cacheError) throw cacheError;

  const now = Date.now();
  await supabaseAdmin.from("vulnerability_cache")
    .delete().lt("expires_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
  const hasCache = Boolean(cached?.data);
  const fresh = hasCache && Date.parse(cached.expires_at) > now;
  if (fresh) return { data: cached.data, fetchedAt: cached.fetched_at, stale: false };

  const allowed = await allowRate("nvd-global", 4, 30 * 1000);
  if (!allowed) {
    if (hasCache) return { data: cached.data, fetchedAt: cached.fetched_at, stale: true };
    const error = new Error("NVD_RATE_LIMITED");
    error.status = 429;
    throw error;
  }

  try {
    const payload = await fetchJson(
      NVD_API + "?cveId=" + encodeURIComponent(cveId),
      15000,
      2_000_000,
      { "User-Agent": "SentinelAI-DefensiveResearch/1.0" }
    );
    const normalized = normalizeNvdCve(payload, cveId);
    if (!normalized) throw new Error("NVD_RESPONSE_INVALID");
    const fetchedAt = new Date().toISOString();
    const ttl = normalized.found ? CVE_CACHE_MS : 60 * 60 * 1000;
    const { error } = await supabaseAdmin.from("vulnerability_cache").upsert({
      cve_id: cveId,
      data: normalized,
      fetched_at: fetchedAt,
      expires_at: new Date(Date.now() + ttl).toISOString()
    }, { onConflict: "cve_id" });
    if (error) throw error;
    return { data: normalized, fetchedAt, stale: false };
  } catch (error) {
    if (hasCache) return { data: cached.data, fetchedAt: cached.fetched_at, stale: true };
    throw error;
  }
}

async function loadKevCatalog() {
  const { data: cached, error: cacheError } = await supabaseAdmin.from("kev_catalog_cache")
    .select("catalog_version,date_released,vulnerabilities,fetched_at")
    .eq("id", 1).maybeSingle();
  if (cacheError) throw cacheError;

  const now = Date.now();
  const hasCache = Boolean(cached?.vulnerabilities);
  const fresh = hasCache && now - Date.parse(cached.fetched_at) < KEV_CACHE_MS;
  if (fresh) {
    return {
      catalog: {
        catalog_version: cached.catalog_version,
        date_released: cached.date_released,
        vulnerabilities: cached.vulnerabilities
      },
      fetchedAt: cached.fetched_at,
      stale: false
    };
  }

  const allowed = await allowRate("cisa-kev-refresh", 2, 6 * 60 * 60 * 1000);
  if (!allowed) {
    if (hasCache) {
      return {
        catalog: {
          catalog_version: cached.catalog_version,
          date_released: cached.date_released,
          vulnerabilities: cached.vulnerabilities
        },
        fetchedAt: cached.fetched_at,
        stale: true
      };
    }
    return { catalog: null, fetchedAt: null, stale: true };
  }

  try {
    const payload = await fetchJson(CISA_KEV_FEED, 20000, 8_000_000);
    const normalized = normalizeKevCatalog(payload);
    if (!normalized) throw new Error("CISA_KEV_RESPONSE_INVALID");
    const fetchedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("kev_catalog_cache").upsert({
      id: 1,
      catalog_version: normalized.catalog_version,
      date_released: normalized.date_released,
      vulnerabilities: normalized.vulnerabilities,
      fetched_at: fetchedAt
    }, { onConflict: "id" });
    if (error) throw error;
    return { catalog: normalized, fetchedAt, stale: false };
  } catch (error) {
    console.error("Sentinel CISA KEV refresh failed:", error);
    if (hasCache) {
      return {
        catalog: {
          catalog_version: cached.catalog_version,
          date_released: cached.date_released,
          vulnerabilities: cached.vulnerabilities
        },
        fetchedAt: cached.fetched_at,
        stale: true
      };
    }
    return { catalog: null, fetchedAt: null, stale: true };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed." });
  }
  if (!supabaseAdmin) return send(res, 503, { error: "Intelligence service is not configured." });

  try {
    const user = await getUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to use vulnerability intelligence." });

    const rawId = Array.isArray(req.query?.cve)
      ? req.query.cve[0]
      : req.query?.cve || new URL(req.url, "https://sentinel.invalid").searchParams.get("cve");
    const cveId = normalizeCveId(rawId);
    if (!cveId) return send(res, 400, { error: "Enter a valid CVE ID, for example CVE-2021-44228." });

    if (!(await allowRate("user:" + user.id, 15, 60 * 1000))) {
      return send(res, 429, { error: "Too many intelligence lookups. Please wait one minute." });
    }

    const [nvd, kev] = await Promise.all([
      loadNvdCve(cveId),
      loadKevCatalog()
    ]);

    const result = buildIntelligenceResult(nvd.data, kev.catalog, kev.fetchedAt, kev.stale);
    result.meta = {
      nvd_fetched_at: nvd.fetchedAt,
      nvd_stale: nvd.stale,
      kev_available: Boolean(kev.catalog),
      nvd_source: "NIST National Vulnerability Database API 2.0",
      kev_source: "CISA Known Exploited Vulnerabilities catalog"
    };

    return send(res, 200, { success: true, result });
  } catch (error) {
    console.error("Sentinel vulnerability intelligence error:", error);
    if (error?.status === 429 || error?.message === "NVD_RATE_LIMITED") {
      return send(res, 429, { error: "The NVD request limit was reached. Please retry shortly." });
    }
    if (String(error?.message || "").startsWith("UPSTREAM_")) {
      return send(res, 502, { error: "A vulnerability data provider is temporarily unavailable." });
    }
    return send(res, 500, { error: "Unable to load vulnerability intelligence safely." });
  }
}
