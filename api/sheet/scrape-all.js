import { runScrapeAll } from "../../services/scrapeReconciliation.js";
import { hasValidAdminSession } from "../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const summary = await runScrapeAll({ onlyStaleOrOpen: false });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
}
