// services/emailTemplates/notifications/statusChangeDigest.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildStatusChangeDigestEmail } from "./statusChangeDigest.js";

describe("buildStatusChangeDigestEmail", () => {
  test("incluye el conteo de eventos en el asunto", () => {
    const { subject } = buildStatusChangeDigestEmail([
      { rowId: "row-1", previousStatus: "PAGADO", newStatus: "DESADUANADO", detectedAt: "2026-08-03T14:00:00.000Z" },
    ]);
    assert.equal(subject, "Resumen de cambios de status (1)");
  });

  test("escapa HTML en los valores de status para evitar inyección", () => {
    const { html } = buildStatusChangeDigestEmail([
      {
        rowId: "row-1",
        previousStatus: "<script>alert(1)</script>",
        newStatus: "DESADUANADO",
        detectedAt: "2026-08-03T14:00:00.000Z",
      },
    ]);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  test("lista todos los eventos recibidos", () => {
    const { html } = buildStatusChangeDigestEmail([
      { rowId: "row-1", previousStatus: "A", newStatus: "B", detectedAt: "2026-08-03T14:00:00.000Z" },
      { rowId: "row-2", previousStatus: "B", newStatus: "C", detectedAt: "2026-08-03T15:00:00.000Z" },
    ]);
    assert.match(html, /row-1/);
    assert.match(html, /row-2/);
  });
});
