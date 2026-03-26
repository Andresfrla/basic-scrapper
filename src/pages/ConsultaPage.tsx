import { useState } from "react";
import { ConsultaForm } from "../components/ConsultaForm";
import { ResultadosTabla } from "../components/ResultadosTabla";
import { consultar } from "../api/cepApi";
import { useResultsStore } from "../store/useResultsStore";
import type { ConsultaParams } from "../types/cep";

export function ConsultaPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { resultados, agregarResultados, limpiarResultados } = useResultsStore();

  const handleConsulta = async (params: ConsultaParams) => {
    console.log("%c🚀 handleConsulta: INICIO", "color: green; font-weight: bold; font-size: 14px");
    console.log("   Params:", params);
    setLoading(true);
    setError(null);
    
    try {
      console.log("%c   🚀 Llamando API...", "color: blue");
      const nuevosResultados = await consultar(params);
      console.log("%c   🚀 Resultados API:", "color: blue", nuevosResultados);
      
      console.log("%c   🚀 Llamando store...", "color: purple");
      agregarResultados(nuevosResultados);
      
      const storeState = useResultsStore.getState();
      console.log("%c   🚀 Estado store despues:", "color: purple", storeState.resultados);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al realizar la consulta";
      console.error("❌ Error en consulta:", err);
      setError(message);
    } finally {
      console.log("%c🚀 handleConsulta: FIN", "color: green; font-weight: bold; font-size: 14px");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Consulta CEP SAT</h1>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <ConsultaForm onSubmit={handleConsulta} isLoading={loading} />
        </div>
        <div className="lg:col-span-2">
          <ResultadosTabla resultados={resultados} onLimpiar={limpiarResultados} />
        </div>
      </div>
    </div>
  );
}