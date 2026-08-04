// services/statusChangeNotifier.js
import { listContacts } from "./notificationContactsRepo.js";
import { sendEmail } from "./emailService.js";
import { buildStatusChangeEmail } from "./emailTemplates/notifications/statusChange.js";

const DEFAULT_DEPS = { listContacts, sendEmail };

/**
 * Envía un correo inmediato por cada cambio de status detectado durante el
 * scraping automático, a cada contacto que tenga `statusChangeEnabled`.
 * No tiene horario: es un evento que se dispara al detectar el cambio.
 *
 * @param {Array<{previousStatus:string,newStatus:string,row:object}>} statusChanges
 */
export async function notifyStatusChanges(statusChanges, { deps = DEFAULT_DEPS } = {}) {
  if (!statusChanges || statusChanges.length === 0) return { sent: 0, errors: [] };

  const contacts = (await deps.listContacts()).filter((contact) => contact.statusChangeEnabled);
  if (contacts.length === 0) return { sent: 0, errors: [] };

  let sent = 0;
  const errors = [];

  for (const change of statusChanges) {
    const { subject, html } = buildStatusChangeEmail(change);
    for (const contact of contacts) {
      try {
        const result = await deps.sendEmail({
          to: [{ email: contact.email, name: contact.name }],
          subject,
          html,
        });
        if (result.success) {
          sent += 1;
        } else {
          errors.push({ contactId: contact.id, rowId: change.row?.id, message: result.message });
        }
      } catch (error) {
        errors.push({
          contactId: contact.id,
          rowId: change.row?.id,
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }
  }

  return { sent, errors };
}
