import express from "express";
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  hasValidAdminSession,
  verifyAdminPassword,
} from "../../services/adminSession.js";

const router = express.Router();

router.post("/login", (req, res) => {
  if (!verifyAdminPassword(req.body?.password)) return res.status(401).json({ error: "Clave incorrecta" });
  res.setHeader("Set-Cookie", createAdminSessionCookie());
  return res.json({ authenticated: true });
});
router.get("/session", (req, res) => res.json({ authenticated: hasValidAdminSession(req) }));
router.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearAdminSessionCookie());
  return res.json({ authenticated: false });
});

export default router;
