import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "sat_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function password() {
  return process.env.ADMIN_PASSWORD || "";
}

function equal(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(expiresAt) {
  return createHmac("sha256", password()).update(String(expiresAt)).digest("base64url");
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return pair ? pair.slice(COOKIE_NAME.length + 1) : "";
}

export function verifyAdminPassword(candidate) {
  return Boolean(password()) && equal(candidate, password());
}

export function createAdminSessionCookie(now = Date.now()) {
  if (!password()) throw new Error("ADMIN_PASSWORD no está configurado");
  const expiresAt = now + SESSION_TTL_MS;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${expiresAt}.${signature(expiresAt)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function hasValidAdminSession(req, now = Date.now()) {
  if (!password()) return false;
  const [expiresRaw, receivedSignature] = readCookie(req).split(".");
  const expiresAt = Number(expiresRaw);
  return Number.isFinite(expiresAt)
    && expiresAt > now
    && Boolean(receivedSignature)
    && equal(receivedSignature, signature(expiresAt));
}
