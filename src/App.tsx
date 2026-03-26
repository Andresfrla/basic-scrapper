import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConsultaPage } from "./pages/ConsultaPage";
import { DetallePage } from "./pages/DetallePage";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ConsultaPage />} />
          <Route path="/detalle/:id" element={<DetallePage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;