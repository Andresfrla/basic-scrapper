import express from "express";
import { createRow, deleteRow, listRows, updateRow } from "../../services/sheetRowsRepo.js";
import { runScrapeAll } from "../../services/scrapeReconciliation.js";

const router = express.Router();

router.get("/rows", async (_req, res) => {
  try {
    const rows = await listRows();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.post("/rows", async (req, res) => {
  try {
    const row = await createRow({ values: req.body?.values });
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.patch("/rows/:id", async (req, res) => {
  try {
    const patch = {};
    if (req.body?.values) patch.values = req.body.values;
    if (req.body?.addedFromScrape !== undefined) patch.addedFromScrape = req.body.addedFromScrape;
    const row = await updateRow(req.params.id, patch);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.delete("/rows/:id", async (req, res) => {
  try {
    await deleteRow(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.post("/scrape-all", async (_req, res) => {
  try {
    const summary = await runScrapeAll({ onlyStaleOrOpen: false });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

export default router;
