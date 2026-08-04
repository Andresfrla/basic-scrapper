export type MetodoConsulta = "pedimento" | "vin" | "contenedor";

export interface ConsultaParams {
  metodo: MetodoConsulta;
  valor: string;
  aduana?: string;
  anio?: string;
  patente?: string;
}

export interface CepResultadoResumen {
  id: string;
  documento: string;
  estado: string;
  fecha: string;
  secuencia: string;
  numeroOperacion: string;
  factura: string;
  metodoConsulta: MetodoConsulta;
  detalle: CepDetalle;
}

export interface CepDetalle {
  documento: string;
  aduana: string;
  anio: string;
  patente: string;
  numeroPedimento: string;
  situacionPedimento: string;
  estado: string;
  fecha: string;
  numeroOperacion: string;
  estadoPago: CepEstadoPago;
}

export interface CepEstadoPago {
  banco: string;
  monto: string;
  numeroOperacion: string;
  fechaPago: string;
  lineaCaptura: string;
  estado: string;
  lineaCapturaSecundaria?: string;
}