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
