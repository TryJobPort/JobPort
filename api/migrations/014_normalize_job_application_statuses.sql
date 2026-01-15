-- 014_normalize_job_application_statuses.sql
-- Normalizes obvious variants to canonical strings.

UPDATE applications SET status = 'Under Review'
WHERE lower(trim(status)) IN ('under_review','under-review','in review','in_review','review');

UPDATE applications SET status = 'Interview'
WHERE lower(trim(status)) IN ('interviewing','phone screen','phone_screen','screen','onsite','on-site');

UPDATE applications SET status = 'Offer'
WHERE lower(trim(status)) IN ('offered');

UPDATE applications SET status = 'Rejected'
WHERE lower(trim(status)) IN ('declined','not selected','no longer under consideration','closed');

-- Ensure applied variants
UPDATE applications SET status = 'Applied'
WHERE status IS NULL OR trim(status) = '';
