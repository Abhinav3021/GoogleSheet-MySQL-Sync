USE syncdb;

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

DELIMITER $$

CREATE TRIGGER trg_synced_rows_insert
AFTER INSERT ON synced_rows
FOR EACH ROW
BEGIN
  INSERT INTO sync_outbox (event_type, row_id, row_json, row_hash, source)
  VALUES ('INSERT', NEW.id, NEW.row_json, NEW.row_hash, 'db');
END$$

CREATE TRIGGER trg_synced_rows_update
AFTER UPDATE ON synced_rows
FOR EACH ROW
BEGIN
  -- Only generate event if data actually changed
  IF (OLD.row_hash <> NEW.row_hash) OR (OLD.deleted_at <> NEW.deleted_at) THEN
    INSERT INTO sync_outbox (event_type, row_id, row_json, row_hash, source)
    VALUES (
      IF(NEW.deleted_at IS NULL, 'UPDATE', 'DELETE'),
      NEW.id,
      NEW.row_json,
      NEW.row_hash,
      'db'
    );
  END IF;
END$$

DELIMITER ;
