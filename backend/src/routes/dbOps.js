import { Router } from "express";
import { z } from "zod";
import { upsertRow } from "../db/syncedRows.js";
import { stableStringify, sha256 } from "../utils/hash.js";

export const dbOpsRouter = Router();

dbOpsRouter.post("/db/upsert", async (req, res) => {
  const schema = z.object({
    id: z.string(),
    data: z.record(z.any())
  });

  const { id, data } = schema.parse(req.body);

  const rowObj = { id, ...data };
  const rowHash = sha256(stableStringify(rowObj));

  // source = db => triggers fire => sheet updates
  await upsertRow({
    id,
    rowJson: rowObj,
    rowHash,
    source: "db",
    traceId: `manual-${Date.now()}`
  });

  return res.json({ ok: true, id });
});
