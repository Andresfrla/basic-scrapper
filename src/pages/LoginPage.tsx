import { useState, type FormEvent } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { login } from "../api/authApi";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(password);
      onLogin();
    } catch {
      setError("Clave incorrecta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Acceso</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="password">Clave</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
