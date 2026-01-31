import { logger } from "../utils/logger.js";
import { broadcastEvent } from "../realtime/wsHub.js";
import { stableStringify, sha256 } from "../utils/hash.js";
import { readSheetRows } from "./readSheet.js";
import { getRowById, upsertRow, listAllActiveIds, markDeleted } from "../db/syncedRows.js";

export async function syncSheetToDb({ sheetsClient }) {
  const sheetId = process.env.SHEET_ID;
  const sheetName = process.env.SHEET_NAME || "Sheet1";

  const { headers, rows } = await readSheetRows({ sheetsClient, sheetId, sheetName });

  broadcastEvent({
    type: "sheet_poll",
    message: `Polled sheet: rows=${rows.length}, headers=${headers.length}`,
    ts: new Date().toISOString()
  });

  const sheetIds = new Set();

  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const id = row.id;
    sheetIds.add(id);

    const rowHash = sha256(stableStringify(row));
    const existing = await getRowById(id);

    if (!existing) {
      try {
        await upsertRow({ id, rowJson: row, rowHash, source: "sheet", traceId: `sheet-${Date.now()}` });
        inserted++;
      } catch (err) {
        logger.error({ err, id }, "❌ Failed Sheet→DB upsert");
      }

      broadcastEvent({
        type: "sheet_to_db_insert",
        message: `Inserted row id=${id}`,
        ts: new Date().toISOString()
      });
      continue;
    }

    if (existing.row_hash !== rowHash || existing.deleted_at) {
      await upsertRow({ id, rowJson: row, rowHash });
      updated++;

      broadcastEvent({
        type: "sheet_to_db_update",
        message: `Updated row id=${id}`,
        ts: new Date().toISOString()
      });
    }
  }

  // detect deletions (soft delete)
  const dbIds = await listAllActiveIds();
  const toDelete = dbIds.filter((id) => !sheetIds.has(id));

  if (toDelete.length) {
    await markDeleted(toDelete);

    broadcastEvent({
      type: "sheet_to_db_delete",
      message: `Deleted rows (soft): ${toDelete.join(", ")}`,
      ts: new Date().toISOString()
    });
  }

  logger.info({ inserted, updated, deleted: toDelete.length }, "✅ Sheet→DB sync done");

  return { inserted, updated, deleted: toDelete.length };
}
