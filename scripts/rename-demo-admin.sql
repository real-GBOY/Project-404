-- One-off data patch for an already-seeded deployment.
--
-- DemoSeeder skips a database that already has the demo org, so changing the
-- name in demo-data.ts does not reach a box that was seeded earlier. This
-- reconciles the live `users` row for the demo Managing Partner (usr_dev) with
-- the current demo-data.ts. Idempotent; safe to run more than once.
--
--   ssh -i me ubuntu@13.220.157.42 "sudo -u postgres psql -d auric -v ON_ERROR_STOP=1" < scripts/rename-demo-admin.sql
--
-- (adjust -d if AURIC_DATABASE_URL in /opt/mizan/.env names a different database)

UPDATE users
   SET display_name     = 'Mahmoud Nayel',
       email            = 'mahmoud.nayel@tawfikpartners.eg',
       email_normalized = 'mahmoud.nayel@tawfikpartners.eg'
 WHERE email = 'amira.tawfik@tawfikpartners.eg';

SELECT id, display_name, email FROM users WHERE display_name = 'Mahmoud Nayel';
