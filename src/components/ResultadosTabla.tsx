import { useNavigate } from "react-router-dom";
import { Trash2, FileText, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { CepResultadoResumen } from "../types/cep";

interface ResultadosTablaProps {
  resultados: CepResultadoResumen[];
  onLimpiar: () => void;
}

function getBadgeVariant(estado: string): "default" | "secondary" | "destructive" | "success" | "warning" | "outline" {
  const estadoLower = estado.toLowerCase();
  if (estadoLower.includes("pagado") || estadoLower.includes("completado") || estadoLower.includes("aprobado")) {
    return "success";
  }
  if (estadoLower.includes("pendiente") || estadoLower.includes("proceso")) {
    return "warning";
  }
  if (estadoLower.includes("error") || estadoLower.includes("fallido") || estadoLower.includes("rechazado")) {
    return "destructive";
  }
  return "secondary";
}

export function ResultadosTabla({ resultados, onLimpiar }: ResultadosTablaProps) {
  const navigate = useNavigate();
  
  console.log("🔍 ResultadosTabla - resultados recibidos:", resultados);

  const sortedResults = [...resultados].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  if (resultados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No hay resultados</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Realiza una consulta para ver los resultados aquí
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h3 className="font-medium">Resultados ({resultados.length})</h3>
        </div>
        <Button variant="destructive" size="sm" onClick={onLimpiar}>
          <Trash2 className="mr-2 h-4 w-4" />
          Limpiar tabla
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Identificador</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResults.map((resultado) => (
            <TableRow key={resultado.id}>
              <TableCell className="font-medium">{resultado.documento}</TableCell>
              <TableCell>
                <Badge variant={getBadgeVariant(resultado.estado)}>
                  {resultado.estado}
                </Badge>
              </TableCell>
              <TableCell>{resultado.fecha}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/detalle/${resultado.id}`)}
                >
                  Ver detalle
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}