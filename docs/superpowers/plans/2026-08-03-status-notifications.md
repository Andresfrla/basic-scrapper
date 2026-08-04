# Notificaciones por Correo (Cambio de Status + Digest General) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copiar el envío de correos de `border-flow` (smtp2go vía `fetch`) a `basic-scrapper`, proteger la aplicación con una sola clave compartida y usar el correo para (1) resumir cambios de `status` en horarios de mañana/noche configurables por contacto y (2) mandar un digest general dos veces al día, diario o semanal.

**Architecture:** El proyecto corre en Vercel (funciones bajo `api/`) y replica sus rutas con Express para desarrollo. Una clave `ADMIN_PASSWORD` crea una cookie de sesión firmada, `HttpOnly` y de corta duración; las rutas de datos y configuración exigen esa sesión, mientras los crons conservan `CRON_SECRET`. Firestore guarda contactos y eventos; el dispatcher consulta eventos únicamente hasta el slot programado, avanza cursores sólo tras éxito y usa un lease global en Firestore para impedir ejecuciones solapadas.

**Tech Stack:** Node.js (ESM, `.js` plano — igual que el resto de `services/`), Express, Firebase Admin / Firestore, smtp2go (fetch nativo, sin SDK nuevo), React + TypeScript + shadcn/ui en el frontend, `node --test` (test runner nativo de Node, sin dependencia nueva) para la lógica pura (horarios, plantillas, servicio de correo).

## Global Constraints

- No agregar dependencias npm nuevas — usar `fetch`, `Intl`, `node:crypto` y `node:test`/`node:assert` nativos.
- Los archivos de backend nuevos van en JavaScript plano (`.js`, ESM), seleccionando el mismo patrón que `services/sheetRowsRepo.js` y `services/scrapeReconciliation.js` — NO TypeScript, porque las funciones de Vercel en `api/` se ejecutan directo sin paso de build.
- Los archivos de frontend nuevos van en TypeScript (`.ts`/`.tsx`), igual que el resto de `src/`.
- Cada ruta nueva de Express en `proxy-server/routes/*.js` debe tener su espejo exacto como función de Vercel en `api/**/*.js` (mismo patrón que `cep`/`sheet`/`sat`).
- Las horas se guardan como strings `"HH:mm"` (24h) y se interpretan en la zona horaria `America/Mexico_City`, calculada con `Intl.DateTimeFormat` (México ya no usa horario de verano desde 2022, así que el offset es fijo, pero igual se calcula dinámicamente por robustez).
- `ADMIN_PASSWORD` debe tener al menos 16 caracteres, protege la aplicación mediante cookie firmada y nunca se expone en una variable `VITE_*`, en el bundle ni en `localStorage`.
- El cron de notificaciones (`/api/notifications/dispatch`) corre cada 15 minutos (`*/15 * * * *`) sólo si el proyecto está en Vercel Pro/Enterprise y usa `CRON_SECRET` como `/api/sat/auto-scrape`.
- El dispatcher ofrece entrega **al menos una vez**: evita solapamientos con un lease global y sólo avanza cursores tras éxito. Un corte entre la aceptación de smtp2go y la escritura del cursor todavía puede duplicar un correo; eliminar esa ventana requeriría soporte de idempotencia del proveedor o una cola durable y queda fuera de v1.
- Toda entrada HTTP se valida y se filtra por allowlist en el servidor. Los endpoints públicos de contactos nunca pueden modificar `id`, `createdAt` ni cursores de entrega.
- Se agrega `"test": "node --test services"`. Deben quedar pruebas para autenticación, validación de contactos, horarios y el dispatcher (incluido fallo SMTP y ventana de eventos); Firestore real y rutas se verifican además manualmente.

---

### Task 0: Sesión administrativa con clave compartida

**Files:**
- Create: `services/adminSession.js`
- Test: `services/adminSession.test.js`

**Interfaces:**
- Produces: `verifyAdminPassword(password) => boolean`, `createAdminSessionCookie(now?) => string`, `clearAdminSessionCookie() => string`, `hasValidAdminSession(req, now?) => boolean`.
- La sesión dura 12 horas, se firma con HMAC-SHA256 usando `ADMIN_PASSWORD` y se guarda en la cookie `sat_admin_session`. Cambiar la clave invalida todas las sesiones.

- [ ] **Step 1: Escribir la prueba que falla**

```js
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
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `node --test services/adminSession.test.js`
Expected: FAIL — `Cannot find module './adminSession.js'`.

- [ ] **Step 3: Implementar `services/adminSession.js`**

```js
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "sat_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function password() {
  const value = process.env.ADMIN_PASSWORD || "";
  return value.length >= 16 ? value : "";
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
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `node --test services/adminSession.test.js`
Expected: PASS (2 pruebas).

- [ ] **Step 5: Commit**

```bash
git add services/adminSession.js services/adminSession.test.js
git commit -m "feat: add shared-key admin session"
```

---

### Task 1: Servicio de correo (`services/emailService.js`)

**Files:**
- Create: `services/emailService.js`
- Test: `services/emailService.test.js`
- Create: `.env.example`
- Modify: `package.json:9` (agregar script `test`)

**Interfaces:**
- Produces: `sendEmail({ to: {email, name?}[], subject: string, html: string }) => Promise<{ success: boolean, message: string }>`. No se agregan adjuntos, logs estructurados ni helpers sin consumidor.

- [ ] **Step 1: Escribir la prueba que falla**

```js
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
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `node --test services/emailService.test.js`
Expected: FAIL — `Cannot find module './emailService.js'` (el archivo aún no existe).

- [ ] **Step 3: Implementar `services/emailService.js`**

```js
// services/emailService.js
// Puerto directo de border-flow/services/emailService.ts a JS plano (mismo
// proveedor smtp2go, misma forma de payload), sin dependencia SDK nueva.

const SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send";

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.SMTP2GO_API_KEY || "";
  const from = process.env.EMAIL_FROM || "";
  const fromName = process.env.EMAIL_FROM_NAME || "SAT CEP Scraper";

  if (!apiKey) {
    return { success: false, message: "Servicio de correo no configurado (falta API key)" };
  }
  if (!from) {
    return { success: false, message: "Servicio de correo no configurado (falta remitente)" };
  }

  const payload = {
    api_key: apiKey,
    html_body: html,
    sender: `${fromName} <${from}>`,
    subject,
    to: to.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
  };

  try {
    const res = await fetch(SMTP2GO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { success: false, message: `smtp2go respondió ${res.status}` };
    }

    return { success: true, message: "Correo enviado" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, message };
  }
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `node --test services/emailService.test.js`
Expected: PASS (3 pruebas).

- [ ] **Step 5: Agregar variables de entorno y script de pruebas**

Crear `.env.example` sin valores secretos; `.env` está ignorado por Git y se configura sólo en cada entorno:

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIRESTORE_DATABASE_ID=scrapper-catch
CRON_SECRET=
ADMIN_PASSWORD=
SMTP2GO_API_KEY=
EMAIL_FROM=
EMAIL_FROM_NAME=SAT CEP Scraper
SAT_DEBUG=false
SAT_TLS_LEGACY=false
```

En `package.json`, agregar el script `test` junto a los demás scripts:

```json
"scripts": {
  "dev": "concurrently \"vite\" \"node proxy-server/index.js\"",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "node --test services"
}
```

- [ ] **Step 6: Commit**

```bash
git add services/emailService.js services/emailService.test.js .env.example package.json
git commit -m "feat: add smtp2go email service ported from border-flow"
```

---

### Task 2: Motor de horarios (`services/notificationSchedule.js`)

**Files:**
- Create: `services/notificationSchedule.js`
- Test: `services/notificationSchedule.test.js`

**Interfaces:**
- Produces: `findDueSlot({ times: string[], weekday?: number|null }, lastSentAtIso: string|null, now?: Date) => string|null` — devuelve el ISO string del horario programado más reciente que ya pasó (`<= now`) y es posterior a `lastSentAtIso`, o `null` si ninguno aplica todavía. `weekday`: `null` (todos los días) o `0`-`6` (`0`=domingo) para restringir a un día de la semana.

- [ ] **Step 1: Escribir la prueba que falla**

```js
// services/notificationSchedule.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findDueSlot } from "./notificationSchedule.js";

describe("findDueSlot", () => {
  test("detecta el horario de la mañana cuando nunca se ha enviado", () => {
    // 2026-08-03T14:30:00Z = 2026-08-03 08:30 CDMX (UTC-6, sin horario de verano)
    const now = new Date("2026-08-03T14:30:00Z");
    const due = findDueSlot({ times: ["08:00", "20:00"] }, null, now);
    assert.equal(due, "2026-08-03T14:00:00.000Z");
  });

  test("no vuelve a marcar el mismo horario como pendiente", () => {
    const now = new Date("2026-08-03T14:30:00Z");
    const alreadySent = "2026-08-03T14:00:00.000Z";
    const due = findDueSlot({ times: ["08:00", "20:00"] }, alreadySent, now);
    assert.equal(due, null);
  });

  test("detecta el horario de la noche del mismo día tras haber enviado el de la mañana", () => {
    // 2026-08-03T02:05:00Z del día siguiente = 2026-08-03 20:05 CDMX
    const now = new Date("2026-08-04T02:05:00Z");
    const morningSent = "2026-08-03T14:00:00.000Z";
    const due = findDueSlot({ times: ["08:00", "20:00"] }, morningSent, now);
    assert.equal(due, "2026-08-04T02:00:00.000Z");
  });

  test("respeta la restricción de día de la semana (weekly)", () => {
    // 2026-08-03 es lunes (weekday 1)
    const now = new Date("2026-08-03T14:30:00Z");
    const dueMonday = findDueSlot({ times: ["08:00"], weekday: 1 }, null, now);
    assert.equal(dueMonday, "2026-08-03T14:00:00.000Z");

    const dueTuesday = findDueSlot({ times: ["08:00"], weekday: 2 }, null, now);
    assert.equal(dueTuesday, null);
  });

  test("recupera el slot semanal tras varios días sin ejecutar el cron", () => {
    const now = new Date("2026-08-06T14:30:00Z"); // jueves
    const due = findDueSlot({ times: ["08:00"], weekday: 1 }, null, now);
    assert.equal(due, "2026-08-03T14:00:00.000Z"); // lunes anterior
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `node --test services/notificationSchedule.test.js`
Expected: FAIL — `Cannot find module './notificationSchedule.js'`.

- [ ] **Step 3: Implementar `services/notificationSchedule.js`**

```js
// services/notificationSchedule.js
const TIME_ZONE = "America/Mexico_City";

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedOffsetMinutes(date) {
  const zoned = getZonedParts(date);
  const asUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function zonedWallTimeToInstant(year, month, day, hhmm) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = zonedOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offsetMinutes * 60000);
}

function zonedWeekday(year, month, day) {
  // Mediodía UTC evita problemas de redondeo; el día de la semana de un
  // triplete Y/M/D no depende de la hora del día.
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function addDays(year, month, day, offset) {
  const shifted = new Date(Date.UTC(year, month - 1, day, 12));
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/**
 * Busca el horario programado más reciente que ya pasó (<= now) y es
 * posterior a lastSentAtIso. Devuelve su ISO string, o null si ninguno aplica.
 */
export function findDueSlot({ times, weekday = null }, lastSentAtIso, now = new Date()) {
  const lastSentAt = lastSentAtIso ? new Date(lastSentAtIso) : new Date(0);
  const today = getZonedParts(now);

  const candidates = [];
  const firstOffset = weekday === null ? -1 : -7;
  for (let offset = firstOffset; offset <= 0; offset += 1) {
    const { year, month, day } = addDays(today.year, today.month, today.day, offset);
    if (weekday !== null && zonedWeekday(year, month, day) !== weekday) continue;
    for (const time of times) {
      candidates.push(zonedWallTimeToInstant(year, month, day, time));
    }
  }

  const due = candidates
    .filter((instant) => instant > lastSentAt && instant <= now)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return due ? due.toISOString() : null;
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `node --test services/notificationSchedule.test.js`
Expected: PASS (5 pruebas).

- [ ] **Step 5: Commit**

```bash
git add services/notificationSchedule.js services/notificationSchedule.test.js
git commit -m "feat: add CDMX schedule matcher for notification digests"
```

---

### Task 3: Plantillas de correo

**Files:**
- Create: `services/emailTemplates/notifications/shared.js`
- Create: `services/emailTemplates/notifications/statusChangeDigest.js`
- Create: `services/emailTemplates/notifications/generalStatusDigest.js`
- Test: `services/emailTemplates/notifications/statusChangeDigest.test.js`
- Test: `services/emailTemplates/notifications/generalStatusDigest.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `buildStatusChangeDigestEmail(events: {rowId, previousStatus, newStatus, detectedAt}[]) => { subject: string, html: string }`; `buildGeneralStatusDigestEmail(rows: {id, values: Record<string,string>}[]) => { subject: string, html: string }`. Ambos usados por `services/notificationDispatcher.js` en la Task 6.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
// services/emailTemplates/notifications/statusChangeDigest.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildStatusChangeDigestEmail } from "./statusChangeDigest.js";

describe("buildStatusChangeDigestEmail", () => {
  test("incluye el conteo de eventos en el asunto", () => {
    const { subject } = buildStatusChangeDigestEmail([
      { rowId: "row-1", previousStatus: "PAGADO", newStatus: "DESADUANADO", detectedAt: "2026-08-03T14:00:00.000Z" },
    ]);
    assert.equal(subject, "Resumen de cambios de status (1)");
  });

  test("escapa HTML en los valores de status para evitar inyección", () => {
    const { html } = buildStatusChangeDigestEmail([
      {
        rowId: "row-1",
        previousStatus: "<script>alert(1)</script>",
        newStatus: "DESADUANADO",
        detectedAt: "2026-08-03T14:00:00.000Z",
      },
    ]);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  test("lista todos los eventos recibidos", () => {
    const { html } = buildStatusChangeDigestEmail([
      { rowId: "row-1", previousStatus: "A", newStatus: "B", detectedAt: "2026-08-03T14:00:00.000Z" },
      { rowId: "row-2", previousStatus: "B", newStatus: "C", detectedAt: "2026-08-03T15:00:00.000Z" },
    ]);
    assert.match(html, /row-1/);
    assert.match(html, /row-2/);
  });
});
```

```js
// services/emailTemplates/notifications/generalStatusDigest.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildGeneralStatusDigestEmail } from "./generalStatusDigest.js";

describe("buildGeneralStatusDigestEmail", () => {
  test("incluye el total de registros en el asunto", () => {
    const rows = [
      { id: "1", values: { status: "PAGADO", pedimento: "111", fechaCruce: "" } },
      { id: "2", values: { status: "DESADUANADO", pedimento: "222", fechaCruce: "" } },
    ];
    const { subject } = buildGeneralStatusDigestEmail(rows);
    assert.equal(subject, "Status general — 2 registro(s)");
  });

  test("agrupa el conteo por status", () => {
    const rows = [
      { id: "1", values: { status: "PAGADO", pedimento: "111", fechaCruce: "" } },
      { id: "2", values: { status: "PAGADO", pedimento: "222", fechaCruce: "" } },
      { id: "3", values: { status: "DESADUANADO", pedimento: "333", fechaCruce: "" } },
    ];
    const { html } = buildGeneralStatusDigestEmail(rows);
    assert.match(html, />PAGADO<\/td><td[^>]*>2</);
    assert.match(html, />DESADUANADO<\/td><td[^>]*>1</);
  });

  test("trata status vacío como '(sin status)'", () => {
    const rows = [{ id: "1", values: { status: "", pedimento: "111", fechaCruce: "" } }];
    const { html } = buildGeneralStatusDigestEmail(rows);
    assert.match(html, /\(sin status\)/);
  });
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `node --test services/emailTemplates/notifications`
Expected: FAIL — módulos `./statusChangeDigest.js` y `./generalStatusDigest.js` no existen.

- [ ] **Step 3: Implementar `services/emailTemplates/notifications/shared.js`**

```js
// services/emailTemplates/notifications/shared.js
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCdmxDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function renderEmailShell({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#111827;padding:20px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">${escapeHtml(title)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;color:#111827;font-size:14px;line-height:1.5;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;color:#6b7280;font-size:12px;">
                SAT CEP Scraper — notificación automática
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
```

- [ ] **Step 4: Implementar `services/emailTemplates/notifications/statusChangeDigest.js`**

```js
// services/emailTemplates/notifications/statusChangeDigest.js
import { escapeHtml, formatCdmxDateTime, renderEmailShell } from "./shared.js";

export function buildStatusChangeDigestEmail(events) {
  const rowsHtml = events
    .map(
      (event) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(event.rowId)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(event.previousStatus || "(sin status)")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(event.newStatus)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatCdmxDateTime(new Date(event.detectedAt)))}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <p>Se detectaron <strong>${events.length}</strong> cambio(s) de status desde el último resumen:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 12px;background-color:#f3f4f6;">Fila</th>
          <th style="text-align:left;padding:8px 12px;background-color:#f3f4f6;">Status anterior</th>
          <th style="text-align:left;padding:8px 12px;background-color:#f3f4f6;">Status nuevo</th>
          <th style="text-align:left;padding:8px 12px;background-color:#f3f4f6;">Detectado</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;

  return {
    subject: `Resumen de cambios de status (${events.length})`,
    html: renderEmailShell({ title: "Cambios de status detectados", bodyHtml }),
  };
}
```

- [ ] **Step 5: Implementar `services/emailTemplates/notifications/generalStatusDigest.js`**

```js
// services/emailTemplates/notifications/generalStatusDigest.js
import { escapeHtml, formatCdmxDateTime, renderEmailShell } from "./shared.js";

function groupByStatus(rows) {
  const counts = new Map();
  for (const row of rows) {
    const status = row.values.status || "(sin status)";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function buildGeneralStatusDigestEmail(rows) {
  const summary = groupByStatus(rows);
  const summaryHtml = summary
    .map(
      ([status, count]) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(status)}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${count}</td></tr>`
    )
    .join("");

  const rowsHtml = rows
    .map(
      (row) => `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.values.pedimento || row.id)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.values.status || "(sin status)")}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.values.fechaCruce || "-")}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <p>Reporte general al ${escapeHtml(formatCdmxDateTime())} — ${rows.length} registro(s) en total.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;margin-bottom:20px;">
      <thead><tr><th style="text-align:left;padding:6px 12px;background-color:#f3f4f6;">Status</th><th style="text-align:left;padding:6px 12px;background-color:#f3f4f6;">Cantidad</th></tr></thead>
      <tbody>${summaryHtml}</tbody>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead><tr><th style="text-align:left;padding:6px 12px;background-color:#f3f4f6;">Pedimento</th><th style="text-align:left;padding:6px 12px;background-color:#f3f4f6;">Status</th><th style="text-align:left;padding:6px 12px;background-color:#f3f4f6;">Fecha de cruce</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;

  return {
    subject: `Status general — ${rows.length} registro(s)`,
    html: renderEmailShell({ title: "Reporte de status general", bodyHtml }),
  };
}
```

- [ ] **Step 6: Correr las pruebas y verificar que pasan**

Run: `node --test services/emailTemplates/notifications`
Expected: PASS (6 pruebas en total).

- [ ] **Step 7: Commit**

```bash
git add services/emailTemplates/notifications
git commit -m "feat: add status-change and general-digest email templates"
```

---

### Task 4: Repositorio de contactos de notificación (Firestore)

**Files:**
- Create: `services/notificationContactsRepo.js`
- Test: `services/notificationContactsRepo.test.js`

**Interfaces:**
- Consumes: `getDb()` de `services/firebaseAdmin.js:29-35`.
- Produces: `validateContactInput(input, {partial?})`, CRUD público con allowlist y `updateContactDeliveryState(id, patch)` reservado al dispatcher. `NotificationContact` es:
  ```
  {
    id: string,
    name: string,
    email: string,
    statusChangeEnabled: boolean,
    statusChangeMorningTime: string,   // "HH:mm"
    statusChangeNightTime: string,     // "HH:mm"
    lastStatusChangeSentAt: string|null,
    generalDigestEnabled: boolean,
    generalDigestFrequency: "twice_daily"|"daily"|"weekly",
    generalDigestMorningTime: string,  // "HH:mm"
    generalDigestNightTime: string,    // "HH:mm", solo usado si frequency==="twice_daily"
    generalDigestWeekday: number,      // 0-6, solo usado si frequency==="weekly"
    lastGeneralDigestSentAt: string|null,
    createdAt: string,
  }
  ```
  Usado por `services/notificationDispatcher.js` (Task 6) y por las rutas de la Task 8/9.

La validación pura se prueba con `node:test`; Firestore se verifica manualmente cuando existan las rutas.

- [ ] **Step 1: Escribir la prueba de validación**

```js
// services/notificationContactsRepo.test.js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateContactInput } from "./notificationContactsRepo.js";

describe("validateContactInput", () => {
  test("normaliza los campos editables", () => {
    const value = validateContactInput({ name: " Ana ", email: "ana@example.com", statusChangeEnabled: true });
    assert.equal(value.name, "Ana");
    assert.equal(value.email, "ana@example.com");
  });

  test("rechaza horarios inválidos y campos internos", () => {
    assert.throws(() => validateContactInput({ name: "Ana", email: "ana@example.com", statusChangeMorningTime: "25:00" }));
    assert.throws(() => validateContactInput({ name: "Ana", email: "ana@example.com", lastStatusChangeSentAt: "2026-01-01" }));
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `node --test services/notificationContactsRepo.test.js`
Expected: FAIL — el módulo todavía no existe.

- [ ] **Step 3: Implementar `services/notificationContactsRepo.js`**

```js
// services/notificationContactsRepo.js
import { getDb } from "./firebaseAdmin.js";

const COLLECTION = "notificationContacts";

const DEFAULT_CONTACT = {
  name: "",
  email: "",
  statusChangeEnabled: false,
  statusChangeMorningTime: "08:00",
  statusChangeNightTime: "20:00",
  lastStatusChangeSentAt: null,
  generalDigestEnabled: false,
  generalDigestFrequency: "daily",
  generalDigestMorningTime: "08:00",
  generalDigestNightTime: "20:00",
  generalDigestWeekday: 1,
  lastGeneralDigestSentAt: null,
};

const EDITABLE_FIELDS = new Set([
  "name", "email", "statusChangeEnabled", "statusChangeMorningTime", "statusChangeNightTime",
  "generalDigestEnabled", "generalDigestFrequency", "generalDigestMorningTime",
  "generalDigestNightTime", "generalDigestWeekday",
]);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const FREQUENCIES = new Set(["twice_daily", "daily", "weekly"]);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

export function validateContactInput(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Body inválido");
  const value = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!EDITABLE_FIELDS.has(key)) invalid(`Campo no permitido: ${key}`);
    if (key === "name") {
      if (typeof raw !== "string" || !raw.trim() || raw.trim().length > 100) invalid("Nombre inválido");
      value.name = raw.trim();
    } else if (key === "email") {
      if (typeof raw !== "string" || raw.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) invalid("Email inválido");
      value.email = raw;
    } else if (key.endsWith("Enabled")) {
      if (typeof raw !== "boolean") invalid(`${key} debe ser boolean`);
      value[key] = raw;
    } else if (key.endsWith("Time")) {
      if (typeof raw !== "string" || !TIME.test(raw)) invalid(`${key} debe usar HH:mm`);
      value[key] = raw;
    } else if (key === "generalDigestFrequency") {
      if (!FREQUENCIES.has(raw)) invalid("Frecuencia inválida");
      value[key] = raw;
    } else if (key === "generalDigestWeekday") {
      if (!Number.isInteger(raw) || raw < 0 || raw > 6) invalid("Día inválido");
      value[key] = raw;
    }
  }
  if (!partial && (!value.name || !value.email)) invalid("Nombre y email son requeridos");
  if (partial && Object.keys(value).length === 0) invalid("No hay campos para actualizar");
  return value;
}

function docToContact(doc) {
  const data = doc.data();
  return { ...DEFAULT_CONTACT, ...data, id: doc.id };
}

export async function listContacts() {
  const snapshot = await getDb().collection(COLLECTION).orderBy("createdAt", "asc").get();
  return snapshot.docs.map(docToContact);
}

export async function createContact(input) {
  const ref = getDb().collection(COLLECTION).doc();
  const doc = {
    ...DEFAULT_CONTACT,
    ...validateContactInput(input),
    createdAt: new Date().toISOString(),
  };
  await ref.set(doc);
  const snapshot = await ref.get();
  return docToContact(snapshot);
}

export async function updateContact(id, patch) {
  const ref = getDb().collection(COLLECTION).doc(id);
  if (!(await ref.get()).exists) {
    const error = new Error("Contacto no encontrado");
    error.status = 404;
    throw error;
  }
  await ref.update(validateContactInput(patch, { partial: true }));
  const snapshot = await ref.get();
  return docToContact(snapshot);
}

export async function updateContactDeliveryState(id, patch) {
  const allowed = new Set(["lastStatusChangeSentAt", "lastGeneralDigestSentAt"]);
  if (Object.keys(patch).some((key) => !allowed.has(key))) throw new Error("Cursor de entrega inválido");
  await getDb().collection(COLLECTION).doc(id).update(patch);
}

export async function deleteContact(id) {
  await getDb().collection(COLLECTION).doc(id).delete();
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `node --test services/notificationContactsRepo.test.js`
Expected: PASS (2 pruebas).

- [ ] **Step 5: Commit**

```bash
git add services/notificationContactsRepo.js services/notificationContactsRepo.test.js
git commit -m "feat: add Firestore repo for notification contacts"
```

---

### Task 5: Repositorio de eventos de cambio de status (Firestore)

**Files:**
- Create: `services/statusChangeEventsRepo.js`

**Interfaces:**
- Consumes: `getDb()` de `services/firebaseAdmin.js:29-35`.
- Produces: `listEventsBetween(afterIso: string|null, throughIso: string) => Promise<StatusChangeEvent[]>`. La escritura atómica del evento se hace junto con la fila en la Task 7.

- [ ] **Step 1: Implementar `services/statusChangeEventsRepo.js`**

```js
// services/statusChangeEventsRepo.js
import { getDb } from "./firebaseAdmin.js";

const COLLECTION = "statusChangeEvents";

function docToEvent(doc) {
  return { id: doc.id, ...doc.data() };
}

export async function listEventsBetween(afterIso, throughIso) {
  let query = getDb()
    .collection(COLLECTION)
    .where("detectedAt", "<=", throughIso);
  if (afterIso) {
    query = query.where("detectedAt", ">", afterIso);
  }
  const snapshot = await query.orderBy("detectedAt", "asc").get();
  return snapshot.docs.map(docToEvent);
}
```

- [ ] **Step 2: Commit**

```bash
git add services/statusChangeEventsRepo.js
git commit -m "feat: add Firestore repo for status-change events"
```

---

### Task 6: Motor de despacho de notificaciones

**Files:**
- Create: `services/notificationDispatcher.js`
- Test: `services/notificationDispatcher.test.js`

**Interfaces:**
- Consumes: repos de contactos/eventos/filas, `sendEmail`, `findDueSlot` y plantillas.
- Produces: `runNotificationDispatch({ now?, deps?, useLock? })`. `deps` y `useLock:false` existen sólo para la prueba; producción usa dependencias reales y un lease global de diez minutos.

- [ ] **Step 1: Escribir las pruebas del cursor**

```js
// services/notificationDispatcher.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runNotificationDispatch } from "./notificationDispatcher.js";

const contact = {
  id: "c1", name: "Ana", email: "ana@example.com",
  statusChangeEnabled: true, statusChangeMorningTime: "08:00", statusChangeNightTime: "20:00",
  lastStatusChangeSentAt: null, generalDigestEnabled: false,
};

test("un fallo SMTP no avanza el cursor", async () => {
  const updates = [];
  const deps = {
    listContacts: async () => [contact],
    listEventsBetween: async () => [{ rowId: "r1", previousStatus: "A", newStatus: "B", detectedAt: "2026-08-03T13:00:00Z" }],
    updateContactDeliveryState: async (...args) => updates.push(args),
    listRows: async () => [],
    sendEmail: async () => ({ success: false, message: "falló" }),
  };
  await runNotificationDispatch({ now: new Date("2026-08-03T14:30:00Z"), deps, useLock: false });
  assert.deepEqual(updates, []);
});

test("acota eventos al slot y avanza cursor tras éxito", async () => {
  const updates = [];
  let through;
  const deps = {
    listContacts: async () => [contact],
    listEventsBetween: async (_after, upper) => { through = upper; return []; },
    updateContactDeliveryState: async (...args) => updates.push(args),
    listRows: async () => [],
    sendEmail: async () => ({ success: true, message: "ok" }),
  };
  await runNotificationDispatch({ now: new Date("2026-08-03T14:30:00Z"), deps, useLock: false });
  assert.equal(through, "2026-08-03T14:00:00.000Z");
  assert.deepEqual(updates, [["c1", { lastStatusChangeSentAt: through }]]);
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `node --test services/notificationDispatcher.test.js`
Expected: FAIL — el dispatcher todavía no existe.

- [ ] **Step 3: Implementar `services/notificationDispatcher.js`**

```js
// services/notificationDispatcher.js
import { randomUUID } from "node:crypto";
import { getDb } from "./firebaseAdmin.js";
import { listContacts, updateContactDeliveryState } from "./notificationContactsRepo.js";
import { listEventsBetween } from "./statusChangeEventsRepo.js";
import { listRows } from "./sheetRowsRepo.js";
import { sendEmail } from "./emailService.js";
import { findDueSlot } from "./notificationSchedule.js";
import { buildStatusChangeDigestEmail } from "./emailTemplates/notifications/statusChangeDigest.js";
import { buildGeneralStatusDigestEmail } from "./emailTemplates/notifications/generalStatusDigest.js";

const DEFAULT_DEPS = { listContacts, updateContactDeliveryState, listEventsBetween, listRows, sendEmail };
const LOCK_REF = () => getDb().collection("notificationRuntime").doc("dispatch");

async function acquireLock(now) {
  const owner = randomUUID();
  const acquired = await getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(LOCK_REF());
    if (snapshot.data()?.leaseUntil > now.toISOString()) return false;
    transaction.set(LOCK_REF(), { owner, leaseUntil: new Date(now.getTime() + 10 * 60_000).toISOString() });
    return true;
  });
  return acquired ? owner : null;
}

async function releaseLock(owner) {
  await getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(LOCK_REF());
    if (snapshot.data()?.owner === owner) transaction.set(LOCK_REF(), { owner: null, leaseUntil: null });
  });
}

export async function runNotificationDispatch({ now = new Date(), deps = DEFAULT_DEPS, useLock = true } = {}) {
  const owner = useLock ? await acquireLock(now) : "test";
  if (!owner) return { checked: 0, statusChangeSent: 0, generalDigestSent: 0, errors: [], skippedLocked: true };

  let contacts = [];
  const errors = [];
  let statusChangeSent = 0;
  let generalDigestSent = 0;
  let rowsPromise;

  try {
    contacts = await deps.listContacts();
    for (const contact of contacts) {
      if (contact.statusChangeEnabled) {
        const dueSlot = findDueSlot(
          { times: [contact.statusChangeMorningTime, contact.statusChangeNightTime] },
          contact.lastStatusChangeSentAt,
          now
        );
        if (dueSlot) {
          try {
            const events = await deps.listEventsBetween(contact.lastStatusChangeSentAt, dueSlot);
            if (events.length === 0) {
              await deps.updateContactDeliveryState(contact.id, { lastStatusChangeSentAt: dueSlot });
            } else {
              const { subject, html } = buildStatusChangeDigestEmail(events);
              const result = await deps.sendEmail({
                to: [{ email: contact.email, name: contact.name }], subject, html,
              });
              if (result.success) {
                statusChangeSent += 1;
                await deps.updateContactDeliveryState(contact.id, { lastStatusChangeSentAt: dueSlot });
              } else {
                errors.push({ contactId: contact.id, type: "statusChange", message: result.message });
              }
            }
          } catch (error) {
            errors.push({
              contactId: contact.id,
              type: "statusChange",
              message: error instanceof Error ? error.message : "Error desconocido",
            });
          }
        }
      }

      if (contact.generalDigestEnabled) {
        const times = contact.generalDigestFrequency === "twice_daily"
          ? [contact.generalDigestMorningTime, contact.generalDigestNightTime]
          : [contact.generalDigestMorningTime];
        const weekday = contact.generalDigestFrequency === "weekly" ? contact.generalDigestWeekday : null;
        const dueSlot = findDueSlot({ times, weekday }, contact.lastGeneralDigestSentAt, now);
        if (dueSlot) {
          try {
            rowsPromise ??= deps.listRows();
            const { subject, html } = buildGeneralStatusDigestEmail(await rowsPromise);
            const result = await deps.sendEmail({
              to: [{ email: contact.email, name: contact.name }], subject, html,
            });
            if (result.success) {
              generalDigestSent += 1;
              await deps.updateContactDeliveryState(contact.id, { lastGeneralDigestSentAt: dueSlot });
            } else {
              errors.push({ contactId: contact.id, type: "generalDigest", message: result.message });
            }
          } catch (error) {
            errors.push({
              contactId: contact.id,
              type: "generalDigest",
              message: error instanceof Error ? error.message : "Error desconocido",
            });
          }
        }
      }
    }
    return { checked: contacts.length, statusChangeSent, generalDigestSent, errors, skippedLocked: false };
  } finally {
    if (useLock) await releaseLock(owner);
  }
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `node --test services/notificationDispatcher.test.js`
Expected: PASS (2 pruebas).

- [ ] **Step 5: Commit**

```bash
git add services/notificationDispatcher.js services/notificationDispatcher.test.js
git commit -m "feat: add notification dispatch engine"
```

---

### Task 7: Detección de cambios de status en la reconciliación

**Files:**
- Modify: `services/sheetRowsRepo.js:56-72`
- Modify: `services/scrapeReconciliation.js:16-28`, `services/scrapeReconciliation.js:116-141`

**Interfaces:**
- Amplía `updateRow(id, patch, { statusChange? } = {})`; cuando hay `statusChange`, fila y evento se escriben en el mismo batch de Firestore.
- La reconciliación sigue siendo el único origen de eventos: una edición manual no simula un cambio detectado por el SAT.

- [ ] **Step 1: Hacer atómica la actualización de fila y evento**

En `services/sheetRowsRepo.js`, reemplazar `updateRow`:

```js
export async function updateRow(id, patch, { statusChange } = {}) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const update = {};
  if (patch.values) {
    for (const [key, value] of Object.entries(patch.values)) update[`values.${key}`] = value;
  }
  if ("detalle" in patch) update.detalle = patch.detalle;
  if ("scrapeError" in patch) update.scrapeError = patch.scrapeError;
  if ("addedFromScrape" in patch) update.addedFromScrape = patch.addedFromScrape;
  if (patch.markScraped) update.lastScrapedAt = FieldValue.serverTimestamp();

  if (statusChange) {
    const batch = db.batch();
    const eventRef = db.collection("statusChangeEvents").doc();
    batch.update(ref, update);
    batch.set(eventRef, { ...statusChange, rowId: id, detectedAt: new Date().toISOString() });
    await batch.commit();
  } else {
    await ref.update(update);
  }
  return docToRow(await ref.get());
}
```

- [ ] **Step 2: Agregar el helper puro a la reconciliación**

```js
function statusChangeFor(row, newStatus) {
  const previousStatus = row.values.status ?? "";
  return newStatus && newStatus !== previousStatus ? { previousStatus, newStatus } : undefined;
}
```

- [ ] **Step 3: Pasar el cambio al update con secuencia**

Reemplazar (líneas 116-123):

```js
        const [match] = remaining.splice(matchIndex, 1);
        const updated = await updateRow(row.id, {
          ...toScrapePatch(match),
          scrapeError: null,
        });
        updatedRows.push(updated);
        scraped += 1;
```

por:

```js
        const [match] = remaining.splice(matchIndex, 1);
        const updated = await updateRow(row.id, {
          ...toScrapePatch(match),
          scrapeError: null,
        }, { statusChange: statusChangeFor(row, match.estado) });
        updatedRows.push(updated);
        scraped += 1;
```

- [ ] **Step 4: Pasar el cambio al update sin secuencia y calcular el patch una vez**

Reemplazar (líneas 125-141):

```js
      for (const row of rowsWithoutSecuencia) {
        const match = remaining.shift();
        if (!match) {
          const updated = await updateRow(row.id, {
            scrapeError: "No hay más secuencias disponibles en el SAT para esta fila",
          });
          updatedRows.push(updated);
          continue;
        }
        const updated = await updateRow(row.id, {
          ...toScrapePatch(match),
          values: { ...toScrapePatch(match).values, secuencia: match.secuencia },
          scrapeError: null,
        });
        updatedRows.push(updated);
        scraped += 1;
      }
```

por:

```js
      for (const row of rowsWithoutSecuencia) {
        const match = remaining.shift();
        if (!match) {
          const updated = await updateRow(row.id, {
            scrapeError: "No hay más secuencias disponibles en el SAT para esta fila",
          });
          updatedRows.push(updated);
          continue;
        }
        const patch = toScrapePatch(match);
        const updated = await updateRow(row.id, {
          ...patch,
          values: { ...patch.values, secuencia: match.secuencia },
          scrapeError: null,
        }, { statusChange: statusChangeFor(row, match.estado) });
        updatedRows.push(updated);
        scraped += 1;
      }
```

No se toca el camino de filas nuevas (`for (const match of remaining)`, línea 143 en adelante) porque una fila recién creada no tiene "status anterior" que comparar.

- [ ] **Step 5: Verificación manual**

Provocar un cambio real y confirmar que la fila y su evento aparecen juntos. Forzar temporalmente un fallo del batch y confirmar que no se escribe ninguno de los dos documentos.

- [ ] **Step 6: Commit**

```bash
git add services/sheetRowsRepo.js services/scrapeReconciliation.js
git commit -m "feat: record status-change events during scrape reconciliation"
```

---

### Task 8: Rutas de Express (desarrollo local)

**Files:**
- Create: `proxy-server/routes/auth.js`
- Create: `proxy-server/routes/notificationContacts.js`
- Create: `proxy-server/routes/notificationDispatch.js`
- Modify: `proxy-server/index.js:1-13`

**Interfaces:**
- Produces: `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout`; CRUD protegido de contactos; dispatch protegido por `CRON_SECRET`.

- [ ] **Step 1: Implementar `proxy-server/routes/auth.js`**

```js
import express from "express";
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  hasValidAdminSession,
  verifyAdminPassword,
} from "../../services/adminSession.js";

const router = express.Router();

router.post("/login", (req, res) => {
  if (!verifyAdminPassword(req.body?.password)) return res.status(401).json({ error: "Clave incorrecta" });
  res.setHeader("Set-Cookie", createAdminSessionCookie());
  return res.json({ authenticated: true });
});
router.get("/session", (req, res) => res.json({ authenticated: hasValidAdminSession(req) }));
router.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearAdminSessionCookie());
  return res.json({ authenticated: false });
});

export default router;
```

- [ ] **Step 2: Implementar `proxy-server/routes/notificationContacts.js`**

```js
// proxy-server/routes/notificationContacts.js
import express from "express";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "../../services/notificationContactsRepo.js";

const router = express.Router();

router.get("/contacts", async (_req, res) => {
  try {
    const contacts = await listContacts();
    res.json(contacts);
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const contact = await createContact(req.body ?? {});
    res.status(201).json(contact);
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.patch("/contacts/:id", async (req, res) => {
  try {
    const contact = await updateContact(req.params.id, req.body ?? {});
    res.json(contact);
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    await deleteContact(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

export default router;
```

- [ ] **Step 3: Implementar `proxy-server/routes/notificationDispatch.js`**

```js
// proxy-server/routes/notificationDispatch.js
import express from "express";
import { runNotificationDispatch } from "../../services/notificationDispatcher.js";

const router = express.Router();

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // null = "no configurado" (distinto de "no autorizado")
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return token === secret;
}

async function handleDispatch(req, res) {
  const authorized = isAuthorized(req);
  if (authorized === null) {
    return res.status(500).json({ error: "CRON_SECRET no está configurado en el servidor" });
  }
  if (!authorized) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const startedAt = Date.now();
  try {
    const summary = await runNotificationDispatch();
    res.json({ success: true, durationMs: Date.now() - startedAt, ...summary });
  } catch (error) {
    res.status(500).json({
      success: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Error en el servidor",
    });
  }
}

router.get("/", handleDispatch);
router.post("/", handleDispatch);

export default router;
```

- [ ] **Step 4: Wiring y protección en `proxy-server/index.js`**

Reemplazar el archivo completo:

```js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cepRoutes from "./routes/cep.js";
import sheetRoutes from "./routes/sheet.js";
import autoScrapeRoutes from "./routes/autoScrape.js";
import authRoutes from "./routes/auth.js";
import notificationContactsRoutes from "./routes/notificationContacts.js";
import notificationDispatchRoutes from "./routes/notificationDispatch.js";
import { hasValidAdminSession } from "../services/adminSession.js";

function requireAdmin(req, res, next) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  next();
}

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/sat/auto-scrape", autoScrapeRoutes);
app.use("/api/notifications/dispatch", notificationDispatchRoutes);
app.use("/api/cep", requireAdmin, cepRoutes);
app.use("/api/sheet", requireAdmin, sheetRoutes);
app.use("/api/notifications", requireAdmin, notificationContactsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy SAT corriendo en :${PORT}`));
```

- [ ] **Step 5: Verificación manual**

Primero iniciar sesión y guardar la cookie; después usarla para el CRUD:

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"<ADMIN_PASSWORD>"}'

curl -b cookies.txt -X POST http://localhost:3001/api/notifications/contacts \
  -H "Content-Type: application/json" \
  -d '{"name":"Prueba","email":"tu-email@example.com","statusChangeEnabled":true,"generalDigestEnabled":true,"generalDigestFrequency":"daily"}'

curl -b cookies.txt http://localhost:3001/api/notifications/contacts

curl -X POST http://localhost:3001/api/notifications/dispatch \
  -H "Authorization: Bearer <valor de CRON_SECRET>"
```

Expected: el primer `curl` devuelve `201` con el contacto creado; el segundo lista el contacto; el tercero devuelve `{ success: true, checked: 1, ... }` — si el horario configurado ya pasó respecto a la hora actual en CDMX, debe llegar el correo de digest general al buzón de prueba.

- [ ] **Step 6: Commit**

```bash
git add proxy-server/routes/auth.js proxy-server/routes/notificationContacts.js proxy-server/routes/notificationDispatch.js proxy-server/index.js
git commit -m "feat: add Express routes for notification contacts and dispatch"
```

---

### Task 9: Funciones de Vercel (producción) + cron

**Files:**
- Create: `api/auth/[action].js`
- Create: `api/notifications/contacts.js`
- Create: `api/notifications/contacts/[id].js`
- Create: `api/notifications/dispatch.js`
- Modify: `api/cep/consultar.js`, `api/sheet/rows.js`, `api/sheet/rows/[id].js`, `api/sheet/scrape-all.js`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: lo mismo que la Task 8, pero re-exportado como handlers de Vercel (mismo patrón que `api/sheet/rows.js`, `api/sheet/rows/[id].js`, `api/sat/auto-scrape.js`).

- [ ] **Step 1: Implementar `api/auth/[action].js`**

```js
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  hasValidAdminSession,
  verifyAdminPassword,
} from "../../services/adminSession.js";

export default function handler(req, res) {
  const { action } = req.query;
  if (action === "login" && req.method === "POST") {
    if (!verifyAdminPassword(req.body?.password)) return res.status(401).json({ error: "Clave incorrecta" });
    res.setHeader("Set-Cookie", createAdminSessionCookie());
    return res.json({ authenticated: true });
  }
  if (action === "session" && req.method === "GET") {
    return res.json({ authenticated: hasValidAdminSession(req) });
  }
  if (action === "logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", clearAdminSessionCookie());
    return res.json({ authenticated: false });
  }
  return res.status(405).json({ error: "Método no permitido" });
}
```

- [ ] **Step 2: Implementar `api/notifications/contacts.js`**

```js
// api/notifications/contacts.js
import { createContact, listContacts } from "../../services/notificationContactsRepo.js";
import { hasValidAdminSession } from "../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  try {
    if (req.method === "GET") {
      const contacts = await listContacts();
      return res.json(contacts);
    }
    if (req.method === "POST") {
      const contact = await createContact(req.body ?? {});
      return res.status(201).json(contact);
    }
    res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
}
```

- [ ] **Step 3: Implementar `api/notifications/contacts/[id].js`**

```js
// api/notifications/contacts/[id].js
import { deleteContact, updateContact } from "../../../services/notificationContactsRepo.js";
import { hasValidAdminSession } from "../../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  const { id } = req.query;
  try {
    if (req.method === "PATCH") {
      const contact = await updateContact(id, req.body ?? {});
      return res.json(contact);
    }
    if (req.method === "DELETE") {
      await deleteContact(id);
      return res.status(204).end();
    }
    res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
}
```

- [ ] **Step 4: Implementar `api/notifications/dispatch.js`**

```js
// api/notifications/dispatch.js
import { runNotificationDispatch } from "../../services/notificationDispatcher.js";

export const config = { maxDuration: 300 };

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return token === secret;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const authorized = isAuthorized(req);
  if (authorized === null) {
    return res.status(500).json({ error: "CRON_SECRET no está configurado en el servidor" });
  }
  if (!authorized) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const startedAt = Date.now();
  try {
    const summary = await runNotificationDispatch();
    res.json({ success: true, durationMs: Date.now() - startedAt, ...summary });
  } catch (error) {
    res.status(500).json({
      success: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Error en el servidor",
    });
  }
}
```

- [ ] **Step 5: Proteger las funciones de datos existentes**

Agregar `import { hasValidAdminSession } from "../../services/adminSession.js";` en `api/cep/consultar.js`, `api/sheet/rows.js` y `api/sheet/scrape-all.js`. En `api/sheet/rows/[id].js` usar `../../../services/adminSession.js`. Colocar como primera línea de cada handler:

```js
if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
```

`api/sat/auto-scrape.js` no usa cookie: conserva exclusivamente `CRON_SECRET`.

- [ ] **Step 6: Agregar el cron en `vercel.json`**

Reemplazar el archivo completo:

```json
{
  "crons": [
    { "path": "/api/sat/auto-scrape", "schedule": "0 */2 * * *" },
    { "path": "/api/notifications/dispatch", "schedule": "*/15 * * * *" }
  ],
  "functions": {
    "api/sat/auto-scrape.js": { "maxDuration": 300 },
    "api/notifications/dispatch.js": { "maxDuration": 300 }
  }
}
```

> **Nota:** `*/15` requiere Vercel Pro o Enterprise. Hobby sólo permite una ejecución diaria, por lo que `*/30` tampoco es fallback válido. Confirmar el plan antes del despliegue; si es Hobby, cambiar el producto a horarios diarios o mover el cron a otro proveedor.

- [ ] **Step 7: Commit**

```bash
git add api/auth api/notifications api/cep/consultar.js api/sheet vercel.json
git commit -m "feat: add Vercel functions and cron for notification dispatch"
```

---

### Task 10: Tipos y cliente API del frontend

**Files:**
- Create: `src/types/notifications.ts`
- Create: `src/api/notificationsApi.ts`
- Create: `src/api/authApi.ts`

**Interfaces:**
- Produces: tipos de contactos, CRUD y `login`, `getSession`, `logout`.

- [ ] **Step 1: Implementar `src/types/notifications.ts`**

```ts
export type GeneralDigestFrequency = "twice_daily" | "daily" | "weekly";

export interface NotificationContact {
  id: string;
  name: string;
  email: string;
  statusChangeEnabled: boolean;
  statusChangeMorningTime: string;
  statusChangeNightTime: string;
  lastStatusChangeSentAt: string | null;
  generalDigestEnabled: boolean;
  generalDigestFrequency: GeneralDigestFrequency;
  generalDigestMorningTime: string;
  generalDigestNightTime: string;
  generalDigestWeekday: number;
  lastGeneralDigestSentAt: string | null;
}

export type NotificationContactInput = Omit<
  NotificationContact,
  "id" | "lastStatusChangeSentAt" | "lastGeneralDigestSentAt"
>;
```

- [ ] **Step 2: Implementar `src/api/notificationsApi.ts`**

```ts
import axios from "axios";
import type { NotificationContact, NotificationContactInput } from "../types/notifications";

const BASE_URL = "/api/notifications";

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "error" in data) {
      return String((data as { error: unknown }).error);
    }
    if (error.request && !error.response) {
      return "No se pudo conectar al servidor. ¿Está ejecutando npm run dev?";
    }
  }
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function listContacts(): Promise<NotificationContact[]> {
  try {
    const response = await axios.get<NotificationContact[]>(`${BASE_URL}/contacts`);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function createContact(input: NotificationContactInput): Promise<NotificationContact> {
  try {
    const response = await axios.post<NotificationContact>(`${BASE_URL}/contacts`, input);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function updateContact(
  id: string,
  patch: Partial<NotificationContactInput>
): Promise<NotificationContact> {
  try {
    const response = await axios.patch<NotificationContact>(`${BASE_URL}/contacts/${id}`, patch);
    return response.data;
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}

export async function deleteContact(id: string): Promise<void> {
  try {
    await axios.delete(`${BASE_URL}/contacts/${id}`);
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}
```

- [ ] **Step 3: Implementar `src/api/authApi.ts`**

```ts
import axios from "axios";

export async function login(password: string): Promise<void> {
  await axios.post("/api/auth/login", { password });
}

export async function getSession(): Promise<boolean> {
  const { data } = await axios.get<{ authenticated: boolean }>("/api/auth/session");
  return data.authenticated;
}

export async function logout(): Promise<void> {
  await axios.post("/api/auth/logout");
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/notifications.ts src/api/notificationsApi.ts src/api/authApi.ts
git commit -m "feat: add frontend types and API client for notification contacts"
```

---

### Task 11: UI de configuración de contactos

**Files:**
- Create: `src/components/NotificationContactForm.tsx`
- Create: `src/components/NotificationContactList.tsx`
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/NotificationSettingsPage.tsx`
- Modify: `src/App.tsx:1-27`

**Interfaces:**
- Consumes: `NotificationContact`, `NotificationContactInput` de `src/types/notifications.ts`; `listContacts, createContact, updateContact, deleteContact` de `src/api/notificationsApi.ts` (Task 10); `Button`, `Input`, `Label`, `Card`/`CardHeader`/`CardTitle`/`CardContent` de `src/components/ui/*`.
- Produces: página en la ruta `/notificaciones`.

- [ ] **Step 1: Implementar `src/components/NotificationContactForm.tsx`**

```tsx
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { NotificationContactInput, GeneralDigestFrequency } from "../types/notifications";

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

const DEFAULT_INPUT: NotificationContactInput = {
  name: "",
  email: "",
  statusChangeEnabled: false,
  statusChangeMorningTime: "08:00",
  statusChangeNightTime: "20:00",
  generalDigestEnabled: false,
  generalDigestFrequency: "daily",
  generalDigestMorningTime: "08:00",
  generalDigestNightTime: "20:00",
  generalDigestWeekday: 1,
};

function editableFields(value: NotificationContactInput): NotificationContactInput {
  return {
    name: value.name,
    email: value.email,
    statusChangeEnabled: value.statusChangeEnabled,
    statusChangeMorningTime: value.statusChangeMorningTime,
    statusChangeNightTime: value.statusChangeNightTime,
    generalDigestEnabled: value.generalDigestEnabled,
    generalDigestFrequency: value.generalDigestFrequency,
    generalDigestMorningTime: value.generalDigestMorningTime,
    generalDigestNightTime: value.generalDigestNightTime,
    generalDigestWeekday: value.generalDigestWeekday,
  };
}

interface NotificationContactFormProps {
  initialValue?: NotificationContactInput;
  onSubmit: (value: NotificationContactInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function NotificationContactForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = "Guardar contacto",
}: NotificationContactFormProps) {
  const [value, setValue] = useState<NotificationContactInput>(() =>
    initialValue ? editableFields(initialValue) : DEFAULT_INPUT
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof NotificationContactInput>(key: K, next: NotificationContactInput[K]) {
    setValue((prev) => ({ ...prev, [key]: next }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="contact-name">Nombre</Label>
          <Input id="contact-name" value={value.name} onChange={(e) => update("name", e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={value.email}
            onChange={(e) => update("email", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={value.statusChangeEnabled}
            onChange={(e) => update("statusChangeEnabled", e.target.checked)}
          />
          Avisar cuando cambie el status de un registro
        </label>
        {value.statusChangeEnabled && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <Label htmlFor="status-morning">Resumen de la mañana</Label>
              <Input
                id="status-morning"
                type="time"
                value={value.statusChangeMorningTime}
                onChange={(e) => update("statusChangeMorningTime", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="status-night">Resumen de la noche</Label>
              <Input
                id="status-night"
                type="time"
                value={value.statusChangeNightTime}
                onChange={(e) => update("statusChangeNightTime", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={value.generalDigestEnabled}
            onChange={(e) => update("generalDigestEnabled", e.target.checked)}
          />
          Enviar digest de status general
        </label>
        {value.generalDigestEnabled && (
          <div className="space-y-3 pl-6">
            <div>
              <Label htmlFor="digest-frequency">Frecuencia</Label>
              <select
                id="digest-frequency"
                className="block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={value.generalDigestFrequency}
                onChange={(e) => update("generalDigestFrequency", e.target.value as GeneralDigestFrequency)}
              >
                <option value="twice_daily">Dos veces al día</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>

            {value.generalDigestFrequency === "weekly" && (
              <div>
                <Label htmlFor="digest-weekday">Día de la semana</Label>
                <select
                  id="digest-weekday"
                  className="block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={value.generalDigestWeekday}
                  onChange={(e) => update("generalDigestWeekday", Number(e.target.value))}
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="digest-morning">
                  {value.generalDigestFrequency === "weekly" ? "Hora de envío" : "Hora (mañana)"}
                </Label>
                <Input
                  id="digest-morning"
                  type="time"
                  value={value.generalDigestMorningTime}
                  onChange={(e) => update("generalDigestMorningTime", e.target.value)}
                />
              </div>
              {value.generalDigestFrequency === "twice_daily" && (
                <div>
                  <Label htmlFor="digest-night">Hora (noche)</Label>
                  <Input
                    id="digest-night"
                    type="time"
                    value={value.generalDigestNightTime}
                    onChange={(e) => update("generalDigestNightTime", e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Implementar `src/components/NotificationContactList.tsx`**

```tsx
import { useState } from "react";
import { Button } from "./ui/button";
import { NotificationContactForm } from "./NotificationContactForm";
import type { NotificationContact, NotificationContactInput } from "../types/notifications";

interface NotificationContactListProps {
  contacts: NotificationContact[];
  onUpdate: (id: string, patch: NotificationContactInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function NotificationContactList({ contacts, onUpdate, onDelete }: NotificationContactListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (contacts.length === 0) {
    return <p className="text-muted-foreground text-sm">Todavía no hay contactos configurados.</p>;
  }

  return (
    <ul className="space-y-3">
      {contacts.map((contact) => (
        <li key={contact.id} className="border rounded-md p-3">
          {editingId === contact.id ? (
            <NotificationContactForm
              initialValue={contact}
              submitLabel="Guardar cambios"
              onCancel={() => setEditingId(null)}
              onSubmit={async (value) => {
                await onUpdate(contact.id, value);
                setEditingId(null);
              }}
            />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {contact.name} <span className="text-muted-foreground">({contact.email})</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {contact.statusChangeEnabled
                    ? `Cambios de status: ${contact.statusChangeMorningTime} y ${contact.statusChangeNightTime}`
                    : "Cambios de status: desactivado"}
                  {" · "}
                  {contact.generalDigestEnabled
                    ? `Digest general: ${contact.generalDigestFrequency}`
                    : "Digest general: desactivado"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(contact.id)}>
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(contact.id)}>
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Implementar `src/pages/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { login } from "../api/authApi";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(password);
      onLogin();
    } catch {
      setError("Clave incorrecta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Acceso</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="password">Clave</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Implementar `src/pages/NotificationSettingsPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { NotificationContactForm } from "../components/NotificationContactForm";
import { NotificationContactList } from "../components/NotificationContactList";
import * as notificationsApi from "../api/notificationsApi";
import type { NotificationContact, NotificationContactInput } from "../types/notifications";

export function NotificationSettingsPage() {
  const [contacts, setContacts] = useState<NotificationContact[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setContacts(await notificationsApi.listContacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(value: NotificationContactInput) {
    try {
      setError(null);
      await notificationsApi.createContact(value);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      throw err;
    }
  }

  async function handleUpdate(id: string, patch: NotificationContactInput) {
    try {
      setError(null);
      await notificationsApi.updateContact(id, patch);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      throw err;
    }
  }

  async function handleDelete(id: string) {
    try {
      setError(null);
      await notificationsApi.deleteContact(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Notificaciones por correo</h1>
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Contactos existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationContactList contacts={contacts} onUpdate={handleUpdate} onDelete={handleDelete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationContactForm onSubmit={handleCreate} submitLabel="Agregar contacto" />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Guard de sesión, ruta y navegación en `src/App.tsx`**

Reemplazar el archivo completo:

```tsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { ConsultaPage } from "./pages/ConsultaPage";
import { DetallePage } from "./pages/DetallePage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationSettingsPage } from "./pages/NotificationSettingsPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button } from "./components/ui/button";
import { useSheetStore } from "./store/useSheetStore";
import { getSession, logout } from "./api/authApi";

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const loadRows = useSheetStore((state) => state.loadRows);
  useEffect(() => { void loadRows(); }, [loadRows]);

  return (
    <BrowserRouter>
      <nav className="border-b bg-white px-4 py-2 flex items-center gap-4 text-sm">
        <Link to="/" className="font-medium hover:underline">Pedimentos</Link>
        <Link to="/notificaciones" className="font-medium hover:underline">Notificaciones</Link>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onLogout}>Salir</Button>
      </nav>
      <Routes>
        <Route path="/" element={<ConsultaPage />} />
        <Route path="/detalle/:id" element={<DetallePage />} />
        <Route path="/notificaciones" element={<NotificationSettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => { void getSession().then(setAuthenticated).catch(() => setAuthenticated(false)); }, []);

  if (authenticated === null) return <p className="p-6">Cargando...</p>;
  if (!authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;
  return (
    <ErrorBoundary>
      <AuthenticatedApp onLogout={() => { void logout().finally(() => setAuthenticated(false)); }} />
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 6: Verificación manual en el navegador**

Correr `npm run dev`, abrir `http://localhost:5173` y verificar:
1. Una clave incorrecta muestra error; la correcta abre la aplicación; recargar conserva la sesión y "Salir" la elimina.
2. Sin cookie, `/api/sheet/rows` y `/api/notifications/contacts` responden `401`; los crons siguen aceptando sólo `CRON_SECRET`.
3. La página de notificaciones carga sin contactos (`"Todavía no hay contactos configurados."`).
4. Crear, editar y eliminar un contacto funciona; editar no envía ni sobrescribe cursores internos.
5. Las frecuencias semanal y dos veces al día muestran los campos correctos.

- [ ] **Step 7: Commit**

```bash
git add src/components/NotificationContactForm.tsx src/components/NotificationContactList.tsx src/pages/LoginPage.tsx src/pages/NotificationSettingsPage.tsx src/App.tsx
git commit -m "feat: add notification settings UI and route"
```

---

## Verificación de extremo a extremo (post-implementación)

Una vez completadas todas las tasks:

1. `npm test` — corre autenticación, correo, horarios, plantillas, validación y dispatcher.
2. `npm run dev` — levanta frontend + proxy Express.
3. Copiar `.env.example` a `.env` y configurar Firebase, una `ADMIN_PASSWORD` de al menos 16 caracteres, `CRON_SECRET`, `SMTP2GO_API_KEY` y `EMAIL_FROM`.
4. Confirmar que sin sesión las APIs de datos responden `401`; iniciar sesión y crear un contacto con horarios ya pasados respecto a CDMX.
5. Disparar manualmente `curl -X POST http://localhost:3001/api/notifications/dispatch -H "Authorization: Bearer <CRON_SECRET>"` y confirmar que llega el correo de digest general (con 0 cambios de status si no se ha hecho ningún scrape todavía).
6. Editar manualmente en Firestore el campo `values.status` de una fila existente en la colección `rows` a un valor distinto, luego correr "Actualizar todo" en la UI (o `POST /api/sheet/scrape-all`) apuntando a un pedimento real del SAT para que la reconciliación detecte el cambio real y cree un `statusChangeEvent`; volver a disparar el dispatch y confirmar que llega el correo de resumen de cambios de status.
7. Simular un fallo SMTP y confirmar que el cursor no avanza; repetir el dispatch después de restaurar smtp2go y confirmar el envío.
8. Antes de desplegar, confirmar Vercel Pro/Enterprise para `*/15`; Hobby requiere un cron externo o reducir el producto a una ejecución diaria.

---

## Self-Review

**1. Cobertura del spec:**
- Login público con una clave compartida → Task 0, Tasks 8-11 (cookie firmada, handlers y UI).
- Copiar el servicio de correo de border-flow → Task 1 (puerto directo de `emailService.ts`).
- Correo al cambiar status, a un contacto configurable → Tasks 4, 5, 7, 11 (contactos, eventos, detección, UI).
- Frecuencia elegible (mañana/noche configurables) para el aviso de cambio de status → Tasks 2, 6, 11 (horario mañana/noche por contacto).
- Lista de varios contactos (decisión confirmada por el usuario) → Task 4 (colección, no doc único), Task 11 (lista con edición/borrado).
- Digest de "status general" programable, con frecuencia configurable por contacto (dos veces al día / diario / semanal, decisión confirmada) → Tasks 2, 3, 6, 11.
- Cron de despacho protegido igual que el cron existente → Tasks 8, 9.
- Fallos, duplicados y solapamiento → Tasks 5-7 (ventana acotada, cursores sólo tras éxito, batch atómico y lease global).
- Validación de contactos y protección de campos internos → Task 4 y Task 11.

**2. Placeholders:** revisado — no quedan "TODO"/"implementar después"; cada step tiene código completo.

**3. Consistencia de tipos:** `NotificationContact` (Task 4, backend) y `NotificationContact`/`NotificationContactInput` (Task 10, frontend) tienen los mismos nombres de campo (`statusChangeEnabled`, `statusChangeMorningTime`, `statusChangeNightTime`, `generalDigestEnabled`, `generalDigestFrequency`, `generalDigestMorningTime`, `generalDigestNightTime`, `generalDigestWeekday`, `lastStatusChangeSentAt`, `lastGeneralDigestSentAt`) — verificado consistente entre Task 4, Task 6, Task 10 y Task 11. `findDueSlot` (Task 2) se invoca con la misma forma `{ times, weekday }` tanto en sus propias pruebas como en `notificationDispatcher.js` (Task 6).
