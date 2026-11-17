import net from "node:net";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import { createPinnedLookup } from "./pinned-lookup.js";
import { isPublicIP } from "./public-ip.js";

/**
 * Create a request function that connects only to an already-validated IP.
 *
 * Production callers must use the default public-IP policy. The injectable
 * predicate exists so integration tests can exercise the real socket and
 * pinned lookup against an isolated loopback test server.
 */
export function createPinnedRequest({
  isPublicIPAddress = isPublicIP
} = {}) {
  if (typeof isPublicIPAddress !== "function") {
    throw new TypeError("isPublicIPAddress must be a function.");
  }

  return async function requestPinned(urlObject, validatedAddresses, options = {}) {
    if (!Array.isArray(validatedAddresses) || validatedAddresses.length === 0) {
      throw new Error("No validated destination addresses are available.");
    }

    const normalizeHost = value => {
      const normalized = String(value).toLowerCase();
      return normalized.startsWith("[") && normalized.endsWith("]")
        ? normalized.slice(1, -1)
        : normalized;
    };
    const hostname = normalizeHost(urlObject.hostname);
    const pinned = validatedAddresses[0];
    const pinnedFamily = net.isIP(pinned.address);

    if (
      !pinnedFamily ||
      pinnedFamily !== pinned.family ||
      !isPublicIPAddress(pinned.address)
    ) {
      throw new Error("The validated destination address is not safe.");
    }

    const transport = urlObject.protocol === "https:" ? https : http;

    return await new Promise((resolve, reject) => {
      let settled = false;
      const timeoutMs = options.timeout || 15000;

      const request = transport.request({
        protocol: urlObject.protocol,
        hostname,
        port: urlObject.port || undefined,
        path: `${urlObject.pathname}${urlObject.search}`,
        method: options.method || "GET",
        headers: options.headers || {},
        servername: net.isIP(hostname) ? undefined : hostname,
        // Never let the transport resolve this hostname again after validation.
        lookup: createPinnedLookup(hostname, pinned)
      }, incoming => {
        try {
          const responseHeaders = new Headers();

          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value === undefined) continue;

            if (Array.isArray(value)) {
              for (const item of value) {
                responseHeaders.append(name, String(item));
              }
            } else {
              responseHeaders.set(name, String(value));
            }
          }

          const status = incoming.statusCode || 502;
          const body = [204, 205, 304].includes(status)
            ? null
            : Readable.toWeb(incoming);

          const response = new Response(body, {
            status,
            statusText: incoming.statusMessage,
            headers: responseHeaders
          });

          settled = true;
          clearTimeout(timeout);
          resolve(response);
        } catch (error) {
          clearTimeout(timeout);
          incoming.destroy(error);

          if (!settled) {
            settled = true;
            reject(error);
          }
        }
      });

      const timeout = setTimeout(() => {
        const error = new Error("The website took too long to respond.");
        error.name = "AbortError";
        request.destroy(error);
      }, timeoutMs);

      request.on("error", error => {
        clearTimeout(timeout);

        if (!settled) {
          reject(error);
        }
      });

      request.end();
    });
  };
}
