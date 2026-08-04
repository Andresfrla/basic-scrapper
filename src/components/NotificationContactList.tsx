import { useState } from "react";
import { Button } from "./ui/button";
import { NotificationContactForm } from "./NotificationContactForm";
import type { NotificationContact, NotificationContactInput } from "../types/notifications";

interface NotificationContactListProps {
  contacts: NotificationContact[];
  onUpdate: (id: string, patch: NotificationContactInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function NotificationContactList({ contacts, onUpdate, onDelete }: NotificationContactListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (contacts.length === 0) {
    return <p className="text-muted-foreground text-sm">Todavía no hay contactos configurados.</p>;
  }

  return (
    <ul className="space-y-3">
      {contacts.map((contact) => (
        <li key={contact.id} className="border rounded-md p-3">
          {editingId === contact.id ? (
            <NotificationContactForm
              initialValue={contact}
              submitLabel="Guardar cambios"
              onCancel={() => setEditingId(null)}
              onSubmit={async (value) => {
                await onUpdate(contact.id, value);
                setEditingId(null);
              }}
            />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {contact.name} <span className="text-muted-foreground">({contact.email})</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {contact.statusChangeEnabled
                    ? `Cambios de status: ${contact.statusChangeMorningTime} y ${contact.statusChangeNightTime}`
                    : "Cambios de status: desactivado"}
                  {" · "}
                  {contact.generalDigestEnabled
                    ? `Digest general: ${contact.generalDigestFrequency}`
                    : "Digest general: desactivado"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(contact.id)}>
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(contact.id)}>
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
