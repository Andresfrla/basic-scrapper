// services/adminSession.test.js
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createAdminSessionCookie,
  hasValidAdminSession,
  verifyAdminPassword,
} from "./adminSession.js";

describe("adminSession", () => {
  const original = process.env.ADMIN_PASSWORD;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = original;
  });

  test("acepta la clave correcta y rechaza otra", () => {
    process.env.ADMIN_PASSWORD = "clave-compartida-larga";
    assert.equal(verifyAdminPassword("clave-compartida-larga"), true);
    assert.equal(verifyAdminPassword("incorrecta"), false);
  });

  test("crea una cookie válida que expira después de 12 horas", () => {
    process.env.ADMIN_PASSWORD = "clave-compartida-larga";
    const now = Date.parse("2026-08-03T12:00:00Z");
    const setCookie = createAdminSessionCookie(now);
    const cookie = setCookie.split(";", 1)[0];
    const req = { headers: { cookie } };
    assert.equal(hasValidAdminSession(req, now + 1), true);
    assert.equal(hasValidAdminSession(req, now + 12 * 60 * 60 * 1000 + 1), false);
  });
});
