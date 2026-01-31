# Edge Cases & Nuances Handled

This document lists edge cases and robustness considerations handled in the system.

---

## Google Sheets Side

### 1) Multi-user / Multiplayer edits
- Multiple users can edit concurrently.
- Polling + hashing captures the latest state consistently.

### 2) Empty rows / partially filled rows
- Empty rows ignored.
- Rows missing `id` are skipped safely.

### 3) Header normalization
- Header cells are normalized:
  - trimmed
  - spaces → underscores
  - symbols removed
  - lowercase
Example: `First Name` → `first_name`

### 4) Missing `id` header
- System expects `id` column as primary key.
- Warning logged if header[0] is not `id`.
- Rows without resolvable `id` are skipped (safe behavior).

### 5) Large sheets
- Reads range `A:ZZ`.
- Can be optimized later via incremental processing and batching.

---

## MySQL Side

### 6) Schema agnostic data model
- `row_json` stores row state as JSON.
- No migrations needed for new columns in sheet.

### 7) Soft delete handling
- If row removed in sheet → mark DB row deleted (`deleted_at`).
- If row deleted in DB → sheet row cleared (soft delete representation).

### 8) Idempotency
- `row_hash` avoids repeated updates when row has not changed.
- ensures stable behavior across restarts and polling cycles.

---

## Synchronization System

### 9) Avoiding infinite loops
- `source` tagging prevents echo updates.
- triggers emit events only for `source='db'`.

### 10) No overlapping poller cycles
- Poller has `running` lock to prevent concurrent execution.

### 11) Worker failure resilience
- If DB→sheet write fails, outbox event stays pending.
- system retries on next worker run.

### 12) Ordering guarantees
- DB outbox events processed in ascending `id`.
- deterministic ordering ensures correctness.

### 13) Retry handling for Google Sheets API
- Transient failures (429/503/timeout) are retried automatically using exponential backoff + jitter.

---

## Conflict Handling (Bonus)

### 14) Concurrent updates on same row
- When same `id` updated in Sheet and DB in short window:
  - conflict resolved by **Last Write Wins**
  - final state = whichever event processed last

### 15) Conflict window definition
- conflict window is approximately equal to the polling interval.
- lowering `POLL_INTERVAL_MS` reduces conflict window but increases API calls.

---

## Observability

### 16) Real-time event stream
- All key sync actions broadcast to dashboard via WebSocket:
  - sheet_poll
  - sheet_to_db_insert/update/delete
  - db_to_sheet_upsert/delete
  - errors and retries

### 17) Debug endpoints (dashboard driven)
- DB rows visible (`synced_rows`)
- Outbox pending visible (`sync_outbox` pending count)

---

## Not Implemented (Explicit / Future Enhancements)
- True hard-delete row in Google Sheet using batchUpdate + gridId
- Stronger conflict resolution using version clocks / revision history
- Debezium CDC for high-scale MySQL capture
- Google batchUpdate for large scale performance optimization
