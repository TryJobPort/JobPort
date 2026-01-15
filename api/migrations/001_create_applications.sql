-- api/migrations/001_create_applications.sql

CREATE TABLE IF NOT EXISTS applications (
  id              TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,

  company         TEXT NOT NULL,
  role            TEXT NOT NULL,
  portal          TEXT,              -- e.g. Workday / Greenhouse / Lever
  status          TEXT NOT NULL,      -- e.g. Applied / Under Review / Rejected
  url             TEXT NOT NULL,

  last_checked_at TEXT,              -- ISO string

  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
