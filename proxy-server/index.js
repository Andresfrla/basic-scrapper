import express from "express";
import cors from "cors";
import cepRoutes from "./routes/cep.js";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/cep", cepRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy SAT corriendo en :${PORT}`));