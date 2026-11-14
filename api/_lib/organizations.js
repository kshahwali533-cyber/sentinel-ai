import { createHash } from "node:crypto";

export function normalizeOrganizationName(value) {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 100) {
    throw new Error("Workspace name must contain 2 to 100 characters.");
  }
  return value.trim();
}

export function slugifyOrganizationName(value) {
  const slug = value.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 41);
  return slug.length >= 2 ? slug : "team-workspace";
}

export function hashOrganizationInviteToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isValidOrganizationInviteEmail(value) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
