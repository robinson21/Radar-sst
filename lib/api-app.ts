import cors from "cors";
import express from "express";
import {
  addWatchTopic,
  getDashboard,
  getSources,
  initializeService,
  resetState,
  runScan,
  saveCompanyProfile,
  updateObligationStatus,
  updateWatchStatus,
} from "./compliance-service";

export function createApiApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", async (_req, res) => {
    await initializeService();
    res.json({ status: "ok" });
  });

  app.get("/api/dashboard", async (_req, res) => {
    res.json(await getDashboard());
  });

  app.get("/api/sources", async (_req, res) => {
    res.json(await getSources());
  });

  app.post("/api/scan", async (_req, res) => {
    res.json(await runScan("manual"));
  });

  app.post("/api/company-profile", async (req, res) => {
    res.json(await saveCompanyProfile(req.body ?? {}));
  });

  app.post("/api/watch-requests", async (req, res) => {
    try {
      res.json(await addWatchTopic(String(req.body?.topic ?? "")));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Tema inválido." });
    }
  });

  app.patch("/api/watch-requests/:id", async (req, res) => {
    const status = req.body?.status;
    if (!status || !["activo", "cubierto", "en_revision"].includes(status)) {
      return res.status(400).json({ error: "Estado inválido." });
    }
    try {
      res.json(await updateWatchStatus(req.params.id, status));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Solicitud no encontrada." });
    }
  });

  app.patch("/api/obligations/:id", async (req, res) => {
    const status = req.body?.status;
    if (!status || !["pendiente", "en_progreso", "cumplido"].includes(status)) {
      return res.status(400).json({ error: "Estado inválido." });
    }
    try {
      res.json(await updateObligationStatus(req.params.id, status));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "Obligación no encontrada." });
    }
  });

  app.post("/api/reset", async (_req, res) => {
    res.json(await resetState());
  });

  return app;
}
