// services/notificationContactsRepo.test.js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateContactInput } from "./notificationContactsRepo.js";

describe("validateContactInput", () => {
  test("normaliza los campos editables", () => {
    const value = validateContactInput({ name: " Ana ", email: "ana@example.com", statusChangeEnabled: true });
    assert.equal(value.name, "Ana");
    assert.equal(value.email, "ana@example.com");
  });

  test("rechaza horarios inválidos y campos internos", () => {
    assert.throws(() => validateContactInput({ name: "Ana", email: "ana@example.com", statusChangeMorningTime: "25:00" }));
    assert.throws(() => validateContactInput({ name: "Ana", email: "ana@example.com", lastStatusChangeSentAt: "2026-01-01" }));
  });
});
