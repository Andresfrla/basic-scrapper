import axios from "axios";
import * as cheerio from "cheerio";

const SAT_BASE_URL = "https://aplicacionesc.mat.sat.gob.mx/SOIA_CR_WEB/oia_consultarap_cep.aspx";

const tpoConsultaMap = {
  pedimento: "rblPatente",
  vin: "rblVIN",
  contenedor: "rblPatenteNuevo",
};

const client = axios.create({
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
  },
});

let cachedTokens = null;
let sessionCookie = null;

export async function getSessionTokens() {
  if (cachedTokens) {
    return cachedTokens;
  }

  try {
    console.log("🌐 Haciendo GET a SAT...");
    const response = await client.get(SAT_BASE_URL);
    const html = response.data;
    console.log(`📄 GET SAT - HTML recibido: ${html.length} caracteres`);

    const $ = cheerio.load(html);
    
    const viewState = $("input[name='__VIEWSTATE']").val() || "";
    const viewStateGenerator = $("input[name='__VIEWSTATEGENERATOR']").val() || "";
    const eventValidation = $("input[name='__EVENTVALIDATION']").val() || "";

    console.log("🔍 ViewState length:", viewState.length);
    console.log("🔍 EventValidation length:", eventValidation.length);

    const setCookie = response.headers["set-cookie"];
    if (setCookie) {
      console.log("🍪 Cookies recibidas:", setCookie.length);
      const aspNetSession = setCookie.find((c) => c.includes("ASP.NET_SessionId"));
      if (aspNetSession) {
        sessionCookie = aspNetSession.split(";")[0];
        console.log("🍪 ASP.NET_SessionId guardada");
      }
    }

    cachedTokens = {
      viewState,
      viewStateGenerator,
      eventValidation,
    };

    return cachedTokens;
  } catch (error) {
    console.error("❌ Error getting session tokens:", error.message);
    throw new Error("No se pudo obtener la sesión del SAT: " + error.message);
  }
}

/**
 * Extrae los tokens ASP.NET (ViewState, EventValidation) de un HTML de respuesta.
 */
function extractTokensFromHtml(html) {
  const $ = cheerio.load(html);
  return {
    viewState: $("input[name='__VIEWSTATE']").val() || "",
    viewStateGenerator: $("input[name='__VIEWSTATEGENERATOR']").val() || "",
    eventValidation: $("input[name='__EVENTVALIDATION']").val() || "",
  };
}

export async function postConsulta(params, tokens) {
  try {
    await getSessionTokens();

    console.log("📤 Enviando POST con:", {
      metodo: params.metodo,
      valor: params.valor,
      aduana: params.aduana,
      anio: params.anio,
      patente: params.patente,
      tpoConsulta: tpoConsultaMap[params.metodo],
    });

    const formData = new URLSearchParams({
      __EVENTTARGET: "",
      __EVENTARGUMENT: "",
      __VIEWSTATE: tokens.viewState,
      __VIEWSTATEGENERATOR: tokens.viewStateGenerator,
      __EVENTVALIDATION: tokens.eventValidation,
      txtCaptcha: "",
      cmbAduanas: params.aduana || "",
      cmbAnios: params.anio || "",
      txtPatente: params.patente || "",
      txtDocumento: params.valor,
      tpoConsulta: tpoConsultaMap[params.metodo] || "rblPatente",
      cmdBuscar: "Buscar",
    });

    console.log("📋 FormData prepared");

    const response = await client.post(SAT_BASE_URL, formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: sessionCookie,
        Referer: SAT_BASE_URL,
      },
    });

    console.log(`✅ POST completado - Status: ${response.status}, Tamaño: ${response.data.length}`);

    return response.data;
  } catch (error) {
    console.error("❌ Error posting consulta:");
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Data:", error.response.data?.substring?.(0, 500));
    } else {
      console.error("   Mensaje:", error.message);
    }
    if (error.response) {
      throw new Error(`Error del SAT: ${error.response.status}`);
    }
    throw new Error("Error al consultar el SAT: " + error.message);
  }
}

/**
 * Hace el postback de "DETALLE" para una fila de la tabla de resultados.
 * Requiere el HTML de la respuesta de búsqueda (para extraer tokens actualizados)
 * y el eventTarget del link DETALLE.
 */
export async function postDetalle(searchResponseHtml, eventTarget) {
  try {
    const tokens = extractTokensFromHtml(searchResponseHtml);
    console.log(`📡 Haciendo postback DETALLE: ${eventTarget}`);

    const formData = new URLSearchParams({
      __EVENTTARGET: eventTarget,
      __EVENTARGUMENT: "",
      __VIEWSTATE: tokens.viewState,
      __VIEWSTATEGENERATOR: tokens.viewStateGenerator,
      __EVENTVALIDATION: tokens.eventValidation,
    });

    const response = await client.post(SAT_BASE_URL, formData.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: sessionCookie,
        Referer: SAT_BASE_URL,
      },
    });

    console.log(`✅ DETALLE completado - Status: ${response.status}, Tamaño: ${response.data.length}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error en postback DETALLE:", error.message);
    return null;
  }
}