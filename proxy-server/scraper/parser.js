import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";

// Layout observado de grdPedimentos:
// 0 DOCUMENTO | 1 PATENTE | 2 ESTADO | 3 FECHA | 4 BANCO | 5 SECUENCIA |
// 6 NUMERO DE OPERACION | 7 FACTURA | 8 INFORMACION DEL PAGO (link DETALLE)
const DEFAULT_COLUMN_INDEX = {
  detalle: 8,
  documento: 0,
  estado: 2,
  factura: 7,
  fecha: 3,
  numeroOperacion: 6,
  patente: 1,
  secuencia: 5,
};

function normalizeHeader(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Resuelve los índices de columna leyendo la fila de encabezado cuando existe,
 * para que el parseo sea resiliente a columnas ocultas o reordenadas.
 */
function resolveColumnIndex($, table) {
  const headerRow = table
    .find("tr")
    .filter((_i, tr) => $(tr).find("th").length > 0)
    .first();
  const headerCells = headerRow.length ? headerRow.find("th") : $();
  if (!headerCells.length) return DEFAULT_COLUMN_INDEX;

  const byHeader = {};
  headerCells.each((i, cell) => {
    byHeader[normalizeHeader($(cell).text())] = i;
  });

  const pick = (aliases, fallback) => {
    for (const alias of aliases) {
      if (byHeader[alias] !== undefined) return byHeader[alias];
    }
    return fallback;
  };

  return {
    detalle: pick(
      ["INFORMACION DEL PAGO", "DETALLE"],
      DEFAULT_COLUMN_INDEX.detalle
    ),
    documento: pick(["DOCUMENTO", "PEDIMENTO"], DEFAULT_COLUMN_INDEX.documento),
    estado: pick(["ESTADO"], DEFAULT_COLUMN_INDEX.estado),
    factura: pick(["FACTURA"], DEFAULT_COLUMN_INDEX.factura),
    fecha: pick(["FECHA"], DEFAULT_COLUMN_INDEX.fecha),
    numeroOperacion: pick(
      ["NUMERO DE OPERACION"],
      DEFAULT_COLUMN_INDEX.numeroOperacion
    ),
    patente: pick(["PATENTE"], DEFAULT_COLUMN_INDEX.patente),
    secuencia: pick(["SECUENCIA"], DEFAULT_COLUMN_INDEX.secuencia),
  };
}

/**
 * Parsea la tabla principal de resultados (grdPedimentos) del HTML de búsqueda.
 * Devuelve CepResultadoResumen[] con el eventTarget de DETALLE en _detalleEventTarget.
 */
export function parseResultados(html, metodo, params) {
  const $ = cheerio.load(html);
  const resultados = [];

  const table = $("#grdPedimentos, table[id*='grdPedimentos']").first();
  if (!table.length) {
    console.log("⚠️ Parser: no se encontró tabla grdPedimentos");
    return [];
  }

  const col = resolveColumnIndex($, table);
  const requiredCells =
    Math.max(
      col.documento,
      col.patente,
      col.estado,
      col.fecha,
      col.secuencia,
      col.numeroOperacion,
      col.factura,
      col.detalle
    ) + 1;

  // Preferir filas de tbody para saltar el thead; caer a todas si no hay tbody.
  const rowSelector = table.find("tbody tr").length ? "tbody tr" : "tr";

  table.find(rowSelector).each((_i, row) => {
    // Saltar filas de encabezado (contienen <th>).
    if ($(row).find("th").length > 0) return;

    const cells = $(row).find("td");
    if (cells.length < requiredCells) return;

    const documento = $(cells[col.documento]).text().trim();
    if (!documento) return;

    const estado = $(cells[col.estado]).text().trim();
    // Saltar filas tipo-encabezado donde estado es el nombre de la columna.
    if (/^estado/i.test(estado)) return;

    const patente = $(cells[col.patente]).text().trim();
    const fecha = $(cells[col.fecha]).text().trim();
    const secuencia = $(cells[col.secuencia]).text().trim();
    const numeroOperacion = $(cells[col.numeroOperacion]).text().trim();
    const factura = $(cells[col.factura]).text().trim();

    let detalleEventTarget = null;
    const href = $(cells[col.detalle]).find("a").attr("href") ?? "";
    const match = href.match(/__doPostBack\('([^']+)'/);
    if (match) detalleEventTarget = match[1];

    const detalle = {
      documento,
      aduana: params?.aduana || "",
      anio: params?.anio || "",
      patente,
      numeroPedimento: documento,
      situacionPedimento: estado,
      estado,
      fecha,
      numeroOperacion,
      estadoPago: {
        banco: "",
        monto: "",
        numeroOperacion: "",
        fechaPago: "",
        lineaCaptura: "",
        estado: "",
      },
    };

    resultados.push({
      id: uuidv4(),
      documento,
      estado,
      fecha,
      secuencia,
      numeroOperacion,
      factura,
      metodoConsulta: metodo,
      detalle,
      _detalleEventTarget: detalleEventTarget,
    });
  });

  console.log(`✅ Parser: ${resultados.length} resultado(s) parseado(s)`);
  return resultados;
}

function cleanSatCell(value) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanCaptureLine(value) {
  const normalized = cleanSatCell(value);
  if (!normalized) return "";
  const token = normalized.match(/[A-Z0-9]{10,}/i);
  return token ? token[0].toUpperCase() : normalized;
}

/**
 * Deduplica pagos: descarta filas sin línea de captura cuando existe otra fila
 * equivalente (mismo banco/operación/monto/fecha) que sí la trae.
 */
function dedupePaymentDetails(details) {
  return details.filter((detail, index, all) => {
    if (detail.lineaCaptura) return true;
    const hasEquivalentWithCapture = all.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        Boolean(other.lineaCaptura) &&
        other.banco === detail.banco &&
        other.numeroOperacion === detail.numeroOperacion &&
        other.monto === detail.monto &&
        other.fechaPago === detail.fechaPago
    );
    return !hasEquivalentWithCapture;
  });
}

/**
 * Parsea la tabla de detalle de pago (grdDetallePago) del HTML del postback.
 * Columnas: 0 ADUANA | 1 PATENTE | 2 DOCUMENTO | 3 BANCO | 4 NUMERO DE OPERACION |
 * 5 IMPORTE | 6 FECHA Y HORA DE PAGO | 7 LINEA DE CAPTURA | 8 ESTADO LINEA DE CAPTURA
 */
export function parseDetallePago(html) {
  const $ = cheerio.load(html);
  const table = $("#grdDetallePago");
  if (!table.length) return null;

  const isHeaderLike = (value) => {
    const n = value.trim().toUpperCase();
    return (
      n === "BANCO" ||
      n === "IMPORTE" ||
      n === "NUMERO DE OPERACION" ||
      n === "FECHA Y HORA DE PAGO" ||
      n === "LINEA DE CAPTURA" ||
      n === "ESTADO LINEA DE CAPTURA"
    );
  };

  const details = [];
  const rows = table.find("tbody tr").length
    ? table.find("tbody tr")
    : table.find("tr");

  rows.each((_i, row) => {
    if ($(row).find("th").length > 0) return;

    const cells = $(row).find("td");
    if (cells.length < 9) return;

    const detail = {
      aduana: cleanSatCell($(cells[0]).text()),
      banco: cleanSatCell($(cells[3]).text()),
      numeroOperacion: cleanSatCell($(cells[4]).text()),
      monto: cleanSatCell($(cells[5]).text()),
      fechaPago: cleanSatCell($(cells[6]).text()),
      lineaCaptura: cleanCaptureLine($(cells[7]).text()),
      estadoLineaCaptura: cleanSatCell($(cells[8]).text()),
    };

    const hasRelevantData =
      detail.banco ||
      detail.numeroOperacion ||
      detail.monto ||
      detail.fechaPago ||
      detail.lineaCaptura ||
      detail.estadoLineaCaptura;

    const allRelevantFieldsAreHeaders =
      (!detail.banco || isHeaderLike(detail.banco)) &&
      (!detail.numeroOperacion || isHeaderLike(detail.numeroOperacion)) &&
      (!detail.monto || isHeaderLike(detail.monto)) &&
      (!detail.fechaPago || isHeaderLike(detail.fechaPago)) &&
      (!detail.lineaCaptura || isHeaderLike(detail.lineaCaptura)) &&
      (!detail.estadoLineaCaptura || isHeaderLike(detail.estadoLineaCaptura));

    if (hasRelevantData && !allRelevantFieldsAreHeaders) details.push(detail);
  });

  const normalized = dedupePaymentDetails(details);
  if (!normalized.length) return null;

  const primary = normalized[0];
  const secondary = normalized[1];

  return {
    aduana: primary.aduana,
    estadoPago: {
      banco: primary.banco,
      monto: primary.monto,
      numeroOperacion: primary.numeroOperacion,
      fechaPago: primary.fechaPago,
      lineaCaptura: primary.lineaCaptura,
      estado: primary.estadoLineaCaptura,
      lineaCapturaSecundaria: secondary?.lineaCaptura,
    },
  };
}
