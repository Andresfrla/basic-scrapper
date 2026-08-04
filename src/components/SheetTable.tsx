import { useState } from "react";
import { Download, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { SheetRowView } from "./SheetRowView";
import { useSheetStore } from "../store/useSheetStore";
import { useScrapeAll } from "../hooks/useScrapeAll";
import { exportSheetToCsv } from "../lib/exportSheet";

export function SheetTable() {
  const columns = useSheetStore((state) => state.columns);
  const rows = useSheetStore((state) => state.rows);
  const isLoading = useSheetStore((state) => state.isLoading);
  const error = useSheetStore((state) => state.error);
  const addRow = useSheetStore((state) => state.addRow);
  const { scrapeAll } = useScrapeAll();
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [isAddingRow, setIsAddingRow] = useState(false);

  const handleScrapeAll = async () => {
    setIsScrapingAll(true);
    try {
      await scrapeAll();
    } finally {
      setIsScrapingAll(false);
    }
  };

  const handleAddRow = async () => {
    setIsAddingRow(true);
    try {
      await addRow();
    } finally {
      setIsAddingRow(false);
    }
  };

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between gap-2 p-4 border-b bg-muted/20">
        <Button type="button" size="sm" disabled={isAddingRow} onClick={handleAddRow}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar fila
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isScrapingAll}
            onClick={handleScrapeAll}
          >
            {isScrapingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar todo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => exportSheetToCsv(columns, rows)}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar Excel
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-destructive border-b bg-destructive/5">{error}</div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id}>{column.label}</TableHead>
            ))}
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <td colSpan={columns.length + 1} className="p-8 text-center text-sm text-muted-foreground">
                Cargando hoja…
              </td>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <td
                colSpan={columns.length + 1}
                className="p-8 text-center text-sm text-muted-foreground"
              >
                No hay filas todavía. Agrega una para empezar a capturar tus embarques.
              </td>
            </TableRow>
          ) : (
            rows.map((row) => (
              <SheetRowView key={row.id} row={row} columns={columns} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
