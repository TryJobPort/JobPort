-- 014_create_oauth_accounts.sql
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,               -- 'google'
  provider_account_id TEXT,             -- Google sub (user id)
  email TEXT,                           -- Google email
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expires_at TEXT,                      -- ISO string
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_provider
  ON oauth_accounts(user_id, provider);
