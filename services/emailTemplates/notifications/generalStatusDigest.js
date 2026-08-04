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
