ALTER TABLE applications ADD COLUMN consecutive_scan_failures INTEGER DEFAULT 0;
ALTER TABLE applications ADD COLUMN last_scan_error TEXT;
ALTER TABLE applications ADD COLUMN last_failed_at DATETIME;
