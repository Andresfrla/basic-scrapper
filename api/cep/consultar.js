import { scrapeCep, SatCaptchaBlockedError } from "../../proxy-server/scraper/client.js";
import { hasValidAdminSession } from "../../services/adminSession.js";

export default async function handler(req, res) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const params = req.body;
    console.log("\n========== NUEVA CONSULTA ==========");
    console.log("📥 Params recibidos:", params);

    if (!params.metodo || !params.valor) {
      return res.status(400).json({ error: "Parámetros incompletos" });
    }

    const resultados = await scrapeCep(params);
    console.log(`📊 Resultados: ${resultados.length} registro(s)`);
    console.log("=====================================\n");

    res.json(resultados);
  } catch (error) {
    console.error("❌ Error en consulta CEP:", error.message);

    if (error instanceof SatCaptchaBlockedError) {
      return res.status(503).json({ error: error.message, code: "CAPTCHA_BLOCKED" });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "Error en el servidor",
    });
  }
}
