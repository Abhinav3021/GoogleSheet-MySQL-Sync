import { broadcastEvent } from "../realtime/wsHub.js";
import { logger } from "../utils/logger.js";
import { fetchPendingEvents, markProcessed } from "../db/outbox.js";
import { upsertSheetRow, deleteSheetRow } from "./writeSheet.js";

export async function syncDbToSheet({ sheetsClient }) {
  const sheetId = process.env.SHEET_ID;
  const sheetName = process.env.SHEET_NAME || "Sheet1";

  const events = await fetchPendingEvents(20);
  if (!events.length) return { processed: 0 };

  const processedIds = [];

  for (const e of events) {
    try {
      if (e.event_type === "DELETE") {
        await deleteSheetRow({
          sheetsClient,
          sheetId,
          sheetName,
          rowId: e.row_id
        });

        broadcastEvent({
          type: "db_to_sheet_delete",
          message: `DB→Sheet delete id=${e.row_id}`,
          ts: new Date().toISOString()
        });
      } else {
        const rowObj = e.row_json;
        await upsertSheetRow({
          sheetsClient,
          sheetId,
          sheetName,
          rowObj
        });

        broadcastEvent({
          type: "db_to_sheet_upsert",
          message: `DB→Sheet upsert id=${e.row_id}`,
          ts: new Date().toISOString()
        });
      }

      processedIds.push(e.id);
    } catch (err) {
      logger.error({ err, eventId: e.id }, "❌ Failed processing outbox event");
    }
  }

  if (processedIds.length) {
    await markProcessed(processedIds);
  }

  return { processed: processedIds.length };
}
