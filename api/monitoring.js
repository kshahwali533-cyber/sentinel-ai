import dns from "node:dns/promises";
import net from "node:net";
import { isPublicIP } from "./_lib/public-ip.js";
import { createSafeFetch } from "./_lib/safe-fetch.js";
import { createPinnedRequest } from "./_lib/pinned-request.js";
import { readTextLimited } from "./_lib/read-limited.js";
import { normalizeMonitoringTarget } from "./_lib/monitoring.js";
import { randomBytes } from "node:crypto";
import { extractVerificationMetaToken, chooseOwnershipVerificationMethod } from "./_lib/domain-verification.js";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

function createOwnershipSafeFetch(hostname) {
  const validateTargetURL = async (url) => {
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== hostname) {
      return { safe: false, reason: "Verification must remain on the submitted HTTPS hostname." };
    }
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
      return { safe: false, reason: "Private or local destinations are not allowed." };
    }
    if (net.isIP(host)) {
      return isPublicIP(host)
        ? { safe: true, addresses: [{ address: host, family: net.isIP(host) }] }
        : { safe: false, reason: "Private or local destinations are not allowed." };
    }
    let resolved;
    try { resolved = await dns.lookup(host, { all: true, verbatim: true }); }
    catch { return { safe: false, reason: "The verification hostname could not be safely resolved." }; }
    if (!resolved.length || resolved.some((entry) => !isPublicIP(entry.address))) {
      return { safe: false, reason: "The verification hostname resolves to a private or local destination." };
    }
    return { safe: true, addresses: resolved.map((entry) => ({ address: entry.address, family: entry.family || net.isIP(entry.address) })) };
  };
  return createSafeFetch({ validateTargetURL, requestPinned: createPinnedRequest(), maxRedirects: 0 });
}

async function fetchOwnershipFile(hostname) {
  const safeFetch = createOwnershipSafeFetch(hostname);
  const url = new URL("https://" + hostname + "/.well-known/sentinel-ai-verification.txt");
  const { response, finalURL } = await safeFetch(url, {
    method: "GET",
    timeout: 8000,
    headers: { "User-Agent": "Sentinel-AI-Domain-Verification/1.0", "Accept": "text/plain" }
  });
  if (finalURL.hostname.toLowerCase() !== hostname || response.status !== 200) {
    await response.body?.cancel();
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  if (!/^text\/plain(?:\s*;|$)/i.test(contentType)) {
    await response.body?.cancel();
    return null;
  }
  return (await readTextLimited(response, 512, 5000)).trim();
}

async function fetchOwnershipMeta(hostname) {
  const safeFetch = createOwnershipSafeFetch(hostname);
  const url = new URL("https://" + hostname + "/");
  const { response, finalURL } = await safeFetch(url, {
    method: "GET",
    timeout: 8000,
    headers: { "User-Agent": "Sentinel-AI-Domain-Verification/1.0", "Accept": "text/html" }
  });
  if (finalURL.hostname.toLowerCase() !== hostname || response.status !== 200) {
    await response.body?.cancel();
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  if (!/^text\/html(?:\s*;|$)/i.test(contentType)) {
    await response.body?.cancel();
    return null;
  }
  const html = await readTextLimited(response, 65536, 5000);
  return extractVerificationMetaToken(html);
}

function send(res, status, body) {
  return res.status(status).json(body);
}

async function getUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user;
}

export default async function handler(req, res) {
  if (!supabaseAdmin) return send(res, 503, { error: "Monitoring service is not configured." });
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await getUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to manage monitoring." });

    if (req.method === "GET") {
      const [sites, alerts, runs] = await Promise.all([
        supabaseAdmin.from("monitoring_sites")
          .select("id,url,hostname,status,verification_token,verified_at,scan_interval_minutes,next_scan_at,last_scan_at,last_score,last_risk_level,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabaseAdmin.from("monitoring_alerts")
          .select("id,site_id,alert_type,severity,title,message,details,is_read,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabaseAdmin.from("monitoring_runs")
          .select("id,site_id,status,score,risk_level,error_code,started_at,finished_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30)
      ]);
      const failed = [sites.error, alerts.error, runs.error].find(Boolean);
      if (failed) throw failed;
      const safeSites = (sites.data || []).map((site) => {
        if (site.status === "pending") return site;
        const { verification_token, ...safeSite } = site;
        return safeSite;
      });
      return send(res, 200, {
        sites: safeSites,
        alerts: alerts.data || [],
        runs: runs.data || []
      });
    }

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const action = body.action;
    const siteId = typeof body.siteId === "string" ? body.siteId : "";

    if (action === "add") {
      let target;
      try {
        target = normalizeMonitoringTarget(body.url);
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
      const { count, error: countError } = await supabaseAdmin
        .from("monitoring_sites").select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (countError) throw countError;
      if ((count || 0) >= 5) return send(res, 429, { error: "The current beta limit is five monitored websites per account." });

      const token = randomBytes(24).toString("hex");
      const { data, error } = await supabaseAdmin.from("monitoring_sites")
        .insert({
          user_id: user.id,
          url: target.url,
          hostname: target.hostname,
          verification_token: token,
          status: "pending"
        })
        .select("id,url,hostname,status,created_at")
        .single();
      if (error) {
        if (error.code === "23505") return send(res, 409, { error: "This domain is already in your monitoring list." });
        throw error;
      }
      return send(res, 201, {
        site: data,
        verification: {
          record_type: "TXT",
          record_name: "_sentinel-ai-verification." + target.hostname,
          record_value: "sentinel-ai-verification=" + token
        }
      });
    }

    if (action === "verify_file") {
      if (!siteId) return send(res, 400, { error: "A monitoring site ID is required." });
      const { data: site, error: lookupError } = await supabaseAdmin.from("monitoring_sites")
        .select("id,hostname,verification_token,status")
        .eq("id", siteId).eq("user_id", user.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!site) return send(res, 404, { error: "Monitoring site not found." });
      let fileValue;
      try { fileValue = await fetchOwnershipFile(site.hostname); }
      catch (error) {
        console.error("HTTP ownership verification failed:", error?.message || error);
        return send(res, 409, { error: "The verification file could not be safely retrieved. Confirm it is publicly available over HTTPS and try again." });
      }
      if (fileValue !== "sentinel-ai-verification=" + site.verification_token) {
        return send(res, 409, { error: "The verification file is missing or its contents do not match. Upload the exact file shown below and try again." });
      }
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin.from("monitoring_sites")
        .update({ verified_at: now, status: "active", next_scan_at: now, updated_at: now })
        .eq("id", siteId).eq("user_id", user.id)
        .select("id,url,hostname,status,verified_at,next_scan_at").single();
      if (error) throw error;
      return send(res, 200, { site: data, message: "Website ownership verified using the HTTPS verification file." });
    }

    if (action === "verify_auto") {
      if (!siteId) return send(res, 400, { error: "A monitoring site ID is required." });
      const { data: site, error: lookupError } = await supabaseAdmin.from("monitoring_sites")
        .select("id,hostname,verification_token,status")
        .eq("id", siteId).eq("user_id", user.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!site) return send(res, 404, { error: "Monitoring site not found." });

      const expected = "sentinel-ai-verification=" + site.verification_token;
      let dnsVerified = false;
      try {
        const records = await dns.resolveTxt("_sentinel-ai-verification." + site.hostname);
        dnsVerified = records.map((parts) => parts.join("")).includes(expected);
      } catch {
        dnsVerified = false;
      }

      const [fileResult, metaResult] = dnsVerified
        ? [null, null]
        : await Promise.allSettled([
            fetchOwnershipFile(site.hostname).then((value) => value === expected),
            fetchOwnershipMeta(site.hostname).then((value) => value === site.verification_token)
          ]);
      const fileVerified = dnsVerified ? false : fileResult?.status === "fulfilled" && fileResult.value === true;
      const metaVerified = dnsVerified ? false : metaResult?.status === "fulfilled" && metaResult.value === true;
      const method = chooseOwnershipVerificationMethod({ dnsVerified, fileVerified, metaVerified });

      if (!method) {
        return send(res, 409, {
          error: "No matching ownership proof was found. Add the exact DNS TXT record, HTTPS verification file, or homepage meta tag shown below, then try Smart Auto Verify again.",
          checks: { dns_txt: dnsVerified, https_file: fileVerified, html_meta: metaVerified }
        });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin.from("monitoring_sites")
        .update({ verified_at: now, status: "active", next_scan_at: now, updated_at: now })
        .eq("id", siteId).eq("user_id", user.id)
        .select("id,url,hostname,status,verified_at,next_scan_at").single();
      if (error) throw error;
      return send(res, 200, { site: data, verification_method: method, message: "Website ownership verified using " + method + "." });
    }

    if (action === "verify_meta") {
      if (!siteId) return send(res, 400, { error: "A monitoring site ID is required." });
      const { data: site, error: lookupError } = await supabaseAdmin.from("monitoring_sites")
        .select("id,hostname,verification_token,status")
        .eq("id", siteId).eq("user_id", user.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!site) return send(res, 404, { error: "Monitoring site not found." });
      let metaValue;
      try { metaValue = await fetchOwnershipMeta(site.hostname); }
      catch (error) {
        console.error("HTML meta ownership verification failed:", error?.message || error);
        return send(res, 409, { error: "The website HTML could not be safely retrieved over HTTPS. Check that its homepage is public and try again." });
      }
      if (metaValue !== site.verification_token) {
        return send(res, 409, { error: "The exact Sentinel AI verification meta tag was not found in the homepage HTML. Add the tag inside the head section and try again." });
      }
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin.from("monitoring_sites")
        .update({ verified_at: now, status: "active", next_scan_at: now, updated_at: now })
        .eq("id", siteId).eq("user_id", user.id)
        .select("id,url,hostname,status,verified_at,next_scan_at").single();
      if (error) throw error;
      return send(res, 200, { site: data, message: "Website ownership verified using the HTML meta tag." });
    }

    if (action === "verify") {
      if (!siteId) return send(res, 400, { error: "A monitoring site ID is required." });
      const { data: site, error: lookupError } = await supabaseAdmin.from("monitoring_sites")
        .select("id,hostname,verification_token,status")
        .eq("id", siteId).eq("user_id", user.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!site) return send(res, 404, { error: "Monitoring site not found." });

      let records = [];
      try {
        records = await dns.resolveTxt("_sentinel-ai-verification." + site.hostname);
      } catch {
        return send(res, 409, { error: "The verification TXT record was not found yet. Add it to DNS and try again." });
      }
      const values = records.map((parts) => parts.join(""));
      if (!values.includes("sentinel-ai-verification=" + site.verification_token)) {
        return send(res, 409, { error: "The DNS TXT record does not match this verification token." });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin.from("monitoring_sites")
        .update({ verified_at: now, status: "active", next_scan_at: now, updated_at: now })
        .eq("id", siteId).eq("user_id", user.id)
        .select("id,url,hostname,status,verified_at,next_scan_at")
        .single();
      if (error) throw error;
      return send(res, 200, { site: data, message: "Domain ownership verified. Scheduled security checks will begin on the next 15-minute run." });
    }

    if (action === "pause" || action === "resume") {
      if (!siteId) return send(res, 400, { error: "A monitoring site ID is required." });
      const patch = action === "pause"
        ? { status: "paused", updated_at: new Date().toISOString() }
        : { status: "active", next_scan_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      let query = supabaseAdmin.from("monitoring_sites").update(patch)
        .eq("id", siteId).eq("user_id", user.id);
      if (action === "resume") query = query.not("verified_at", "is", null);
      const { data, error } = await query.select("id,status,next_scan_at").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Verified monitoring site not found." });
      return send(res, 200, { site: data });
    }

    if (action === "remove") {
      if (!siteId) return send(res, 400, { error: "A monitoring site ID is required." });
      const { data, error } = await supabaseAdmin.from("monitoring_sites")
        .delete().eq("id", siteId).eq("user_id", user.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Monitoring site not found." });
      return send(res, 200, { removed: true });
    }

    if (action === "mark_read") {
      const alertId = typeof body.alertId === "string" ? body.alertId : "";
      if (!alertId) return send(res, 400, { error: "An alert ID is required." });
      const { data, error } = await supabaseAdmin.from("monitoring_alerts")
        .update({ is_read: true }).eq("id", alertId).eq("user_id", user.id)
        .select("id,is_read").maybeSingle();
      if (error) throw error;
      if (!data) return send(res, 404, { error: "Alert not found." });
      return send(res, 200, { alert: data });
    }

    return send(res, 400, { error: "Unsupported monitoring action." });
  } catch (error) {
    console.error("Sentinel monitoring API error:", error);
    return send(res, 500, { error: "Unable to process the monitoring request safely." });
  }
}
