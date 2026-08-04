// api/notifications/contacts/[id].js
import { deleteContact, updateContact } from "../../../services/notificationContactsRepo.js";
import { hasValidAdminSession } from "../../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  const { id } = req.query;
  try {
    if (req.method === "PATCH") {
      const contact = await updateContact(id, req.body ?? {});
      return res.json(contact);
    }
    if (req.method === "DELETE") {
      await deleteContact(id);
      return res.status(204).end();
    }
    res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
}
