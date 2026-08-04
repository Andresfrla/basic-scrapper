// services/emailTemplates/notifications/statusChange.js
import { escapeHtml, renderEmailShell } from "./shared.js";

/**
 * Correo inmediato de un solo cambio de status detectado durante el scraping.
 * `change` = { previousStatus, newStatus, row } donde `row` es la fila actualizada.
 */
export function buildStatusChangeEmail({ previousStatus, newStatus, row } = {}) {
  const values = row?.values ?? {};
  const referencia = values.referencia || values.pedimento || row?.id || "(sin referencia)";

  const detailRow = (label, value) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(value || "—")}</td>
    </tr>`;

  const bodyHtml = `
    <p>El registro <strong>${escapeHtml(referencia)}</strong> cambió de status:</p>
    <p style="font-size:18px;margin:12px 0;">
      <span style="color:#6b7280;">${escapeHtml(previousStatus || "(sin status)")}</span>
      <span style="margin:0 8px;">&rarr;</span>
      <strong style="color:#111827;">${escapeHtml(newStatus)}</strong>
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;">
      <tbody>
        ${detailRow("Referencia", values.referencia)}
        ${detailRow("Pedimento", values.pedimento)}
        ${detailRow("Secuencia", values.secuencia)}
        ${detailRow("Caja", values.caja)}
      </tbody>
    </table>`;

  return {
    subject: `Cambio de status: ${referencia} → ${newStatus}`,
    html: renderEmailShell({ title: "Cambio de status detectado", bodyHtml }),
  };
}
