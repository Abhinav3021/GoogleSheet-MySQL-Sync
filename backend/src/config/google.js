import fs from "fs";
import { google } from "googleapis";
import { logger } from "../utils/logger.js";

export function getSheetsClient() {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credsPath || !fs.existsSync(credsPath)) {
    throw new Error(`Google creds JSON not found at: ${credsPath}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credsPath,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive"
    ]
  });

  logger.info("✅ GoogleAuth initialized");

  return google.sheets({ version: "v4", auth });
}
