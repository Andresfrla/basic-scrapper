import { createRow, listRows } from "../../services/sheetRowsRepo.js";
import { hasValidAdminSession } from "../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  try {
    if (req.method === "GET") {
      const rows = await listRows();
      return res.json(rows);
    }

    if (req.method === "POST") {
      const row = await createRow({ values: req.body?.values });
      return res.status(201).json(row);
    }

    res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
}
