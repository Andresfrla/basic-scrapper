import { useNavigate } from "react-router-dom";
import { Sparkles, Trash2, X } from "lucide-react";
import { TableCell, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EditableCell } from "./EditableCell";
import { EditableSelectCell } from "./EditableSelectCell";
import { useSheetStore } from "../store/useSheetStore";
import { SAT_OPTIONS } from "../constants/satOptions";
import { BODEGA_OPTIONS } from "../constants/bodegaOptions";
import { CARRIER_OPTIONS } from "../constants/carrierOptions";
import { cn } from "../lib/utils";
import type { ColumnDef, SheetRow } from "../types/sheet";

const LOCKED_AFTER_SCRAPE = new Set([
  "status",
  "pedimento",
  "patente",
  "aduana",
  "anio",
  "fechaCruce",
]);

function ReadOnlyCell({ value }: { value: string }) {
  return (
    <div className="min-h-[2rem] rounded px-2 py-1 text-sm">{value || "—"}</div>
  );
}

interface SheetRowViewProps {
  row: SheetRow;
  columns: ColumnDef[];
}

export function SheetRowView({ row, columns }: SheetRowViewProps) {
  const navigate = useNavigate();
  const updateCell = useSheetStore((state) => state.updateCell);
  const removeRow = useSheetStore((state) => state.removeRow);
  const acknowledgeRow = useSheetStore((state) => state.acknowledgeRow);
  const locked = Boolean(row.detalle);

  return (
    <TableRow className={cn(row.addedFromScrape && "bg-amber-50")}>
      {columns.map((column) => {
        const value = row.values[column.id] ?? "";

        if (column.id === "bodega") {
          return (
            <TableCell key={column.id}>
              <EditableSelectCell
                value={value}
                options={BODEGA_OPTIONS}
                onCommit={(next) => updateCell(row.id, column.id, next)}
                placeholder="Bodega"
              />
            </TableCell>
          );
        }

        if (column.id === "carrier") {
          return (
            <TableCell key={column.id}>
              <EditableSelectCell
                value={value}
                options={CARRIER_OPTIONS}
                onCommit={(next) => updateCell(row.id, column.id, next)}
                placeholder="Carrier"
              />
            </TableCell>
          );
        }

        if (locked && LOCKED_AFTER_SCRAPE.has(column.id)) {
          return (
            <TableCell key={column.id}>
              <ReadOnlyCell value={value} />
            </TableCell>
          );
        }

        if (column.id === "aduana") {
          return (
            <TableCell key={column.id}>
              <EditableSelectCell
                value={value}
                options={SAT_OPTIONS.aduanas}
                onCommit={(next) => updateCell(row.id, column.id, next)}
                placeholder="Aduana"
              />
            </TableCell>
          );
        }

        if (column.id === "anio") {
          return (
            <TableCell key={column.id}>
              <EditableSelectCell
                value={value}
                options={SAT_OPTIONS.anios}
                onCommit={(next) => updateCell(row.id, column.id, next)}
                placeholder="Año"
              />
            </TableCell>
          );
        }

        return (
          <TableCell key={column.id}>
            <EditableCell
              value={value}
              onCommit={(next) => updateCell(row.id, column.id, next)}
            />
          </TableCell>
        );
      })}
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!row.detalle}
            onClick={() => navigate(`/detalle/${row.id}`)}
          >
            Detalle
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => removeRow(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {row.addedFromScrape && (
          <div className="mt-1 flex items-center gap-1">
            <Badge variant="warning" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Línea faltante agregada
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => acknowledgeRow(row.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {row.scrapeError && (
          <p className="mt-1 text-xs text-destructive">{row.scrapeError}</p>
        )}
      </TableCell>
    </TableRow>
  );
}
