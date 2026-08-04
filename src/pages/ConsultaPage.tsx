import { SheetTable } from "../components/SheetTable";

export function ConsultaPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Seguimiento de Pedimentos</h1>
      <SheetTable />
    </div>
  );
}
