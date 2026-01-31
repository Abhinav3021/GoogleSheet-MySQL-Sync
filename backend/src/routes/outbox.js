import { Router } from "express";
import { db } from "../db/mysql.js";

export const outboxRouter = Router();

outboxRouter.get("/outbox/stats", async (req, res) => {
  const [[pending]] = await db.query(`
    SELECT COUNT(*) AS cnt
    FROM sync_outbox
    WHERE processed_at IS NULL
  `);

  return res.json({ ok: true, pending: pending.cnt });
});
