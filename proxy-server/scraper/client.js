import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "node:crypto";
import https from "node:https";

import { parseResultados, parseDetallePago } from "./parser.js";

const SAT_BASE_URL =
  "https://aplicacionesc.mat.sat.gob.mx/SOIA_CR_WEB/oia_consultarap_cep.aspx";

const SAT_DEBUG = process.env.SAT_DEBUG === "1";

const SAT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const tpoConsultaMap = {
  pedimento: "rblPatente",
  vin: "rblVIN",
  contenedor: "rblPatenteNuevo",
};

function debugLog(message, meta) {
  if (!SAT_DEBUG) return;
  if (meta) console.log(message, meta);
  else console.log(message);
}

/**
 * El portal del SAT negocia TLS de forma "legacy" (renegociación insegura,
 * cifrados con nivel de seguridad bajo y una llave Diffie-Hellman por debajo de
 * 2048 bits). Node moderno rechaza esa conexión por defecto —en producción
 * fallaba con `EPROTO ... dh key too small`—, por lo que habilitamos SIEMPRE un
 * agente HTTPS permisivo igual que lo hace el scraper de border-flow. El portal
 * lo requiere en todos los entornos, incluido Vercel (NODE_ENV=production). Se
 * puede desactivar explícitamente con SAT_TLS_LEGACY=0.
 */
function shouldUseLegacySatTls() {
  if (process.env.SAT_TLS_LEGACY === "0") return false;
  return true;
}

function buildSatHttpsAgent() {
  if (!shouldUseLegacySatTls()) return undefined;

  const legacyServerConnect =
    "SSL_OP_LEGACY_SERVER_CONNECT" in crypto.constants
      ? crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
      : 0;

  return new https.Agent({
    ciphers: "DEFAULT@SECLEVEL=0",
    keepAlive: true,
    secureOptions: legacyServerConnect,
  });
}

const client = axios.create({
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": SAT_USER_AGENT,
  },
  httpsAgent: buildSatHttpsAgent(),
  withCredentials: true,
});

/**
 * GET inicial: obtiene una sesión NUEVA (cookie ASP.NET_SessionId + tokens
 * __VIEWSTATE / __EVENTVALIDATION). Los tokens son de un solo uso, así que NO
 * se cachean: cada consulta arranca su propia sesión.
 */
async function getSessionTokens(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const startedAt = Date.now();
      debugLog("SAT: session GET starting", {
        attempt: i + 1,
        retries,
        url: SAT_BASE_URL,
      });

      const response = await client.get(SAT_BASE_URL, { timeout: 15000 });
      const html = response.data;
      const $ = cheerio.load(html);

      const viewState = String($("input[name='__VIEWSTATE']").val() ?? "");
      const viewStateGenerator = String(
        $("input[name='__VIEWSTATEGENERATOR']").val() ?? ""
      );
      const eventValidation = String(
        $("input[name='__EVENTVALIDATION']").val() ?? ""
      );

      let sessionCookie = "";
      const setCookie = response.headers["set-cookie"];
      if (setCookie) {
        const aspNetSession = setCookie.find((c) =>
          c.includes("ASP.NET_SessionId")
        );
        if (aspNetSession) sessionCookie = aspNetSession.split(";")[0];
      }

      if (!viewState) {
        if (i < retries - 1) {
          console.log(`⚠️ Retry ${i + 1}/${retries}: sin viewState, esperando...`);
          await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        throw new Error("No se pudo extraer el ViewState del portal SAT");
      }

      debugLog("SAT: session GET success", {
        elapsedMs: Date.now() - startedAt,
        eventValidationLen: eventValidation.length,
        hasSessionCookie: Boolean(sessionCookie),
        viewStateLen: viewState.length,
      });

      return { eventValidation, sessionCookie, viewState, viewStateGenerator };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      if (axios.isAxiosError(error)) {
        debugLog("SAT: session GET axios error", {
          attempt: i + 1,
          code: error.code,
          status: error.response?.status,
        });
      }
      console.log(`⚠️ Intento ${i + 1}/${retries} falló: ${msg}`);
      if (i === retries - 1) {
        throw new Error(`GET de sesión SAT falló tras ${retries} intentos: ${msg}`);
      }
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error("Sesión SAT falló");
}

function extractTokensFromHtml(html) {
  const $ = cheerio.load(html);
  return {
    eventValidation: String($("input[name='__EVENTVALIDATION']").val() ?? ""),
    viewState: String($("input[name='__VIEWSTATE']").val() ?? ""),
    viewStateGenerator: String(
      $("input[name='__VIEWSTATEGENERATOR']").val() ?? ""
    ),
  };
}

async function postConsulta(params, tokens, sessionCookie, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const startedAt = Date.now();
      debugLog("SAT: consulta POST starting", {
        aduana: params.aduana,
        anio: params.anio,
        attempt: i + 1,
        metodo: params.metodo,
      });

      const formData = new URLSearchParams({
        __EVENTARGUMENT: "",
        __EVENTTARGET: "",
        __EVENTVALIDATION: tokens.eventValidation,
        __VIEWSTATE: tokens.viewState,
        __VIEWSTATEGENERATOR: tokens.viewStateGenerator,
        cmbAduanas: params.aduana ?? "",
        cmbAnios: params.anio ?? "",
        cmdBuscar: "Buscar",
        tpoConsulta: tpoConsultaMap[params.metodo] ?? "rblPatente",
        txtCaptcha: "",
        txtDocumento: params.valor,
        txtPatente: params.patente ?? "",
      });

      const response = await client.post(SAT_BASE_URL, formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: sessionCookie,
          Referer: SAT_BASE_URL,
        },
        timeout: 20000,
      });

      if (!response.status || response.status >= 400) {
        throw new Error(`Consulta POST SAT falló: ${response.status}`);
      }

      debugLog("SAT: consulta POST success", {
        elapsedMs: Date.now() - startedAt,
        htmlLen:
          typeof response.data === "string" ? response.data.length : null,
      });

      return response.data;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      console.log(`⚠️ POST intento ${i + 1}/${retries} falló: ${msg}`);
      if (i === retries - 1) throw new Error(`Consulta POST SAT falló: ${msg}`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error("Consulta POST SAT falló");
}

/**
 * Postback de "DETALLE" (información del pago) para una fila. Los tokens se
 * re-extraen del HTML de búsqueda porque ASP.NET los rota en cada respuesta.
 */
async function postDetalle(searchHtml, eventTarget, sessionCookie) {
  try {
    const tokens = extractTokensFromHtml(searchHtml);

    const formData = new URLSearchParams({
      __EVENTARGUMENT: "",
      __EVENTTARGET: eventTarget,
      __EVENTVALIDATION: tokens.eventValidation,
      __VIEWSTATE: tokens.viewState,
      __VIEWSTATEGENERATOR: tokens.viewStateGenerator,
    });

    const response = await client.post(SAT_BASE_URL, formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: sessionCookie,
        Referer: SAT_BASE_URL,
      },
      timeout: 20000,
    });

    if (!response.status || response.status >= 400) return null;
    return response.data;
  } catch (error) {
    debugLog("SAT: detalle POST error", {
      code: axios.isAxiosError(error) ? error.code : undefined,
    });
    return null;
  }
}

function hasResultsTable(html) {
  const $ = cheerio.load(html);
  return $("#grdPedimentos, table[id*='grdPedimentos']").length > 0;
}

function hasNoResultsMessage(html) {
  return /no se encontr|sin registros|no existen registros|no hay registros/i.test(
    html
  );
}

// El SAT responde con este toast cuando está saturado o cuando se le consulta
// demasiado rápido (rate-limiting). No es "sin registros": conviene reintentar
// con una pausa mayor.
function hasUnexpectedErrorMessage(html) {
  return /ocurri.{0,3} un error inesperado/i.test(html);
}

/**
 * Se lanza cuando el SAT responde la consulta con un CAPTCHA/interstitial en
 * lugar de la tabla de resultados. El bloqueo es intermitente, así que conviene
 * mostrar "intenta de nuevo" en vez de tratarlo como "sin resultados".
 */
export class SatCaptchaBlockedError extends Error {
  constructor() {
    super(
      "El SAT solicitó un CAPTCHA y bloqueó la consulta. Es intermitente — intenta de nuevo en un momento."
    );
    this.name = "SatCaptchaBlockedError";
  }
}

const SAT_SCRAPE_MAX_ATTEMPTS = 5;

/**
 * Orquesta el flujo completo (equivalente a scrapeSatCep de border-flow):
 * sesión fresca -> POST consulta -> reintento ante CAPTCHA -> parseo de la
 * tabla -> postbacks de detalle en paralelo. Devuelve CepResultadoResumen[].
 */
export async function scrapeCep(rawParams) {
  // Normalizar: el portal SAT rechaza valores con espacios sobrantes
  // (p. ej. patente "1803  "), lo que devuelve una respuesta sin grid que
  // luego se confunde con un bloqueo por CAPTCHA.
  const params = {
    ...rawParams,
    aduana: rawParams.aduana?.trim(),
    anio: rawParams.anio?.trim(),
    patente: rawParams.patente?.trim(),
    valor: rawParams.valor?.trim(),
  };

  const startedAt = Date.now();
  debugLog("SAT: scrape starting", {
    aduana: params.aduana,
    anio: params.anio,
    metodo: params.metodo,
    valorLast4: params.valor?.slice(-4),
  });

  let sessionCookie = "";
  let searchHtml = "";
  let resultados = [];

  // Cada intento usa su propia sesión. Si el SAT responde con CAPTCHA la
  // respuesta no trae grid; reintentamos con sesión nueva antes de rendirnos.
  for (let attempt = 1; attempt <= SAT_SCRAPE_MAX_ATTEMPTS; attempt++) {
    const session = await getSessionTokens();
    sessionCookie = session.sessionCookie;
    const tokens = {
      eventValidation: session.eventValidation,
      viewState: session.viewState,
      viewStateGenerator: session.viewStateGenerator,
    };

    searchHtml = await postConsulta(params, tokens, sessionCookie);

    if (hasResultsTable(searchHtml)) {
      resultados = parseResultados(searchHtml, params.metodo, params);
      debugLog("SAT: resultados parsed", {
        attempt,
        rowCount: resultados.length,
      });
      break;
    }

    if (hasNoResultsMessage(searchHtml)) {
      debugLog("SAT: sin registros (resultado vacío genuino)", { attempt });
      return [];
    }

    // Sin grid y sin mensaje de "sin registros": CAPTCHA o saturación del SAT.
    // Si es el "error inesperado" (rate-limiting) esperamos más entre intentos.
    const saturado = hasUnexpectedErrorMessage(searchHtml);
    debugLog("SAT: sin grid, reintentando", {
      attempt,
      maxAttempts: SAT_SCRAPE_MAX_ATTEMPTS,
      motivo: saturado ? "error inesperado (saturación)" : "posible CAPTCHA",
    });
    if (attempt < SAT_SCRAPE_MAX_ATTEMPTS) {
      const backoff = saturado ? 5000 * attempt : 1500 * attempt;
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    throw new SatCaptchaBlockedError();
  }

  if (!resultados.length) return [];

  // Detalles de pago en paralelo (no secuencial).
  await Promise.all(
    resultados.map(async (resultado) => {
      const eventTarget = resultado._detalleEventTarget;
      if (eventTarget) {
        const detalleHtml = await postDetalle(searchHtml, eventTarget, sessionCookie);
        if (detalleHtml) {
          const detallePago = parseDetallePago(detalleHtml);
          if (detallePago) {
            resultado.detalle.estadoPago = detallePago.estadoPago;
            if (detallePago.aduana) resultado.detalle.aduana = detallePago.aduana;
          }
        }
      }
      delete resultado._detalleEventTarget;
    })
  );

  debugLog("SAT: scrape finished", {
    elapsedMs: Date.now() - startedAt,
    eventCount: resultados.length,
  });

  return resultados;
}
