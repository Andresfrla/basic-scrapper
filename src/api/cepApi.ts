import axios from "axios";
import type { ConsultaParams, CepResultadoResumen } from "../types/cep";

const API_URL = "/api/cep/consultar";

export async function consultar(
  params: ConsultaParams
): Promise<CepResultadoResumen[]> {
  console.log("📤 API: Enviando solicitud a /api/cep/consultar", params);
  try {
    const response = await axios.post<{ error?: string } | CepResultadoResumen[]>(API_URL, params);
    console.log("📥 API: Status:", response.status);
    console.log("📥 API: Data:", response.data);
    
    if (response.data && typeof response.data === 'object' && 'error' in response.data) {
      throw new Error(response.data.error);
    }
    
    const results = response.data as CepResultadoResumen[];
    console.log("📥 API: Resultados:", results.length);
    return results;
  } catch (error) {
    console.error("❌ API Error:", error);
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error("   Status:", error.response.status);
        console.error("   Data:", error.response.data);
        const data = error.response.data;
        if (data && typeof data === 'object' && 'error' in data) {
          throw new Error(data.error);
        }
        throw new Error(`Error ${error.response.status}: ${error.response.statusText}`);
      }
      if (error.request) {
        throw new Error("No se pudo conectar al servidor. ¿Está ejecutando npm run dev?");
      }
    }
    throw error;
  }
}