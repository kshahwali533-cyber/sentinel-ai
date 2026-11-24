import { isApprovedProductionRequest } from "./_lib/runtime-config.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("/* Method not allowed. */");
  }

  const isProduction = isApprovedProductionRequest({
    env: process.env,
    host: req.headers?.host
  });

  const config = Object.freeze({ isProduction });
  return res.status(200).send(
    "window.SENTINEL_RUNTIME_CONFIG = Object.freeze(" +
    JSON.stringify(config) +
    ");"
  );
}
