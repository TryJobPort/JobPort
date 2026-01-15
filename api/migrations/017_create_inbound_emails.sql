-- 018_create_inbound_emails.sql

CREATE TABLE IF NOT EXISTS inbound_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  source TEXT NOT NULL,          -- "gmail", "forward", "webhook"
  from_email TEXT,
  to_email TEXT,
  subject TEXT,

  raw_body TEXT NOT NULL,        -- full raw payload (stringified)
  received_at TEXT NOT NULL,     -- ISO timestamp from provider
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  processed_at TEXT,             -- set later
  error TEXT                     -- parse/match failures
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_user
  ON inbound_emails(user_id);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_received
  ON inbound_emails(received_at);
