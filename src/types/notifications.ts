export type GeneralDigestFrequency = "twice_daily" | "daily" | "weekly";

export interface NotificationContact {
  id: string;
  name: string;
  email: string;
  statusChangeEnabled: boolean;
  statusChangeMorningTime: string;
  statusChangeNightTime: string;
  lastStatusChangeSentAt: string | null;
  generalDigestEnabled: boolean;
  generalDigestFrequency: GeneralDigestFrequency;
  generalDigestMorningTime: string;
  generalDigestNightTime: string;
  generalDigestWeekday: number;
  lastGeneralDigestSentAt: string | null;
}

export type NotificationContactInput = Omit<
  NotificationContact,
  "id" | "lastStatusChangeSentAt" | "lastGeneralDigestSentAt"
>;
