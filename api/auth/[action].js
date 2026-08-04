import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  hasValidAdminSession,
  verifyAdminPassword,
} from "../../services/adminSession.js";

export default function handler(req, res) {
  const { action } = req.query;
  if (action === "login" && req.method === "POST") {
    if (!verifyAdminPassword(req.body?.password)) return res.status(401).json({ error: "Clave incorrecta" });
    res.setHeader("Set-Cookie", createAdminSessionCookie());
    return res.json({ authenticated: true });
  }
  if (action === "session" && req.method === "GET") {
    return res.json({ authenticated: hasValidAdminSession(req) });
  }
  if (action === "logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", clearAdminSessionCookie());
    return res.json({ authenticated: false });
  }
  return res.status(405).json({ error: "Método no permitido" });
}
