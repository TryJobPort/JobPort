CREATE TABLE IF NOT EXISTS application_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  prev_signal_mark TEXT,
  next_signal_mark TEXT,
  drift_detected INTEGER DEFAULT 0,
  checked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_events_user ON application_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_app ON application_events(application_id);
CREATE INDEX IF NOT EXISTS idx_app_events_checked ON application_events(checked_at);
