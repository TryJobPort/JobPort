ALTER TABLE inbound_emails ADD COLUMN text_body TEXT;
ALTER TABLE inbound_emails ADD COLUMN html_body TEXT;
ALTER TABLE inbound_emails ADD COLUMN normalized_subject TEXT;
ALTER TABLE inbound_emails ADD COLUMN normalized_from TEXT;
ALTER TABLE inbound_emails ADD COLUMN normalized_to TEXT;
