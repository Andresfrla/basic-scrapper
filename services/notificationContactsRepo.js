// services/notificationContactsRepo.js
import { getDb } from "./firebaseAdmin.js";

const COLLECTION = "notificationContacts";

const DEFAULT_CONTACT = {
  name: "",
  email: "",
  statusChangeEnabled: false,
  generalDigestEnabled: false,
  generalDigestFrequency: "daily",
  generalDigestMorningTime: "08:00",
  generalDigestNightTime: "20:00",
  generalDigestWeekday: 1,
  lastGeneralDigestSentAt: null,
};

const EDITABLE_FIELDS = new Set([
  "name", "email", "statusChangeEnabled",
  "generalDigestEnabled", "generalDigestFrequency", "generalDigestMorningTime",
  "generalDigestNightTime", "generalDigestWeekday",
]);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const FREQUENCIES = new Set(["twice_daily", "daily", "weekly"]);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

export function validateContactInput(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Body inválido");
  const value = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!EDITABLE_FIELDS.has(key)) invalid(`Campo no permitido: ${key}`);
    if (key === "name") {
      if (typeof raw !== "string" || !raw.trim() || raw.trim().length > 100) invalid("Nombre inválido");
      value.name = raw.trim();
    } else if (key === "email") {
      if (typeof raw !== "string" || raw.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) invalid("Email inválido");
      value.email = raw;
    } else if (key.endsWith("Enabled")) {
      if (typeof raw !== "boolean") invalid(`${key} debe ser boolean`);
      value[key] = raw;
    } else if (key.endsWith("Time")) {
      if (typeof raw !== "string" || !TIME.test(raw)) invalid(`${key} debe usar HH:mm`);
      value[key] = raw;
    } else if (key === "generalDigestFrequency") {
      if (!FREQUENCIES.has(raw)) invalid("Frecuencia inválida");
      value[key] = raw;
    } else if (key === "generalDigestWeekday") {
      if (!Number.isInteger(raw) || raw < 0 || raw > 6) invalid("Día inválido");
      value[key] = raw;
    }
  }
  if (!partial && (!value.name || !value.email)) invalid("Nombre y email son requeridos");
  if (partial && Object.keys(value).length === 0) invalid("No hay campos para actualizar");
  return value;
}

function docToContact(doc) {
  const data = doc.data();
  return { ...DEFAULT_CONTACT, ...data, id: doc.id };
}

export async function listContacts() {
  const snapshot = await getDb().collection(COLLECTION).orderBy("createdAt", "asc").get();
  return snapshot.docs.map(docToContact);
}

export async function createContact(input) {
  const ref = getDb().collection(COLLECTION).doc();
  const doc = {
    ...DEFAULT_CONTACT,
    ...validateContactInput(input),
    createdAt: new Date().toISOString(),
  };
  await ref.set(doc);
  const snapshot = await ref.get();
  return docToContact(snapshot);
}

export async function updateContact(id, patch) {
  const ref = getDb().collection(COLLECTION).doc(id);
  if (!(await ref.get()).exists) {
    const error = new Error("Contacto no encontrado");
    error.status = 404;
    throw error;
  }
  await ref.update(validateContactInput(patch, { partial: true }));
  const snapshot = await ref.get();
  return docToContact(snapshot);
}

export async function updateContactDeliveryState(id, patch) {
  const allowed = new Set(["lastGeneralDigestSentAt"]);
  if (Object.keys(patch).some((key) => !allowed.has(key))) throw new Error("Cursor de entrega inválido");
  await getDb().collection(COLLECTION).doc(id).update(patch);
}

export async function deleteContact(id) {
  await getDb().collection(COLLECTION).doc(id).delete();
}
