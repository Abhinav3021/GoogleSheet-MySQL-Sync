import { Router } from "express";
import * as z from "zod";
import { db } from "../db/mysql.js";

export const dbDeleteRouter = Router();

dbDeleteRouter.post("/db/delete", async (req, res) => {
  try {
    const schema = z.object({
      id: z.string()
    });

    const { id } = schema.parse(req.body);

    // soft delete: triggers will push DELETE event
    await db.query(
      `
      UPDATE synced_rows
      SET deleted_at = CURRENT_TIMESTAMP,
          source = 'db',
          trace_id = ?
      WHERE id = ?
      `,
      [`manual-del-${Date.now()}`, id]
    );

    return res.json({ ok: true, id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err?.message || "Bad request" });
  }
});
