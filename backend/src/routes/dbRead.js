import { Router } from "express";
import { db } from "../db/mysql.js";

export const dbReadRouter = Router();

dbReadRouter.get("/db/rows", async (req, res) => {
  const [rows] = await db.query(`
    SELECT id, row_json, row_hash, deleted_at, updated_at, source
    FROM synced_rows
    ORDER BY updated_at DESC
    LIMIT 50
  `);

  return res.json({ ok: true, rows });
});
