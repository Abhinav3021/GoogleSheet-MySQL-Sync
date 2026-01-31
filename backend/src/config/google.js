import fs from "fs";
import { google } from "googleapis";
import { logger } from "../utils/logger.js";

export function getSheetsClient() {
  // ✅ Production: use env JSON
  if (process.env.GOOGLE_CREDS_JSON) {
    logger.info("✅ Using GOOGLE_CREDS_JSON from env");

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDS_JSON),
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ]
    });

    return google.sheets({ version: "v4", auth });
  }

  // ✅ Local: use JSON file
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

  logger.info("✅ Using local service-account.json file");
  return google.sheets({ version: "v4", auth });
}
