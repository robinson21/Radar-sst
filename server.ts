import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createApiApp } from "./lib/api-app";
import { initializeService, runScan } from "./lib/compliance-service";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scanIntervalMinutes = Number(process.env.SCAN_INTERVAL_MINUTES ?? 1440);

async function startServer() {
  await initializeService();

  const app = express();
  const port = Number(process.env.PORT ?? 3000);

  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  app.use(createApiApp());

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { port: 24679 } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  setInterval(() => {
    void runScan("automatic");
  }, scanIntervalMinutes * 60_000);

  app.listen(port, "0.0.0.0", () => {
    console.log(`SST monitor running on http://localhost:${port}`);
  });
}

void startServer();
