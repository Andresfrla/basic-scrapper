// services/statusChangeEventsRepo.js
import { getDb } from "./firebaseAdmin.js";

const COLLECTION = "statusChangeEvents";

function docToEvent(doc) {
  return { id: doc.id, ...doc.data() };
}

export async function listEventsBetween(afterIso, throughIso) {
  let query = getDb()
    .collection(COLLECTION)
    .where("detectedAt", "<=", throughIso);
  if (afterIso) {
    query = query.where("detectedAt", ">", afterIso);
  }
  const snapshot = await query.orderBy("detectedAt", "asc").get();
  return snapshot.docs.map(docToEvent);
}
