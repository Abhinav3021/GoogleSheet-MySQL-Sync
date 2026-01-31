import mysql from "mysql2/promise";
import { logger } from "../utils/logger.js";

export const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function checkDbConnection() {
  const conn = await db.getConnection();
  await conn.ping();
  conn.release();
  logger.info("✅ MySQL connected");
}
