// services/emailTemplates/notifications/generalStatusDigest.test.js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildGeneralStatusDigestEmail } from "./generalStatusDigest.js";

describe("buildGeneralStatusDigestEmail", () => {
  test("incluye el total de registros en el asunto", () => {
    const rows = [
      { id: "1", values: { status: "PAGADO", pedimento: "111", fechaCruce: "" } },
      { id: "2", values: { status: "DESADUANADO", pedimento: "222", fechaCruce: "" } },
    ];
    const { subject } = buildGeneralStatusDigestEmail(rows);
    assert.equal(subject, "Status general — 2 registro(s)");
  });

  test("agrupa el conteo por status", () => {
    const rows = [
      { id: "1", values: { status: "PAGADO", pedimento: "111", fechaCruce: "" } },
      { id: "2", values: { status: "PAGADO", pedimento: "222", fechaCruce: "" } },
      { id: "3", values: { status: "DESADUANADO", pedimento: "333", fechaCruce: "" } },
    ];
    const { html } = buildGeneralStatusDigestEmail(rows);
    assert.match(html, />PAGADO<\/td><td[^>]*>2</);
    assert.match(html, />DESADUANADO<\/td><td[^>]*>1</);
  });

  test("trata status vacío como '(sin status)'", () => {
    const rows = [{ id: "1", values: { status: "", pedimento: "111", fechaCruce: "" } }];
    const { html } = buildGeneralStatusDigestEmail(rows);
    assert.match(html, /\(sin status\)/);
  });
});
