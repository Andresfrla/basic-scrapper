// services/notificationDispatcher.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runNotificationDispatch } from "./notificationDispatcher.js";

// 08:00 CDMX (UTC-6) === 14:00 UTC
const contact = {
  id: "c1", name: "Ana", email: "ana@example.com",
  statusChangeEnabled: false,
  generalDigestEnabled: true, generalDigestFrequency: "daily",
  generalDigestMorningTime: "08:00", generalDigestNightTime: "20:00",
  generalDigestWeekday: 1, lastGeneralDigestSentAt: null,
};

test("un fallo SMTP no avanza el cursor del digest general", async () => {
  const updates = [];
  const deps = {
    listContacts: async () => [contact],
    updateContactDeliveryState: async (...args) => updates.push(args),
    listRows: async () => [],
    sendEmail: async () => ({ success: false, message: "falló" }),
  };
  await runNotificationDispatch({ now: new Date("2026-08-03T14:30:00Z"), deps, useLock: false });
  assert.deepEqual(updates, []);
});

test("avanza el cursor del digest general tras un envío exitoso", async () => {
  const updates = [];
  const deps = {
    listContacts: async () => [contact],
    updateContactDeliveryState: async (...args) => updates.push(args),
    listRows: async () => [],
    sendEmail: async () => ({ success: true, message: "ok" }),
  };
  await runNotificationDispatch({ now: new Date("2026-08-03T14:30:00Z"), deps, useLock: false });
  assert.deepEqual(updates, [["c1", { lastGeneralDigestSentAt: "2026-08-03T14:00:00.000Z" }]]);
});
