import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface DetallePedimentoProps {
  documento: string;
  aduana: string;
  anio: string;
  patente: string;
  numeroPedimento: string;
  situacionPedimento: string;
  estado: string;
  fecha: string;
  numeroOperacion: string;
}

const val = (v: string) => v || "—";

export function DetallePedimento({
  documento,
  aduana,
  anio,
  patente,
  numeroPedimento,
  situacionPedimento,
  estado,
  fecha,
  numeroOperacion,
}: DetallePedimentoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Pedimento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Documento</p>
            <p className="font-medium">{val(documento)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Aduana</p>
            <p className="font-medium">{val(aduana)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Año</p>
            <p className="font-medium">{val(anio)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Patente</p>
            <p className="font-medium">{val(patente)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Número de Pedimento</p>
            <p className="font-medium">{val(numeroPedimento)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Situación del Pedimento</p>
            <p className="font-medium">{val(situacionPedimento)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="font-medium">{val(estado)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fecha</p>
            <p className="font-medium">{val(fecha)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Número de Operación</p>
            <p className="font-medium">{val(numeroOperacion)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}