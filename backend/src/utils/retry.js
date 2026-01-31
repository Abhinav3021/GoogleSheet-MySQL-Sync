import { logger } from "./logger.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGoogleError(err) {
  const code = err?.code || err?.response?.status;

  // common retryable codes
  if ([408, 409, 429, 500, 502, 503, 504].includes(code)) return true;

  // socket level transient issues
  const msg = String(err?.message || "").toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up") ||
    msg.includes("etimedout")
  ) {
    return true;
  }

  return false;
}

/**
 * Retry wrapper with exponential backoff + jitter
 */
export async function withRetry(
  fn,
  {
    retries = 4,
    baseDelayMs = 250,
    maxDelayMs = 4000,
    label = "operation"
  } = {}
) {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;

      const retryable = isRetryableGoogleError(err);
      const code = err?.code || err?.response?.status;

      if (!retryable || attempt > retries) {
        logger.error(
          { attempt, retries, code, err },
          `❌ ${label} failed (no more retries)`
        );
        throw err;
      }

      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 150);
      const waitMs = exp + jitter;

      logger.warn(
        { attempt, retries, code, waitMs },
        `⚠️ ${label} failed; retrying...`
      );

      await sleep(waitMs);
    }
  }
}
