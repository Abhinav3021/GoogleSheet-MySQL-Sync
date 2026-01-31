# Architecture

## Overview
This project implements a **production-style 2-way near-real-time synchronization system** between:

- **Google Sheets** (collaborative, multi-user editing)
- **MySQL** (structured persistent storage)

Any change in either system is propagated to the other with minimal delay.

The implementation is designed to be:
- schema-agnostic (works for any sheet/table columns)
- idempotent (no duplicate updates)
- scalable (outbox pattern)
- observable (live event stream dashboard)

---

## Components

### 1) Dashboard (Next.js)
A real-time monitoring/testing UI to:
- view sync events live (WebSocket)
- trigger DB insert/update/delete
- trigger Sheet append
- view MySQL table (`synced_rows`) directly

**Tech:** Next.js App Router + Tailwind CSS + native WebSocket

---

### 2) Sync Engine (Node.js Backend)
A backend service responsible for:
- polling Google Sheets for changes (Sheet → DB)
- consuming DB change events (DB → Sheet)
- exposing test APIs for dashboard controls
- broadcasting events to dashboard via WebSocket

**Tech:** Node.js, Express, WebSocket (`ws`), Google Sheets API (`googleapis`), MySQL2, Pino Logger

---

### 3) MySQL Database
MySQL stores synced state and acts as persistent system-of-record.

Key tables:
- `synced_rows`: latest state of rows (JSON + hash)
- `sync_outbox`: DB-side change events (outbox pattern)
- `sync_state`: cursors/metadata for future scaling

---

## Data Model

### `synced_rows`
Stores the current canonical row state.

Columns:
- `id` (PK): unique row identifier
- `row_json`: row payload stored as JSON (schema agnostic)
- `row_hash`: sha256 hash of stable JSON (change detection)
- `updated_at`: timestamp when row was written
- `deleted_at`: soft delete marker
- `source`: writer identity (`sheet` or `db`) used to prevent sync loops
- `trace_id`: correlation id for observability

---

### `sync_outbox`
Transactional Outbox table for DB → Sheet propagation.

Columns:
- `event_type`: INSERT | UPDATE | DELETE
- `row_id`: affected row id
- `row_json`: payload for INSERT/UPDATE
- `processed_at`: event is pending until processed

Events are emitted using MySQL triggers only for writes where `source='db'`.

---

## Sync Flows

### A) Sheet → DB Sync
**Mechanism:** Polling + hashing

1. Polls Google sheet every `POLL_INTERVAL_MS`.
2. Reads header row to infer schema dynamically.
3. Converts each sheet row to JSON object.
4. Computes `row_hash` for each row.
5. If row not present in DB → insert.
6. If hash differs → update.
7. If row removed from sheet → DB soft delete (`deleted_at`).

**Why polling?**
Google Sheets doesn’t provide reliable row-level push notifications for multi-user edits. Polling is a robust mechanism for eventual consistency.

---

### B) DB → Sheet Sync
**Mechanism:** MySQL triggers + outbox pattern + worker

1. A DB write happens (via dashboard API or SQL).
2. Trigger inserts a change event into `sync_outbox`.
3. Backend worker polls pending outbox events.
4. Worker upserts/deletes corresponding rows in Google Sheet.

**Advantages**
- resilient to backend restart
- ordered processing
- scalable and decoupled

---

## Loop Prevention
Without protection, changes would echo forever:

Sheet → DB → Sheet → DB ...

Solution:
- Sheet sync writes DB rows with `source='sheet'`
- DB sync writes rows with `source='db'`
- MySQL triggers emit outbox events ONLY when `source='db'`

---

## Retry Strategy (Google API Reliability)
Google Sheets API calls may fail transiently due to:
- 429 rate limiting
- 503 temporary server errors
- network timeouts

A retry wrapper is used with:
- exponential backoff
- jitter
- selective retry on retryable errors only

---

## Conflict Resolution Policy (Bonus)
This system follows an **eventual consistency** model with **Last Write Wins (LWW)** semantics.

### Rules
1. DB events are ordered deterministically by outbox auto increment id.
2. Sheet updates are captured during polling.
3. If the same `id` is edited on both sides within the conflict window:
   - whichever update is processed last becomes final state (LWW)
4. Loop prevention ensures the system does not echo updates.

### Rationale
Strict locking between a collaborative Sheet and a DB is not user-friendly. LWW provides predictable behavior while keeping system scalable.

---

## Observability
The backend emits events via WebSocket that include:
- sheet polls
- inserts/updates/deletes sheet→db
- inserts/updates/deletes db→sheet
- errors / retries

The dashboard acts as a live system monitor.

---
