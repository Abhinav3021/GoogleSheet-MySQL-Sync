import { logger } from "../utils/logger.js";
import { normalizeHeader, normalizeCellValue } from "../utils/normalize.js";

export async function readSheetRows({ sheetsClient, sheetId, sheetName }) {
  // We fetch full used range
  const safeSheetName = `'${sheetName.replace(/'/g, "''")}'`;
  const range = `${safeSheetName}!A:ZZ`;

  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });
  logger.info({ sheetName }, "Using SHEET_NAME");

  const values = res.data.values || [];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = values[0];
  const headers = rawHeaders.map(normalizeHeader);

  // Ensure headers exist
  if (!headers[0] || headers[0] !== "id") {
    logger.warn("⚠️ First header is not `id`. We will still proceed but id mapping may break.");
  }

  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const rowArr = values[i];
    const rowObj = {};

    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      rowObj[key] = normalizeCellValue(rowArr[c]);
    }

    // require at least one value
    const id = rowObj["id"];
    if (!id) continue;

    rows.push(rowObj);
  }

  return { headers, rows };
}
