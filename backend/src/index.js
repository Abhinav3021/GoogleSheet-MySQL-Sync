import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

import { logger } from "./utils/logger.js";
import { checkDbConnection } from "./db/mysql.js";
import { initWebSocket, broadcastEvent } from "./realtime/wsHub.js";
import { healthRouter } from "./routes/health.js";
import { getSheetsClient } from "./config/google.js";
import { startPoller } from "./sync/poller.js";
import { syncSheetToDb } from "./sync/sheetToDb.js";
import { syncDbToSheet } from "./sync/dbToSheet.js";

import { dbOpsRouter } from "./routes/dbOps.js";
import { dbReadRouter } from "./routes/dbRead.js";
import { dbDeleteRouter } from "./routes/dbDelete.js";
import { outboxRouter } from "./routes/outbox.js";
import { sheetOpsRouter } from "./routes/sheetOps.js";
import { debugRouter } from "./routes/debug.js";
import {sheetDebugRouter} from "./routes/debug_sheet.js";



const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.DASHBOARD_ORIGIN,
    credentials: true
  })
);

app.use("/api", healthRouter);
app.use("/api", dbOpsRouter);
app.use("/api", dbReadRouter);
app.use("/api", dbDeleteRouter);
app.use("/api", outboxRouter);
app.use("/api", sheetOpsRouter);
app.use("/api", debugRouter);
app.use("/api", sheetDebugRouter);


app.get("/", (req, res) => {
  res.send("Sync Engine Running ✅");
});

const server = http.createServer(app);
initWebSocket(server);

const PORT = process.env.PORT || 8080;

async function boot() {
  try {
    await checkDbConnection();

    const sheetsClient = getSheetsClient();

    const interval = Number(process.env.POLL_INTERVAL_MS || 3000);

    startPoller({
    intervalMs: interval,
    fn: async () => {
        await syncSheetToDb({ sheetsClient });
    }
    });

    startPoller({
    intervalMs: 1500,
    fn: async () => {
        await syncDbToSheet({ sheetsClient });
    }
    });

    server.listen(PORT, () => {
      logger.info(`🚀 Backend running on http://localhost:${PORT}`);

      // Emit boot event to dashboard
      broadcastEvent({
        type: "system",
        message: "Sync Engine started ✅",
        ts: new Date().toISOString()
      });
    });
  } catch (err) {
    logger.error(err, "❌ Failed to boot backend");
    process.exit(1);
  }
}

boot();
