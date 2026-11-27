import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { renderCanonicalAsset } from "../../api/_lib/canonical-assets.js";

const root = path.resolve(process.env.SENTINEL_E2E_ROOT || process.cwd());
const port = Number(process.env.PORT || 4174);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", "http://127.0.0.1:" + port);
  if (requestUrl.pathname === "/api/scan" && requestUrl.searchParams.get("runtime_config") === "1") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end("window.SENTINEL_RUNTIME_CONFIG = Object.freeze({isProduction:false});");
    return;
  }

  const canonicalRoutes = {
    "/robots.txt": "robots",
    "/sitemap.xml": "sitemap",
    "/.well-known/security.txt": "security"
  };
  if (req.method === "GET" && canonicalRoutes[requestUrl.pathname]) {
    const asset = renderCanonicalAsset(canonicalRoutes[requestUrl.pathname], {
      VERCEL_PROJECT_PRODUCTION_URL: "project-3jyda.vercel.app",
      VERCEL_ENV: "preview"
    });
    if (!asset) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Canonical origin unavailable.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex"
    });
    res.end(asset.body);
    return;
  }

  const pathname = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(root, "." + pathname);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request.");
    return;
  }
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(contents);
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write("Sentinel isolated Preview browser server listening on 127.0.0.1:" + port + "\n");
});
