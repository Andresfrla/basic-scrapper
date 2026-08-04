import { deleteRow, updateRow } from "../../../services/sheetRowsRepo.js";
import { hasValidAdminSession } from "../../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  const { id } = req.query;

  try {
    if (req.method === "PATCH") {
      const patch = {};
      if (req.body?.values) patch.values = req.body.values;
      if (req.body?.addedFromScrape !== undefined) patch.addedFromScrape = req.body.addedFromScrape;
      const row = await updateRow(id, patch);
      return res.json(row);
    }

    if (req.method === "DELETE") {
      await deleteRow(id);
      return res.status(204).end();
    }

    res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
}
