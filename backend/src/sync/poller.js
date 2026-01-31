import { logger } from "../utils/logger.js";

export function startPoller({ fn, intervalMs }) {
  let running = false;

  async function tick() {
    if (running) return; // avoid overlapping runs
    running = true;

    try {
      await fn();
    } catch (err) {
      logger.error(err, "❌ Poller tick failed");
    } finally {
      running = false;
    }
  }

  tick();
  setInterval(tick, intervalMs);

  logger.info(`⏳ Poller started interval=${intervalMs}ms`);
}
