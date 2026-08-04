import type { CepDetalle } from "./cep";

export const FIXED_COLUMN_IDS = [
  "bodega",
  "status",
  "referencia",
  "caja",
  "carrier",
  "destino",
  "pedimento",
  "secuencia",
  "fechaPedimento",
  "aduana",
  "patente",
  "anio",
  "fechaCruce",
] as const;

export type FixedColumnId = (typeof FIXED_COLUMN_IDS)[number];

export const FIXED_COLUMN_LABELS: Record<FixedColumnId, string> = {
  bodega: "Bodega",
  status: "Status",
  referencia: "Referencia",
  caja: "Caja",
  carrier: "Carrier",
  destino: "Destino",
  pedimento: "Pedimento",
  secuencia: "Secuencia",
  fechaPedimento: "Fecha Reporte",
  aduana: "Aduana",
  patente: "Patente",
  anio: "Año",
  fechaCruce: "Fecha de Cruce",
};

export interface ColumnDef {
  id: FixedColumnId;
  label: string;
}

export interface SheetRow {
  id: string;
  values: Record<string, string>;
  detalle?: CepDetalle;
  scrapeError: string | null;
  addedFromScrape?: boolean;
}

export function createColumns(): ColumnDef[] {
  return FIXED_COLUMN_IDS.map((id) => ({
    id,
    label: FIXED_COLUMN_LABELS[id],
  }));
}
