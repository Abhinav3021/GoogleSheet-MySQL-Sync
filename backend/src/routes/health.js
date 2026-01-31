import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", async (req, res) => {
  return res.json({
    status: "ok",
    service: "sync-engine",
    ts: new Date().toISOString()
  });
});
