import { Router } from "express";
import { db } from "../db/mysql.js";

export const debugRouter = Router();

debugRouter.get("/debug/db", async (req, res) => {
  const [[dbName]] = await db.query("SELECT DATABASE() AS db");
  const [tables] = await db.query("SHOW TABLES");

  return res.json({
    ok: true,
    database: dbName.db,
    tables
  });
});
