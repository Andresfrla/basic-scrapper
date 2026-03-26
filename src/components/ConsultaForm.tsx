import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { SAT_OPTIONS, SAT_DEFAULTS } from "../constants/satOptions";
import type { MetodoConsulta, ConsultaParams } from "../types/cep";

interface ConsultaFormProps {
  onSubmit: (params: ConsultaParams) => Promise<void>;
  isLoading: boolean;
}

export function ConsultaForm({ onSubmit, isLoading }: ConsultaFormProps) {
  const [metodo, setMetodo] = useState<MetodoConsulta>("pedimento");
  const [aduana, setAduana] = useState<string>(SAT_DEFAULTS.aduana);
  const [anio, setAnio] = useState<string>(SAT_DEFAULTS.anio);
  const [patente, setPatente] = useState("");
  const [valor, setValor] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submit, params:", { metodo, valor, aduana, anio, patente });
    
    if (!valor.trim()) {
      alert("Por favor ingresa un valor para buscar");
      return;
    }
    
    const params: ConsultaParams = {
      metodo,
      valor,
      anio,
    };

    if (metodo === "pedimento" || metodo === "contenedor") {
      params.aduana = aduana;
    }

    if (metodo === "pedimento") {
      if (!patente.trim()) {
        alert("Por favor ingresa la patente");
        return;
      }
      params.patente = patente;
    }

    console.log("🚀 handleSubmit: Llamando a onSubmit con:", params);
    await onSubmit(params);
    console.log("🚀 handleSubmit: onSubmit completado");
  };

  const showAduana = metodo === "pedimento" || metodo === "contenedor";
  const showPatente = metodo === "pedimento";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consulta CEP</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metodo">Método de consulta</Label>
            <Select
              value={metodo}
              onValueChange={(value: string) => setMetodo(value as MetodoConsulta)}
            >
              <SelectTrigger id="metodo">
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pedimento">Pedimento</SelectItem>
                <SelectItem value="vin">VIN</SelectItem>
                <SelectItem value="contenedor">Contenedor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showAduana && (
            <div className="space-y-2">
              <Label htmlFor="aduana">Aduana</Label>
              <Select value={aduana} onValueChange={setAduana}>
                <SelectTrigger id="aduana">
                  <SelectValue placeholder="Seleccionar aduana" />
                </SelectTrigger>
                <SelectContent>
                  {SAT_OPTIONS.aduanas.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="anio">Año</Label>
            <Select value={anio} onValueChange={setAnio}>
              <SelectTrigger id="anio">
                <SelectValue placeholder="Seleccionar año" />
              </SelectTrigger>
              <SelectContent>
                {SAT_OPTIONS.anios.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showPatente && (
            <div className="space-y-2">
              <Label htmlFor="patente">Patente</Label>
              <Input
                id="patente"
                value={patente}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatente(e.target.value)}
                placeholder="Número de patente"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="valor">
              {metodo === "pedimento" && "Número de pedimento"}
              {metodo === "vin" && "Número de VIN"}
              {metodo === "contenedor" && "Número de contenedor"}
            </Label>
            <Input
              id="valor"
              value={valor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValor(e.target.value)}
              placeholder={
                metodo === "pedimento" ? "Número de pedimento" :
                metodo === "vin" ? "Número de VIN" :
                "Número de contenedor"
              }
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Consultar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}