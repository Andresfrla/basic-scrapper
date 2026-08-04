// services/notificationSchedule.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findDueSlot } from "./notificationSchedule.js";

describe("findDueSlot", () => {
  test("detecta el horario de la mañana cuando nunca se ha enviado", () => {
    // 2026-08-03T14:30:00Z = 2026-08-03 08:30 CDMX (UTC-6, sin horario de verano)
    const now = new Date("2026-08-03T14:30:00Z");
    const due = findDueSlot({ times: ["08:00", "20:00"] }, null, now);
    assert.equal(due, "2026-08-03T14:00:00.000Z");
  });

  test("no vuelve a marcar el mismo horario como pendiente", () => {
    const now = new Date("2026-08-03T14:30:00Z");
    const alreadySent = "2026-08-03T14:00:00.000Z";
    const due = findDueSlot({ times: ["08:00", "20:00"] }, alreadySent, now);
    assert.equal(due, null);
  });

  test("detecta el horario de la noche del mismo día tras haber enviado el de la mañana", () => {
    // 2026-08-03T02:05:00Z del día siguiente = 2026-08-03 20:05 CDMX
    const now = new Date("2026-08-04T02:05:00Z");
    const morningSent = "2026-08-03T14:00:00.000Z";
    const due = findDueSlot({ times: ["08:00", "20:00"] }, morningSent, now);
    assert.equal(due, "2026-08-04T02:00:00.000Z");
  });

  test("respeta la restricción de día de la semana (weekly)", () => {
    // 2026-08-03 es lunes (weekday 1), 08:30 CDMX
    const now = new Date("2026-08-03T14:30:00Z");
    // weekday=lunes → dispara el slot de hoy (lunes).
    const dueMonday = findDueSlot({ times: ["08:00"], weekday: 1 }, null, now);
    assert.equal(dueMonday, "2026-08-03T14:00:00.000Z");

    // weekday=martes → hoy (lunes) no es martes, así que no hay slot de hoy;
    // el más reciente que ya pasó es el martes anterior (catch-up), nunca el
    // lunes de hoy. Esto verifica que el filtro de día realmente cambia el slot.
    const dueTuesday = findDueSlot({ times: ["08:00"], weekday: 2 }, null, now);
    assert.equal(dueTuesday, "2026-07-28T14:00:00.000Z");
  });

  test("recupera el slot semanal tras varios días sin ejecutar el cron", () => {
    const now = new Date("2026-08-06T14:30:00Z"); // jueves
    const due = findDueSlot({ times: ["08:00"], weekday: 1 }, null, now);
    assert.equal(due, "2026-08-03T14:00:00.000Z"); // lunes anterior
  });
});
