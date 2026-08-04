// services/notificationSchedule.js
const TIME_ZONE = "America/Mexico_City";

function getZonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedOffsetMinutes(date) {
  const zoned = getZonedParts(date);
  const asUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function zonedWallTimeToInstant(year, month, day, hhmm) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = zonedOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offsetMinutes * 60000);
}

function zonedWeekday(year, month, day) {
  // Mediodía UTC evita problemas de redondeo; el día de la semana de un
  // triplete Y/M/D no depende de la hora del día.
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function addDays(year, month, day, offset) {
  const shifted = new Date(Date.UTC(year, month - 1, day, 12));
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/**
 * Busca el horario programado más reciente que ya pasó (<= now) y es
 * posterior a lastSentAtIso. Devuelve su ISO string, o null si ninguno aplica.
 */
export function findDueSlot({ times, weekday = null }, lastSentAtIso, now = new Date()) {
  const lastSentAt = lastSentAtIso ? new Date(lastSentAtIso) : new Date(0);
  const today = getZonedParts(now);

  const candidates = [];
  const firstOffset = weekday === null ? -1 : -7;
  for (let offset = firstOffset; offset <= 0; offset += 1) {
    const { year, month, day } = addDays(today.year, today.month, today.day, offset);
    if (weekday !== null && zonedWeekday(year, month, day) !== weekday) continue;
    for (const time of times) {
      candidates.push(zonedWallTimeToInstant(year, month, day, time));
    }
  }

  const due = candidates
    .filter((instant) => instant > lastSentAt && instant <= now)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return due ? due.toISOString() : null;
}
