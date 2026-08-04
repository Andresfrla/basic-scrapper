// services/emailTemplates/notifications/statusChange.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildStatusChangeEmail } from "./statusChange.js";

describe("buildStatusChangeEmail", () => {
  test("incluye la referencia y el nuevo status en el asunto", () => {
    const { subject } = buildStatusChangeEmail({
      previousStatus: "PAGADO",
      newStatus: "DESADUANADO",
      row: { id: "row-1", values: { referencia: "REF-99" } },
    });
    assert.equal(subject, "Cambio de status: REF-99 → DESADUANADO");
  });

  test("usa el pedimento como referencia cuando no hay referencia", () => {
    const { subject } = buildStatusChangeEmail({
      previousStatus: "",
      newStatus: "PAGADO",
      row: { id: "row-1", values: { pedimento: "5000412" } },
    });
    assert.equal(subject, "Cambio de status: 5000412 → PAGADO");
  });

  test("escapa HTML en los valores de status para evitar inyección", () => {
    const { html } = buildStatusChangeEmail({
      previousStatus: "<script>alert(1)</script>",
      newStatus: "DESADUANADO",
      row: { id: "row-1", values: { referencia: "REF-1" } },
    });
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });
});
