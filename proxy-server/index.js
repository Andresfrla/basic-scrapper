import "dotenv/config";
import express from "express";
import cors from "cors";
import cepRoutes from "./routes/cep.js";
import sheetRoutes from "./routes/sheet.js";
import autoScrapeRoutes from "./routes/autoScrape.js";
import authRoutes from "./routes/auth.js";
import notificationContactsRoutes from "./routes/notificationContacts.js";
import notificationDispatchRoutes from "./routes/notificationDispatch.js";
import { hasValidAdminSession } from "../services/adminSession.js";

function requireAdmin(req, res, next) {
  if (!hasValidAdminSession(req)) return res.status(401).json({ error: "Sesión requerida" });
  next();
}

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/sat/auto-scrape", autoScrapeRoutes);
app.use("/api/notifications/dispatch", notificationDispatchRoutes);
app.use("/api/cep", requireAdmin, cepRoutes);
app.use("/api/sheet", requireAdmin, sheetRoutes);
app.use("/api/notifications", requireAdmin, notificationContactsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy SAT corriendo en :${PORT}`));
