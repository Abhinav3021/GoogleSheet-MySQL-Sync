import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

export async function getSheetValues({ sheetsClient, sheetId, sheetName }) {
  const range = `${sheetName}!A:ZZ`;

  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });

  return res.data.values || [];
}

export async function upsertSheetRow({ sheetsClient, sheetId, sheetName, rowObj }) {
  const values = await getSheetValues({ sheetsClient, sheetId, sheetName });
  if (values.length === 0) throw new Error("Sheet empty: missing headers");

  const headers = values[0].map((h) => String(h || "").trim());
  const idColIndex = headers.findIndex((h) => h.toLowerCase() === "id");

  if (idColIndex === -1) throw new Error("Sheet must have `id` column");

  const id = String(rowObj.id);

  // find row index
  let foundRowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const cellId = row[idColIndex];
    if (String(cellId) === id) {
      foundRowIndex = i;
      break;
    }
  }

  // convert to sheet row array aligned with headers
  const rowArray = headers.map((h) => {
    const key = h.trim().toLowerCase();
    return rowObj[key] ?? "";
  });

  if (foundRowIndex === -1) {
    // append row
    await withRetry(
      () =>
        sheetsClient.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: `${sheetName}!A1`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [rowArray] }
        }),
      { label: `sheets.append id=${id}` }
    );

    logger.info(`✅ Appended row id=${id} to sheet`);
    return;
  }

  // update existing row
  const sheetRowNumber = foundRowIndex + 1;
  const updateRange = `${sheetName}!A${sheetRowNumber}:ZZ${sheetRowNumber}`;

  await withRetry(
      () =>
        sheetsClient.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: updateRange,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [rowArray] }
        }),
      { label: `sheets.update id=${id}` }
    );

      logger.info(`✅ Updated sheet row id=${id}`);
    }

export async function deleteSheetRow({ sheetsClient, sheetId, sheetName, rowId }) {
  const values = await getSheetValues({ sheetsClient, sheetId, sheetName });
  if (values.length === 0) return;

  const headers = values[0].map((h) => String(h || "").trim());
  const idColIndex = headers.findIndex((h) => h.toLowerCase() === "id");
  if (idColIndex === -1) return;

  const id = String(rowId);

  let foundRowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[idColIndex]) === id) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex === -1) return;

  // This is tricky: Google Sheets API delete row needs sheetId grid id.
  // We'll implement "soft delete" in Sheet by clearing row instead (safe for demo).
  const sheetRowNumber = foundRowIndex + 1;

  await withRetry(
    () =>
      sheetsClient.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${sheetRowNumber}:ZZ${sheetRowNumber}`
      }),
    { label: `sheets.clear id=${id}` }
  );


  logger.info(`✅ Cleared (soft deleted) sheet row id=${id}`);
}
