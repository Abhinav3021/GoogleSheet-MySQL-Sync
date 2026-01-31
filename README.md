# Google Sheet ↔ MySQL Two-Way Live Sync

A production-style **2-way near-real-time sync** system between:
- **Google Sheets** (collaborative editing)
- **MySQL** (persistent database)

Includes a real-time **Next.js Dashboard** for monitoring and testing.

---

## Demo Capabilities

✅ Sheet → DB sync (polling + hashing)  
✅ DB → Sheet sync (triggers + transactional outbox worker)  
✅ Loop prevention (`source` tagging)  
✅ Soft delete propagation  
✅ Retry mechanism (Google API resilience)  
✅ Real-time dashboard events via WebSocket  
✅ Test UI controls (upsert/delete DB, append Sheet)

---

## Tech Stack

### Backend
- Node.js + Express
- MySQL (`mysql2`)
- Google Sheets API (`googleapis`)
- WebSocket (`ws`)
- Logging (`pino`)

### Dashboard
- Next.js App Router
- Tailwind CSS

### Infra
- MySQL 8 (Docker)
- Redis (Docker - optional, for future scaling)

---

## Repository Structure
```
sheet-mysql-sync/
├── backend/
├── dashboard/
├── infra/
└── docs/
```

---

## Local Setup

### 1) Start Infrastructure

From repo root:
```bash
docker compose -f infra/docker-compose.yml up -d
```

### 2) Setup Google Credentials

1. Create Google Cloud project
2. Enable:
   - Google Sheets API
   - Google Drive API
3. Create a Service Account + download JSON key
4. Put it in: `backend/creds/service-account.json`
5. Share your Google Sheet with the service account email (`client_email`) as **Editor**

### 3) Backend Environment

Create `backend/.env`:
```env
PORT=8080

MYSQL_HOST=localhost
MYSQL_PORT=3307
MYSQL_USER=syncuser
MYSQL_PASSWORD=syncpass
MYSQL_DATABASE=syncdb

DASHBOARD_ORIGIN=http://localhost:3000

GOOGLE_APPLICATION_CREDENTIALS=./creds/service-account.json
SHEET_ID=<YOUR_SHEET_ID>
SHEET_NAME=Sheet1

POLL_INTERVAL_MS=3000
```

### 4) Setup Database Schema (single command)

**Linux/macOS:**
```bash
docker exec -i sync_mysql mysql -uroot -proot < infra/setup.sql
```

**Windows PowerShell:**
```powershell
Get-Content -Raw .\infra\setup.sql | docker exec -i sync_mysql mysql -uroot -proot
```

### 5) Run Backend
```bash
cd backend
npm install
npm run dev
```

Backend:
- HTTP: `http://localhost:8080`
- WebSocket: `ws://localhost:8080/ws`

### 6) Run Dashboard
```bash
cd dashboard
npm install
npm run dev
```

Dashboard: `http://localhost:3000`

---

## Usage

### Sheet → DB Sync
1. Edit cells in Google Sheet
2. Backend polls every 3s (configurable)
3. Detects changes via row hashing
4. Updates MySQL + broadcasts WS event

### DB → Sheet Sync
1. Insert/update/delete via dashboard or direct DB
2. Triggers write to `outbox` table
3. Worker polls outbox, writes to Sheet
4. Marks outbox row as `processed`

### Loop Prevention
- Each sync operation tags rows with `source` (sheet/db)
- Prevents infinite ping-pong

---

## Project Architecture
```
┌─────────────────┐         ┌──────────────┐
│  Google Sheets  │◄────────┤   Backend    │
│                 │────────►│   (Node.js)  │
└─────────────────┘         └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │    MySQL     │
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │  Dashboard   │
                            │  (Next.js)   │
                            └──────────────┘
```

---

## API Endpoints

### Backend

**Health Check:**
```
GET /health
```

**Test DB Upsert:**
```
POST /test/db-upsert
Body: { "id": "1", "name": "Test", "email": "test@example.com" }
```

**Test DB Delete:**
```
POST /test/db-delete
Body: { "id": "1" }
```

**Test Sheet Append:**
```
POST /test/sheet-append
Body: { "id": "999", "name": "New Row", "email": "new@example.com" }
```

---

## WebSocket Events

Dashboard receives real-time events:
```json
{
  "type": "sheet_poll",
  "message": "Polled sheet: rows=5, headers=3",
  "ts": "2025-01-31T10:00:00.000Z"
}
```

Event types:
- `sheet_poll`
- `sheet_to_db_insert`
- `sheet_to_db_update`
- `sheet_to_db_delete`
- `db_to_sheet_insert`
- `db_to_sheet_update`
- `db_to_sheet_delete`
- `sync_error`

---

## Database Schema

### `synced_rows`
- `id` (VARCHAR, PK)
- `row_json` (JSON)
- `row_hash` (VARCHAR)
- `source` (ENUM: 'sheet', 'db')
- `created_at`, `updated_at`, `deleted_at`

### `outbox`
- `id` (INT, AUTO_INCREMENT)
- `operation` (ENUM: 'insert', 'update', 'delete')
- `row_id` (VARCHAR)
- `row_json` (JSON)
- `processed` (BOOLEAN)
- `created_at`

---

## Troubleshooting

### "Unable to parse range" Error

**Cause:** Sheet name in `.env` doesn't match actual Google Sheet tab name.

**Solution:**
1. Open your Google Sheet
2. Check the tab name at the bottom (e.g., "Sheet1", "Data", etc.)
3. Update `.env`:
```env
   SHEET_NAME=Sheet1  # Use exact tab name
```
4. Restart backend

### Google API 403 Error

**Cause:** Service account doesn't have access to the sheet.

**Solution:**
1. Open your Google Sheet
2. Click "Share"
3. Add service account email (from `service-account.json` → `client_email`)
4. Grant "Editor" permissions

### MySQL Connection Error

**Cause:** Docker container not running or wrong credentials.

**Solution:**
```bash
# Check if MySQL container is running
docker ps

# If not running, start it
docker compose -f infra/docker-compose.yml up -d

# Verify connection
docker exec -it sync_mysql mysql -uroot -proot -e "SHOW DATABASES;"
```

### WebSocket Not Connecting

**Cause:** CORS or port mismatch.

**Solution:**
1. Verify `DASHBOARD_ORIGIN` in backend `.env` matches dashboard URL
2. Check backend logs for WebSocket connection attempts
3. Ensure no firewall blocking port 8080

---

## Development Notes

### Adding New Columns

1. Add column to Google Sheet
2. Update `infra/setup.sql` to include new column in `row_json`
3. Re-run schema setup (will preserve existing data)
4. Restart backend

### Adjusting Poll Interval

In `backend/.env`:
```env
POLL_INTERVAL_MS=5000  # 5 seconds
```

### Logs

Backend uses Pino logger:
- Development: Pretty-printed to console
- Production: JSON format for log aggregation

---

## Production Considerations

⚠️ **This is a demo project.** For production:

1. **Rate Limiting:** Google Sheets API has quotas
2. **Authentication:** Add API keys/JWT for dashboard
3. **Scalability:** Use Redis for distributed locking
4. **Error Handling:** Implement dead-letter queue for failed syncs
5. **Monitoring:** Add APM (e.g., Datadog, New Relic)
6. **Security:** Encrypt sensitive data, use secrets management
7. **Batching:** Batch Sheet API calls to reduce quota usage

---

## License

MIT

---

## Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions

---

## Acknowledgments

- Google Sheets API documentation
- MySQL Triggers & Events best practices
- Next.js App Router patterns