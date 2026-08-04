import express from "express";
import { runScrapeAll } from "../../services/scrapeReconciliation.js";
import { notifyStatusChanges } from "../../services/statusChangeNotifier.js";

const router = express.Router();

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null; // null = "no configurado" (distinto de "no autorizado")
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return token === secret;
}

async function handleAutoScrape(req, res) {
  const authorized = isAuthorized(req);
  if (authorized === null) {
    return res.status(500).json({ error: "CRON_SECRET no está configurado en el servidor" });
  }
  if (!authorized) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const startedAt = Date.now();
  try {
    const summary = await runScrapeAll({ onlyStaleOrOpen: true });

    let notified = { sent: 0, errors: [] };
    try {
      notified = await notifyStatusChanges(summary.statusChanges);
    } catch (error) {
      notified = { sent: 0, errors: [{ message: error instanceof Error ? error.message : "Error desconocido" }] };
    }

    res.json({
      success: true,
      durationMs: Date.now() - startedAt,
      processed: summary.processed,
      scraped: summary.scraped,
      skipped: summary.skipped,
      statusChanges: summary.statusChanges.length,
      notified,
      errors: summary.errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Error en el servidor",
    });
  }
}

router.get("/", handleAutoScrape);
router.post("/", handleAutoScrape);

export default router;
