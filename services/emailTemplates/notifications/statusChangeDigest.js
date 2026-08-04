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
