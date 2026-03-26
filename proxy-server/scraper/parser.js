import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";

/**
 * Parsea la tabla principal de resultados (grdPedimentos) del HTML de búsqueda.
 * Retorna un array con la info básica de cada fila + los eventTargets de DETALLE.
 */
export function parseResultados(html, metodo, params) {
  console.log("🔍 Parser: Iniciando parseo...");
  
  const $ = cheerio.load(html);
  const resultados = [];

  console.log("🔍 Parser: Buscando tabla de resultados...");
  
  const table = $("#grdPedimentos, table[id*='grdPedimentos'], table[id*='Pedimento']").first();
  console.log("🔍 Parser: Tabla encontrada:", table.length > 0 ? "SÍ" : "NO");
  
  if (table.length === 0) {
    console.log("⚠️ Parser: No se encontró tabla de resultados");
    const allTableIds = $("table").map((i, el) => $(el).attr("id")).get();
    console.log("🔍 Parser: IDs de tablas en página:", allTableIds);
    return [];
  }

  const rows = table.find("tr");
  console.log(`🔍 Parser: Filas encontradas en tabla: ${rows.length}`);

  if (rows.length <= 1) {
    console.log("⚠️ Parser: Tabla vacía (solo header)");
    return [];
  }

  // Columnas de grdPedimentos:
  // 0: DOCUMENTO, 1: PATENTE, 2: ESTADO, 3: FECHA, 4: BANCO,
  // 5: SECUENCIA, 6: NUMERO DE OPERACION, 7: FACTURA, 8: INFORMACIÓN DEL PAGO (link DETALLE)
  rows.each((index, row) => {
    if (index === 0) return; // Saltar header

    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const documento = $(cells[0]).text().trim();
    const patente = $(cells[1]).text().trim();
    const estado = $(cells[2]).text().trim();
    const fecha = $(cells[3]).text().trim();
    const banco = $(cells[4]).text().trim();
    const secuencia = $(cells[5]).text().trim();
    const numeroOperacion = $(cells[6]).text().trim();
    const factura = $(cells[7]).text().trim();

    // Extraer el eventTarget del link DETALLE
    let detalleEventTarget = null;
    const detalleLink = $(cells[8]).find("a");
    if (detalleLink.length > 0) {
      const href = detalleLink.attr("href") || "";
      const match = href.match(/__doPostBack\('([^']+)'/);
      if (match) {
        detalleEventTarget = match[1];
      }
    }

    if (!documento) return;

    console.log(`🔍 Parser: Fila ${index} - Doc: ${documento}, Patente: ${patente}, Estado: ${estado}, Fecha: ${fecha}`);

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
      metodoConsulta: metodo,
      detalle,
      _detalleEventTarget: detalleEventTarget, // interno, para hacer el postback
    });
  });

  console.log(`✅ Parser: Total resultados parseados: ${resultados.length}`);
  return resultados;
}

/**
 * Parsea la tabla de detalle de pago (grdDetallePago) del HTML de respuesta DETALLE.
 * Retorna el objeto estadoPago y la aduana completa.
 */
export function parseDetallePago(html) {
  console.log("🔍 Parser: Parseando detalle de pago...");
  
  const $ = cheerio.load(html);
  
  const table = $("#grdDetallePago");
  if (table.length === 0) {
    console.log("⚠️ Parser: No se encontró tabla grdDetallePago");
    return null;
  }

  const rows = table.find("tr");
  if (rows.length < 2) {
    console.log("⚠️ Parser: Tabla de detalle vacía");
    return null;
  }

  // Columnas de grdDetallePago:
  // 0: ADUANA, 1: PATENTE, 2: DOCUMENTO, 3: BANCO, 4: NUMERO DE OPERACION,
  // 5: IMPORTE, 6: FECHA Y HORA DE PAGO, 7: LINEA DE CAPTURA, 8: ESTADO LINEA DE CAPTURA
  const cells = $(rows[1]).find("td");
  if (cells.length < 9) {
    console.log(`⚠️ Parser: Fila de detalle tiene solo ${cells.length} columnas`);
    return null;
  }

  const aduana = $(cells[0]).text().trim();
  const banco = $(cells[3]).text().trim();
  const numOperacion = $(cells[4]).text().trim();
  const importe = $(cells[5]).text().trim();
  const fechaPago = $(cells[6]).text().trim();
  const lineaCaptura = $(cells[7]).text().trim();
  const estadoLineaCaptura = $(cells[8]).text().trim();

  console.log(`✅ Parser: Detalle pago - Banco: ${banco}, Importe: ${importe}, Estado: ${estadoLineaCaptura}`);

  // Si hay más filas, puede haber línea de captura secundaria
  let lineaCapturaSecundaria = undefined;
  if (rows.length > 2) {
    const cells2 = $(rows[2]).find("td");
    if (cells2.length >= 8) {
      lineaCapturaSecundaria = $(cells2[7]).text().trim();
    }
  }

  return {
    aduana,
    estadoPago: {
      banco,
      monto: importe,
      numeroOperacion: numOperacion,
      fechaPago,
      lineaCaptura,
      estado: estadoLineaCaptura,
      lineaCapturaSecundaria,
    },
  };
}