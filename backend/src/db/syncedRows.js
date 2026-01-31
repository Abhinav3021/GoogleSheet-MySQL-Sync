import { db } from "./mysql.js";

export async function getRowById(id) {
  const [rows] = await db.query(
    "SELECT id, row_hash, deleted_at FROM synced_rows WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

export async function upsertRow({ id, rowJson, rowHash, source = "sheet", traceId = null }) {
  await db.query(
    `
    INSERT INTO synced_rows (id, row_json, row_hash, deleted_at, source, trace_id)
    VALUES (?, CAST(? AS JSON), ?, NULL, ?, ?)
    ON DUPLICATE KEY UPDATE
      row_json = VALUES(row_json),
      row_hash = VALUES(row_hash),
      deleted_at = NULL,
      source = VALUES(source),
      trace_id = VALUES(trace_id)
    `,
    [id, JSON.stringify(rowJson), rowHash, source, traceId]
  );
}


export async function markDeleted(idsToDelete) {
  if (!idsToDelete.length) return;

  await db.query(
    `
    UPDATE synced_rows
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id IN (${idsToDelete.map(() => "?").join(",")})
    `,
    idsToDelete
  );
}

export async function listAllActiveIds() {
  const [rows] = await db.query(
    "SELECT id FROM synced_rows WHERE deleted_at IS NULL"
  );
  return rows.map((r) => r.id);
}
