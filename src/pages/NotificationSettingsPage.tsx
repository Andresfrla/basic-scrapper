import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { NotificationContactForm } from "../components/NotificationContactForm";
import { NotificationContactList } from "../components/NotificationContactList";
import * as notificationsApi from "../api/notificationsApi";
import type { NotificationContact, NotificationContactInput } from "../types/notifications";

export function NotificationSettingsPage() {
  const [contacts, setContacts] = useState<NotificationContact[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setContacts(await notificationsApi.listContacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(value: NotificationContactInput) {
    try {
      setError(null);
      await notificationsApi.createContact(value);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      throw err;
    }
  }

  async function handleUpdate(id: string, patch: NotificationContactInput) {
    try {
      setError(null);
      await notificationsApi.updateContact(id, patch);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      throw err;
    }
  }

  async function handleDelete(id: string) {
    try {
      setError(null);
      await notificationsApi.deleteContact(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Notificaciones por correo</h1>
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Contactos existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationContactList contacts={contacts} onUpdate={handleUpdate} onDelete={handleDelete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationContactForm onSubmit={handleCreate} submitLabel="Agregar contacto" />
        </CardContent>
      </Card>
    </div>
  );
}
