import { WebSocketServer } from "ws";
import { logger } from "../utils/logger.js";

let wss;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    logger.info("🟢 WebSocket client connected");

    socket.send(
      JSON.stringify({
        type: "system",
        message: "Connected to Sync Engine WS ✅",
        ts: new Date().toISOString()
      })
    );

    socket.on("close", () => {
      logger.info("🔴 WebSocket client disconnected");
    });
  });

  return wss;
}

export function broadcastEvent(event) {
  if (!wss) return;

  const msg = JSON.stringify(event);

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}
