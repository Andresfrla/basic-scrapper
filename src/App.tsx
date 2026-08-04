import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { ConsultaPage } from "./pages/ConsultaPage";
import { DetallePage } from "./pages/DetallePage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationSettingsPage } from "./pages/NotificationSettingsPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button } from "./components/ui/button";
import { useSheetStore } from "./store/useSheetStore";
import { getSession, logout } from "./api/authApi";

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const loadRows = useSheetStore((state) => state.loadRows);
  useEffect(() => { void loadRows(); }, [loadRows]);

  return (
    <BrowserRouter>
      <nav className="border-b bg-white px-4 py-2 flex items-center gap-4 text-sm">
        <Link to="/" className="font-medium hover:underline">Pedimentos</Link>
        <Link to="/notificaciones" className="font-medium hover:underline">Notificaciones</Link>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onLogout}>Salir</Button>
      </nav>
      <Routes>
        <Route path="/" element={<ConsultaPage />} />
        <Route path="/detalle/:id" element={<DetallePage />} />
        <Route path="/notificaciones" element={<NotificationSettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => { void getSession().then(setAuthenticated).catch(() => setAuthenticated(false)); }, []);

  if (authenticated === null) return <p className="p-6">Cargando...</p>;
  if (!authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;
  return (
    <ErrorBoundary>
      <AuthenticatedApp onLogout={() => { void logout().finally(() => setAuthenticated(false)); }} />
    </ErrorBoundary>
  );
}

export default App;
