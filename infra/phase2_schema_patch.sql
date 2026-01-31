USE syncdb;

ALTER TABLE synced_rows
  ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'sheet';

ALTER TABLE synced_rows
  ADD COLUMN trace_id VARCHAR(64) NULL;

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
    IF (OLD.row_hash <> NEW.row_hash) OR NOT (OLD.deleted_at <=> NEW.deleted_at) THEN
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
