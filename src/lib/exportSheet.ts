import type { ColumnDef, SheetRow } from "../types/sheet";

function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportSheetToCsv(columns: ColumnDef[], rows: SheetRow[], filename = "hoja-pedimentos.csv") {
  const header = columns.map((column) => escapeCsvValue(column.label));
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row.values[column.id] ?? ""))
  );

  const csv = [header, ...body].map((line) => line.join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
