import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/button";
import { DetallePedimento } from "../components/DetallePedimento";
import { DetalleEstadoPago } from "../components/DetalleEstadoPago";
import { useResultsStore } from "../store/useResultsStore";

export function DetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { resultados } = useResultsStore();

  const resultado = resultados.find((r) => r.id === id);

  if (!resultado) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Registro no encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            El registro solicitado no existe o fue eliminado de la tabla de resultados.
          </p>
        </div>
      </div>
    );
  }

  const { detalle } = resultado;

  return (
    <div className="container mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <h1 className="text-2xl font-bold mb-6">Detalle del Registro</h1>

      <div className="space-y-6">
        <DetallePedimento
          documento={detalle.documento}
          aduana={detalle.aduana}
          anio={detalle.anio}
          patente={detalle.patente}
          numeroPedimento={detalle.numeroPedimento}
          situacionPedimento={detalle.situacionPedimento}
          estado={detalle.estado}
          fecha={detalle.fecha}
          numeroOperacion={detalle.numeroOperacion}
        />

        <DetalleEstadoPago estadoPago={detalle.estadoPago} />
      </div>
    </div>
  );
}