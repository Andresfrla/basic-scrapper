import express from "express";
import { getSessionTokens, postConsulta, postDetalle } from "../scraper/client.js";
import { parseResultados, parseDetallePago } from "../scraper/parser.js";
import fs from "fs";
import os from "os";
import path from "path";

const router = express.Router();

router.post("/consultar", async (req, res) => {
  try {
    const params = req.body;
    console.log("\n========== NUEVA CONSULTA ==========");
    console.log("📥 Params recibidos:", params);

    if (!params.metodo || !params.valor) {
      return res.status(400).json({ error: "Parámetros incompletos" });
    }

    console.log("🔐 Obteniendo tokens de sesión...");
    const tokens = await getSessionTokens();
    console.log("✅ Tokens obtenidos");

    console.log("📡 Realizando consulta al SAT...");
    const html = await postConsulta(params, tokens);
    console.log(`📄 HTML recibido, tamaño: ${html.length} caracteres`);

    // Guardar HTML para debug (en temp para no triggear Vite HMR)
    const debugPath = path.join(os.tmpdir(), 'debug_response.html');
    fs.writeFileSync(debugPath, html);
    console.log(`💾 HTML guardado en ${debugPath}`);

    const resultados = parseResultados(html, params.metodo, params);
    console.log(`📊 Resultados parseados: ${resultados.length} registros`);

    // Para cada resultado que tenga un link DETALLE, hacer el postback para obtener info de pago
    let currentHtml = html;
    for (let i = 0; i < resultados.length; i++) {
      const resultado = resultados[i];
      if (resultado._detalleEventTarget) {
        console.log(`📡 Obteniendo detalle de pago para fila ${i + 1}...`);
        const detalleHtml = await postDetalle(currentHtml, resultado._detalleEventTarget);
        
        if (detalleHtml) {
          // Guardar para debug
          const debugDetallePath = path.join(os.tmpdir(), `debug_detalle_${i}.html`);
          fs.writeFileSync(debugDetallePath, detalleHtml);
          
          const detallePago = parseDetallePago(detalleHtml);
          if (detallePago) {
            resultado.detalle.estadoPago = detallePago.estadoPago;
            // Si la aduana viene con nombre completo del SAT, usarla
            if (detallePago.aduana) {
              resultado.detalle.aduana = detallePago.aduana;
            }
          }
          // Actualizar el HTML para el siguiente postback (tokens cambian)
          currentHtml = detalleHtml;
        }
      }
      // Limpiar el campo interno antes de enviar al frontend
      delete resultado._detalleEventTarget;
    }

    console.log("=====================================\n");

    res.json(resultados);
  } catch (error) {
    console.error("❌ Error en consulta CEP:", error.message);
    console.error(error.stack);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Error en el servidor" 
    });
  }
});

export default router;