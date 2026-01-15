ALTER TABLE application_events ADD COLUMN prev_status_signal TEXT;
ALTER TABLE application_events ADD COLUMN next_status_signal TEXT;
ALTER TABLE application_events ADD COLUMN status_changed INTEGER DEFAULT 0;
