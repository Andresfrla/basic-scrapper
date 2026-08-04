// services/emailService.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "./emailService.js";

describe("emailService", () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.SMTP2GO_API_KEY = "test-key";
    process.env.EMAIL_FROM = "noreply@example.com";
    process.env.EMAIL_FROM_NAME = "Test Sender";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const key of ["SMTP2GO_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME"]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  test("sendEmail retorna success cuando smtp2go responde 200", async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ data: { succeeded: 1 } }),
    });

    const result = await sendEmail({
      to: [{ email: "dest@example.com", name: "Dest" }],
      subject: "Asunto",
      html: "<p>hola</p>",
    });

    assert.equal(result.success, true);
    assert.equal(result.message, "Correo enviado");
  });

  test("sendEmail retorna failure cuando smtp2go responde un status no-2xx", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ data: { error: "invalid" } }),
    });

    const result = await sendEmail({
      to: [{ email: "dest@example.com" }],
      subject: "Asunto",
      html: "<p>hola</p>",
    });

    assert.equal(result.success, false);
    assert.match(result.message, /smtp2go respondió 400/);
  });

  test("sendEmail retorna failure cuando falta SMTP2GO_API_KEY", async () => {
    delete process.env.SMTP2GO_API_KEY;

    const result = await sendEmail({
      to: [{ email: "dest@example.com" }],
      subject: "Asunto",
      html: "<p>hola</p>",
    });

    assert.equal(result.success, false);
    assert.match(result.message, /falta API key/);
  });
});
