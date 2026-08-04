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
