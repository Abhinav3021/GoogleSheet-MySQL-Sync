import { Router } from "express";
import * as z from "zod";
import { getSheetsClient } from "../config/google.js";

export const sheetOpsRouter = Router();

sheetOpsRouter.post("/sheet/append", async (req, res) => {
  try {
    const schema = z.object({
      id: z.string(),
      data: z.record(z.any()).default({})
    });

    const { id, data } = schema.parse(req.body);

    const sheetId = process.env.SHEET_ID;
    const sheetName = process.env.SHEET_NAME || "Sheet1";

    const sheetsClient = getSheetsClient();

    // fetch headers first
    const range = `${sheetName}!A:ZZ`;
    const existing = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range
    });

    const values = existing.data.values || [];
    if (values.length === 0) throw new Error("Sheet has no header row");

    const headers = values[0].map((h) => String(h || "").trim());
    const headerKeys = headers.map((h) => h.toLowerCase());

    // build row according to headers
    const rowObj = { id, ...data };
    const rowArray = headerKeys.map((k) => (rowObj[k] ?? "").toString());

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowArray] }
    });

    return res.json({ ok: true, id });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err?.message || "Bad request" });
  }
});
