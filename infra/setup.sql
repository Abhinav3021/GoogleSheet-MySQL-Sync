-- ============================================================
-- Google Sheet ↔ MySQL Sync
-- One-shot setup script for schema + triggers
-- DB: syncdb
-- ============================================================

-- Ensure DB exists (optional; safe)
CREATE DATABASE IF NOT EXISTS syncdb;
USE syncdb;

-- ============================================================
-- 1) Main storage: synced_rows (schema agnostic JSON store)
-- ============================================================
CREATE TABLE IF NOT EXISTS synced_rows (
  id VARCHAR(128) PRIMARY KEY,
  row_json JSON NOT NULL,
  row_hash CHAR(64) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- Add columns required for loop prevention (safe rerun)
-- MySQL doesn't support IF NOT EXISTS in ADD COLUMN in older versions,
-- so we use "try/catch style" approach via INFORMATION_SCHEMA checks.
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'synced_rows'
    AND COLUMN_NAME = 'source'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE synced_rows ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT ''sheet'';',
  'SELECT ''synced_rows.source already exists'';'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'synced_rows'
    AND COLUMN_NAME = 'trace_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE synced_rows ADD COLUMN trace_id VARCHAR(64) NULL;',
  'SELECT ''synced_rows.trace_id already exists'';'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2) Sync metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_state (
  state_key VARCHAR(64) PRIMARY KEY,
  state_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 3) Transactional Outbox (DB -> Sheet propagation)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_outbox (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  row_id VARCHAR(128) NOT NULL,
  row_json JSON NULL,
  row_hash CHAR(64) NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'db',
  trace_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  INDEX idx_processed (processed_at),
  INDEX idx_row_id (row_id)
);

-- ============================================================
-- 4) Triggers
--    - Emit outbox events ONLY when source='db'
--    - Prevent loop: sheet writes should not create outbox events
-- ============================================================

DROP TRIGGER IF EXISTS trg_synced_rows_insert;
DROP TRIGGER IF EXISTS trg_synced_rows_update;

DELIMITER $$

CREATE TRIGGER trg_synced_rows_insert
AFTER INSERT ON synced_rows
FOR EACH ROW
BEGIN
  IF NEW.source = 'db' THEN
    INSERT INTO sync_outbox (event_type, row_id, row_json, row_hash, source, trace_id)
    VALUES ('INSERT', NEW.id, NEW.row_json, NEW.row_hash, NEW.source, NEW.trace_id);
  END IF;
END$$

CREATE TRIGGER trg_synced_rows_update
AFTER UPDATE ON synced_rows
FOR EACH ROW
BEGIN
  IF NEW.source = 'db' THEN
    IF (OLD.row_hash <> NEW.row_hash) OR (OLD.deleted_at <> NEW.deleted_at) THEN
      INSERT INTO sync_outbox (event_type, row_id, row_json, row_hash, source, trace_id)
      VALUES (
        IF(NEW.deleted_at IS NULL, 'UPDATE', 'DELETE'),
        NEW.id,
        NEW.row_json,
        NEW.row_hash,
        NEW.source,
        NEW.trace_id
      );
    END IF;
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- Done
-- ============================================================
SELECT '✅ setup.sql applied successfully' AS status;
