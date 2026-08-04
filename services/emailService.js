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
