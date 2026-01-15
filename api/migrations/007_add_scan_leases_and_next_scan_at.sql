ALTER TABLE applications ADD COLUMN next_scan_at TEXT;
ALTER TABLE applications ADD COLUMN scan_locked_until TEXT;
ALTER TABLE applications ADD COLUMN scan_lock_owner TEXT;
ALTER TABLE applications ADD COLUMN scan_lock_token TEXT;

ALTER TABLE applications ADD COLUMN last_scan_ok_at TEXT;
ALTER TABLE applications ADD COLUMN last_scan_error_at TEXT;
ALTER TABLE applications ADD COLUMN consecutive_scan_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN last_scan_error_code TEXT;
ALTER TABLE applications ADD COLUMN last_scan_error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_apps_next_scan_at ON applications(next_scan_at);
CREATE INDEX IF NOT EXISTS idx_apps_scan_locked_until ON applications(scan_locked_until);
