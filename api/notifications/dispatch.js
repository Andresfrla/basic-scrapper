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
