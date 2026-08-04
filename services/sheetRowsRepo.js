import { v4 as uuidv4 } from "uuid";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebaseAdmin.js";

const COLLECTION = "rows";

const DEFAULT_VALUES = {
  bodega: "",
  status: "",
  referencia: "",
  caja: "",
  carrier: "",
  destino: "",
  pedimento: "",
  secuencia: "",
  fechaPedimento: "",
  aduana: "240",
  patente: "1803",
  anio: "2026",
  fechaCruce: "",
};

function docToRow(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    values: { ...DEFAULT_VALUES, ...data.values },
    detalle: data.detalle ?? undefined,
    scrapeError: data.scrapeError ?? null,
    addedFromScrape: Boolean(data.addedFromScrape),
    lastScrapedAt: data.lastScrapedAt ? data.lastScrapedAt.toMillis() : null,
    createdAt: data.createdAt ? data.createdAt.toMillis() : 0,
  };
}

export async function listRows() {
  const snapshot = await getDb().collection(COLLECTION).orderBy("createdAt", "asc").get();
  return snapshot.docs.map(docToRow);
}

export async function createRow({ values = {}, detalle = null, addedFromScrape = false } = {}) {
  const id = uuidv4();
  const doc = {
    values: { ...DEFAULT_VALUES, ...values },
    detalle,
    scrapeError: null,
    addedFromScrape: Boolean(addedFromScrape),
    lastScrapedAt: detalle ? FieldValue.serverTimestamp() : null,
    createdAt: FieldValue.serverTimestamp(),
  };
  await getDb().collection(COLLECTION).doc(id).set(doc);
  const snapshot = await getDb().collection(COLLECTION).doc(id).get();
  return docToRow(snapshot);
}

export async function updateRow(id, patch, { statusChange } = {}) {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const update = {};
  if (patch.values) {
    for (const [key, value] of Object.entries(patch.values)) {
      update[`values.${key}`] = value;
    }
  }
  if ("detalle" in patch) update.detalle = patch.detalle;
  if ("scrapeError" in patch) update.scrapeError = patch.scrapeError;
  if ("addedFromScrape" in patch) update.addedFromScrape = patch.addedFromScrape;
  if (patch.markScraped) update.lastScrapedAt = FieldValue.serverTimestamp();

  if (statusChange) {
    const batch = db.batch();
    const eventRef = db.collection("statusChangeEvents").doc();
    batch.update(ref, update);
    batch.set(eventRef, { ...statusChange, rowId: id, detectedAt: new Date().toISOString() });
    await batch.commit();
  } else {
    await ref.update(update);
  }
  const snapshot = await ref.get();
  return docToRow(snapshot);
}

export async function deleteRow(id) {
  await getDb().collection(COLLECTION).doc(id).delete();
}
