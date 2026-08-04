export type GeneralDigestFrequency = "twice_daily" | "daily" | "weekly";

export interface NotificationContact {
  id: string;
  name: string;
  email: string;
  // Aviso inmediato: se dispara al detectar un cambio de status durante el
  // scraping automático. No tiene horario.
  statusChangeEnabled: boolean;
  generalDigestEnabled: boolean;
  generalDigestFrequency: GeneralDigestFrequency;
  generalDigestMorningTime: string;
  generalDigestNightTime: string;
  generalDigestWeekday: number;
  lastGeneralDigestSentAt: string | null;
}

export type NotificationContactInput = Omit<
  NotificationContact,
  "id" | "lastGeneralDigestSentAt"
>;
