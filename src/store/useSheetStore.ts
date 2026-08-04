import { create } from "zustand";
import * as sheetApi from "../api/sheetApi";
import { createColumns, type ColumnDef, type SheetRow } from "../types/sheet";

interface SheetStore {
  columns: ColumnDef[];
  rows: SheetRow[];
  isLoading: boolean;
  error: string | null;

  loadRows: () => Promise<void>;
  addRow: () => Promise<void>;
  removeRow: (rowId: string) => Promise<void>;
  updateCell: (rowId: string, columnId: string, value: string) => Promise<void>;
  acknowledgeRow: (rowId: string) => Promise<void>;
  applyRows: (rows: SheetRow[]) => void;

  getRowById: (rowId: string) => SheetRow | undefined;
}

export const useSheetStore = create<SheetStore>()((set, get) => ({
  columns: createColumns(),
  rows: [],
  isLoading: false,
  error: null,

  loadRows: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await sheetApi.listRows();
      set({ rows, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Error al cargar la hoja",
      });
    }
  },

  addRow: async () => {
    const row = await sheetApi.createRow();
    set((state) => ({ rows: [...state.rows, row] }));
  },

  removeRow: async (rowId) => {
    await sheetApi.deleteRow(rowId);
    set((state) => ({ rows: state.rows.filter((row) => row.id !== rowId) }));
  },

  updateCell: async (rowId, columnId, value) => {
    const updated = await sheetApi.updateRow(rowId, { values: { [columnId]: value } });
    set((state) => ({
      rows: state.rows.map((row) => (row.id === rowId ? updated : row)),
    }));
  },

  acknowledgeRow: async (rowId) => {
    const updated = await sheetApi.updateRow(rowId, { addedFromScrape: false });
    set((state) => ({
      rows: state.rows.map((row) => (row.id === rowId ? updated : row)),
    }));
  },

  applyRows: (rows) =>
    set((state) => {
      const byId = new Map(state.rows.map((row) => [row.id, row]));
      for (const row of rows) byId.set(row.id, row);
      return { rows: Array.from(byId.values()) };
    }),

  getRowById: (rowId) => get().rows.find((row) => row.id === rowId),
}));
