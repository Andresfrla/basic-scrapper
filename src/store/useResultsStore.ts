import { create } from "zustand";
import type { CepResultadoResumen } from "../types/cep";

interface ResultsStore {
  resultados: CepResultadoResumen[];
  agregarResultados: (nuevos: CepResultadoResumen[]) => void;
  limpiarResultados: () => void;
}

export const useResultsStore = create<ResultsStore>((set) => ({
  resultados: [],
  agregarResultados: (nuevos) =>
    set((state) => {
      console.log("🗄️ Store: Agregando resultados:", nuevos.length);
      console.log("🗄️ Store: Estado actual:", state.resultados.length);
      const newState = [...state.resultados, ...nuevos];
      console.log("🗄️ Store: Nuevo estado:", newState.length);
      return { resultados: newState };
    }),
  limpiarResultados: () => {
    console.log("🗄️ Store: Limpiando resultados");
    set({ resultados: [] });
  },
}));