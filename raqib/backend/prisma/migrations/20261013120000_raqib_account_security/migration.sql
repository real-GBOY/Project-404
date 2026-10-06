-- Raqib — account security.
--
-- Two tables that belong to the person (global identity), not to one tenant, so they carry no organization_id:
--   raqib_account_security  second factor (TOTP secret sealed with the data key, recovery-code hashes) and the date the
--                           password last changed (drives rotation).
--   raqib_auth_throttle     wrong-password counters and lock-outs per e-mail address, read before sign-in.
-- Both are reached only by server code running as the system role.

CREATE TABLE "raqib_account_security" (
  "user_id"             TEXT NOT NULL,
  "password_changed_at" TIMESTAMPTZ(6),
  "mfa_secret"          TEXT,
  "mfa_enabled_at"      TIMESTAMPTZ(6),
  "mfa_last_step"       BIGINT,
  "mfa_recovery"        JSONB NOT NULL DEFAULT '[]',
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_account_security_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "raqib_account_security_user_fk" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_account_security_mfa_check" CHECK (("mfa_enabled_at" IS NULL) OR ("mfa_secret" IS NOT NULL))
);

CREATE TABLE "raqib_auth_throttle" (
  "email_normalized" TEXT NOT NULL,
  "failures"         INTEGER NOT NULL DEFAULT 0,
  "first_failure_at" TIMESTAMPTZ(6) NOT NULL,
  "locked_until"     TIMESTAMPTZ(6),
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_auth_throttle_pkey" PRIMARY KEY ("email_normalized")
);
