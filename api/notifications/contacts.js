// api/notifications/contacts.js
import { createContact, listContacts } from "../../services/notificationContactsRepo.js";
import { hasValidAdminSession } from "../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  try {
    if (req.method === "GET") {
      const contacts = await listContacts();
      return res.json(contacts);
    }
    if (req.method === "POST") {
      const contact = await createContact(req.body ?? {});
      return res.status(201).json(contact);
    }
    res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
}
