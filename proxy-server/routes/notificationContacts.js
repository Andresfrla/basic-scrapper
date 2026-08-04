// proxy-server/routes/notificationContacts.js
import express from "express";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "../../services/notificationContactsRepo.js";

const router = express.Router();

router.get("/contacts", async (_req, res) => {
  try {
    const contacts = await listContacts();
    res.json(contacts);
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const contact = await createContact(req.body ?? {});
    res.status(201).json(contact);
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.patch("/contacts/:id", async (req, res) => {
  try {
    const contact = await updateContact(req.params.id, req.body ?? {});
    res.json(contact);
  } catch (error) {
    res.status(error.status || 500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    await deleteContact(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Error en el servidor" });
  }
});

export default router;
