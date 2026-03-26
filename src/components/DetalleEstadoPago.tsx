import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import type { CepEstadoPago } from "../types/cep";

interface DetalleEstadoPagoProps {
  estadoPago: CepEstadoPago;
}

const val = (v: string) => v || "—";

export function DetalleEstadoPago({ estadoPago }: DetalleEstadoPagoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Estado de Pago</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Banco</p>
            <p className="font-medium">{val(estadoPago.banco)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monto</p>
            <p className="font-medium">{val(estadoPago.monto)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Número de Operación</p>
            <p className="font-medium">{val(estadoPago.numeroOperacion)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fecha de Pago</p>
            <p className="font-medium">{val(estadoPago.fechaPago)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Línea de Captura</p>
            <p className="font-medium">{val(estadoPago.lineaCaptura)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="font-medium">{val(estadoPago.estado)}</p>
          </div>
          {estadoPago.lineaCapturaSecundaria && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Línea de Captura (Secundaria)</p>
              <p className="font-medium">{estadoPago.lineaCapturaSecundaria}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}