import { Router } from "express";
import { getSheetsClient } from "../config/google.js";

export const sheetDebugRouter = Router();

sheetDebugRouter.get("/debug/sheet", async (req, res) => {
  const sheetId = process.env.SHEET_ID;
  const sheetName = process.env.SHEET_NAME || "Sheet1";

  const sheets = getSheetsClient();
  const range = `${sheetName}!A:Z`;

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });

  return res.json({
    ok: true,
    sheetId,
    sheetName,
    sample: (result.data.values || []).slice(0, 5)
  });
});
