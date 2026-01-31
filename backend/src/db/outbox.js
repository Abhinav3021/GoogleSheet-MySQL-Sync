import { db } from "./mysql.js";

export async function fetchPendingEvents(limit = 25) {
  const [rows] = await db.query(
    `
    SELECT id, event_type, row_id, row_json, source, trace_id
    FROM sync_outbox
    WHERE processed_at IS NULL
    ORDER BY id ASC
    LIMIT ?
    `,
    [limit]
  );
  return rows;
}

export async function markProcessed(eventIds) {
  if (!eventIds.length) return;

  await db.query(
    `
    UPDATE sync_outbox
    SET processed_at = CURRENT_TIMESTAMP
    WHERE id IN (${eventIds.map(() => "?").join(",")})
    `,
    eventIds
  );
}
