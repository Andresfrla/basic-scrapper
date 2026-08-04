import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { NotificationContactInput, GeneralDigestFrequency } from "../types/notifications";

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

const DEFAULT_INPUT: NotificationContactInput = {
  name: "",
  email: "",
  statusChangeEnabled: false,
  generalDigestEnabled: false,
  generalDigestFrequency: "daily",
  generalDigestMorningTime: "08:00",
  generalDigestNightTime: "20:00",
  generalDigestWeekday: 1,
};

function editableFields(value: NotificationContactInput): NotificationContactInput {
  return {
    name: value.name,
    email: value.email,
    statusChangeEnabled: value.statusChangeEnabled,
    generalDigestEnabled: value.generalDigestEnabled,
    generalDigestFrequency: value.generalDigestFrequency,
    generalDigestMorningTime: value.generalDigestMorningTime,
    generalDigestNightTime: value.generalDigestNightTime,
    generalDigestWeekday: value.generalDigestWeekday,
  };
}

interface NotificationContactFormProps {
  initialValue?: NotificationContactInput;
  onSubmit: (value: NotificationContactInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function NotificationContactForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = "Guardar contacto",
}: NotificationContactFormProps) {
  const [value, setValue] = useState<NotificationContactInput>(() =>
    initialValue ? editableFields(initialValue) : DEFAULT_INPUT
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof NotificationContactInput>(key: K, next: NotificationContactInput[K]) {
    setValue((prev) => ({ ...prev, [key]: next }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="contact-name">Nombre</Label>
          <Input id="contact-name" value={value.name} onChange={(e) => update("name", e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={value.email}
            onChange={(e) => update("email", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={value.statusChangeEnabled}
            onChange={(e) => update("statusChangeEnabled", e.target.checked)}
          />
          Avisar cuando cambie el status de un registro
        </label>
        {value.statusChangeEnabled && (
          <p className="text-sm text-muted-foreground pl-6">
            Se envía automáticamente al detectar el cambio durante el scraping. No tiene horario.
          </p>
        )}
      </div>

      <div className="border rounded-md p-3 space-y-3">
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={value.generalDigestEnabled}
            onChange={(e) => update("generalDigestEnabled", e.target.checked)}
          />
          Enviar digest de status general
        </label>
        {value.generalDigestEnabled && (
          <div className="space-y-3 pl-6">
            <div>
              <Label htmlFor="digest-frequency">Frecuencia</Label>
              <select
                id="digest-frequency"
                className="block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={value.generalDigestFrequency}
                onChange={(e) => update("generalDigestFrequency", e.target.value as GeneralDigestFrequency)}
              >
                <option value="twice_daily">Dos veces al día</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>

            {value.generalDigestFrequency === "weekly" && (
              <div>
                <Label htmlFor="digest-weekday">Día de la semana</Label>
                <select
                  id="digest-weekday"
                  className="block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={value.generalDigestWeekday}
                  onChange={(e) => update("generalDigestWeekday", Number(e.target.value))}
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="digest-morning">
                  {value.generalDigestFrequency === "weekly" ? "Hora de envío" : "Hora (mañana)"}
                </Label>
                <Input
                  id="digest-morning"
                  type="time"
                  value={value.generalDigestMorningTime}
                  onChange={(e) => update("generalDigestMorningTime", e.target.value)}
                />
              </div>
              {value.generalDigestFrequency === "twice_daily" && (
                <div>
                  <Label htmlFor="digest-night">Hora (noche)</Label>
                  <Input
                    id="digest-night"
                    type="time"
                    value={value.generalDigestNightTime}
                    onChange={(e) => update("generalDigestNightTime", e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
