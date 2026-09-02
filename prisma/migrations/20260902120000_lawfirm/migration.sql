-- Mizan law-firm product domain (mizan/backend/app/lawfirm/*).
--
-- One migration for the whole domain: tables, composite (organization_id, id)
-- unique keys, composite FKs to the parent (invariant #5 — a child tagged with
-- the wrong tenant is rejected by the FK, not a trigger), string-union CHECK
-- constraints, updated_at triggers, list indexes, and tenant_isolation RLS on
-- every table (§ docs/tenancy.md — copied from the user_roles policy in
-- 20260901120100_multitenancy_rls).
--
-- Hand-written (like the baseline) rather than diffed by `prisma migrate dev`;
-- the prisma/schema/lawfirm-*.prisma models mirror these tables for the
-- Prisma -> Kysely type generator only.

-- ===========================================================================
-- CRM: clients + contacts
-- ===========================================================================
CREATE TABLE "lawfirm_clients" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'active',
  "email"           TEXT,
  "phone"           TEXT,
  "tax_id"          TEXT,
  "address"         TEXT,
  "notes"           TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_clients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_clients_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "lawfirm_clients_type_check" CHECK ("type" IN ('company', 'individual')),
  CONSTRAINT "lawfirm_clients_status_check" CHECK ("status" IN ('active', 'archived'))
);
CREATE INDEX "lawfirm_clients_org_idx" ON "lawfirm_clients" ("organization_id");

CREATE TABLE "lawfirm_contacts" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "client_id"       TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "role"            TEXT,
  "email"           TEXT,
  "phone"           TEXT,
  "is_primary"      BOOLEAN NOT NULL DEFAULT false,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_contacts_client_fk" FOREIGN KEY ("organization_id", "client_id")
    REFERENCES "lawfirm_clients" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_contacts_client_idx" ON "lawfirm_contacts" ("organization_id", "client_id");

-- ===========================================================================
-- Matters + participants + timeline updates + notes
-- ===========================================================================
CREATE TABLE "lawfirm_matters" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "reference"       TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "client_id"       TEXT NOT NULL,
  "practice_area"   TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'open',
  "court"           TEXT,
  "lead_lawyer_id"  TEXT NOT NULL,
  "opened_at"       TIMESTAMPTZ(6) NOT NULL,
  "closed_at"       TIMESTAMPTZ(6),
  "description"     TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_matters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_matters_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "lawfirm_matters_reference_uq" UNIQUE ("organization_id", "reference"),
  CONSTRAINT "lawfirm_matters_status_check" CHECK ("status" IN ('open', 'on_hold', 'closed')),
  CONSTRAINT "lawfirm_matters_client_fk" FOREIGN KEY ("organization_id", "client_id")
    REFERENCES "lawfirm_clients" ("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_matters_org_idx" ON "lawfirm_matters" ("organization_id");
CREATE INDEX "lawfirm_matters_client_idx" ON "lawfirm_matters" ("organization_id", "client_id");
CREATE INDEX "lawfirm_matters_status_idx" ON "lawfirm_matters" ("organization_id", "status");

CREATE TABLE "lawfirm_matter_participants" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "matter_id"       TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "role"            TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_matter_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_matter_participants_uq" UNIQUE ("organization_id", "matter_id", "user_id"),
  CONSTRAINT "lawfirm_matter_participants_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_matter_participants_matter_idx" ON "lawfirm_matter_participants" ("organization_id", "matter_id");

CREATE TABLE "lawfirm_matter_updates" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "matter_id"       TEXT NOT NULL,
  "author_id"       TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_matter_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_matter_updates_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "lawfirm_matter_updates_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_matter_updates_matter_idx" ON "lawfirm_matter_updates" ("organization_id", "matter_id");

CREATE TABLE "lawfirm_matter_update_files" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "matter_update_id" TEXT NOT NULL,
  "document_id"      TEXT NOT NULL,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_matter_update_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_matter_update_files_update_fk" FOREIGN KEY ("organization_id", "matter_update_id")
    REFERENCES "lawfirm_matter_updates" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_matter_update_files_update_idx" ON "lawfirm_matter_update_files" ("organization_id", "matter_update_id");

CREATE TABLE "lawfirm_matter_notes" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "matter_id"       TEXT NOT NULL,
  "author_id"       TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_matter_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_matter_notes_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_matter_notes_matter_idx" ON "lawfirm_matter_notes" ("organization_id", "matter_id");

-- ===========================================================================
-- Hearings + calendar events
-- ===========================================================================
CREATE TABLE "lawfirm_hearings" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "matter_id"       TEXT NOT NULL,
  "court"           TEXT NOT NULL,
  "scheduled_at"    TIMESTAMPTZ(6) NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'scheduled',
  "purpose"         TEXT NOT NULL,
  "outcome"         TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_hearings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_hearings_status_check" CHECK ("status" IN ('scheduled', 'adjourned', 'decided')),
  CONSTRAINT "lawfirm_hearings_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_hearings_org_idx" ON "lawfirm_hearings" ("organization_id");
CREATE INDEX "lawfirm_hearings_matter_idx" ON "lawfirm_hearings" ("organization_id", "matter_id");
CREATE INDEX "lawfirm_hearings_scheduled_idx" ON "lawfirm_hearings" ("organization_id", "scheduled_at");

CREATE TABLE "lawfirm_calendar_events" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "kind"            TEXT NOT NULL DEFAULT 'meeting',
  "start_at"        TIMESTAMPTZ(6) NOT NULL,
  "end_at"          TIMESTAMPTZ(6),
  "matter_id"       TEXT,
  "owner_id"        TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_calendar_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_calendar_events_kind_check" CHECK ("kind" IN ('meeting', 'reminder', 'court_filing', 'other')),
  CONSTRAINT "lawfirm_calendar_events_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_calendar_events_org_idx" ON "lawfirm_calendar_events" ("organization_id");
CREATE INDEX "lawfirm_calendar_events_start_idx" ON "lawfirm_calendar_events" ("organization_id", "start_at");

-- ===========================================================================
-- Tasks
-- ===========================================================================
CREATE TABLE "lawfirm_tasks" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "matter_id"       TEXT,
  "assignee_id"     TEXT,
  "status"          TEXT NOT NULL DEFAULT 'todo',
  "priority"        TEXT NOT NULL DEFAULT 'normal',
  "due_at"          TIMESTAMPTZ(6),
  "completed_at"    TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_tasks_status_check" CHECK ("status" IN ('todo', 'in_progress', 'done')),
  CONSTRAINT "lawfirm_tasks_priority_check" CHECK ("priority" IN ('low', 'normal', 'high')),
  CONSTRAINT "lawfirm_tasks_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_tasks_org_idx" ON "lawfirm_tasks" ("organization_id");
CREATE INDEX "lawfirm_tasks_matter_idx" ON "lawfirm_tasks" ("organization_id", "matter_id");
CREATE INDEX "lawfirm_tasks_assignee_idx" ON "lawfirm_tasks" ("organization_id", "assignee_id");
CREATE INDEX "lawfirm_tasks_status_idx" ON "lawfirm_tasks" ("organization_id", "status");

-- ===========================================================================
-- Documents (metadata; bytes in core/files)
-- ===========================================================================
CREATE TABLE "lawfirm_documents" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "matter_id"       TEXT,
  "category"        TEXT NOT NULL DEFAULT 'Other',
  "status"          TEXT NOT NULL DEFAULT 'draft',
  "file_id"         TEXT NOT NULL,
  "size_bytes"      BIGINT NOT NULL DEFAULT 0,
  "mime_type"       TEXT NOT NULL DEFAULT 'application/octet-stream',
  "uploaded_by_id"  TEXT NOT NULL,
  "uploaded_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_documents_status_check" CHECK ("status" IN ('draft', 'final', 'filed', 'signed')),
  CONSTRAINT "lawfirm_documents_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_documents_org_idx" ON "lawfirm_documents" ("organization_id");
CREATE INDEX "lawfirm_documents_matter_idx" ON "lawfirm_documents" ("organization_id", "matter_id");
CREATE INDEX "lawfirm_documents_status_idx" ON "lawfirm_documents" ("organization_id", "status");

-- ===========================================================================
-- Billing: invoices, lines, payments, expenses
-- ===========================================================================
CREATE TABLE "lawfirm_invoices" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "number"          TEXT NOT NULL,
  "client_id"       TEXT NOT NULL,
  "matter_id"       TEXT,
  "status"          TEXT NOT NULL DEFAULT 'draft',
  "currency"        TEXT NOT NULL DEFAULT 'EGP',
  "issued_at"       TIMESTAMPTZ(6),
  "due_at"          TIMESTAMPTZ(6),
  "vat_rate"        DECIMAL(6,4) NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_invoices_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "lawfirm_invoices_number_uq" UNIQUE ("organization_id", "number"),
  CONSTRAINT "lawfirm_invoices_status_check" CHECK ("status" IN ('draft', 'issued', 'sent', 'paid', 'void')),
  CONSTRAINT "lawfirm_invoices_currency_check" CHECK ("currency" IN ('EGP', 'AED', 'USD', 'SAR')),
  CONSTRAINT "lawfirm_invoices_client_fk" FOREIGN KEY ("organization_id", "client_id")
    REFERENCES "lawfirm_clients" ("organization_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lawfirm_invoices_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_invoices_org_idx" ON "lawfirm_invoices" ("organization_id");
CREATE INDEX "lawfirm_invoices_client_idx" ON "lawfirm_invoices" ("organization_id", "client_id");
CREATE INDEX "lawfirm_invoices_matter_idx" ON "lawfirm_invoices" ("organization_id", "matter_id");
CREATE INDEX "lawfirm_invoices_status_idx" ON "lawfirm_invoices" ("organization_id", "status");

CREATE TABLE "lawfirm_invoice_lines" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "invoice_id"      TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "amount"          DECIMAL(14,2) NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_invoice_lines_kind_check" CHECK ("kind" IN ('fee', 'disbursement')),
  CONSTRAINT "lawfirm_invoice_lines_invoice_fk" FOREIGN KEY ("organization_id", "invoice_id")
    REFERENCES "lawfirm_invoices" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_invoice_lines_invoice_idx" ON "lawfirm_invoice_lines" ("organization_id", "invoice_id");

CREATE TABLE "lawfirm_payments" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "invoice_id"      TEXT NOT NULL,
  "amount"          DECIMAL(14,2) NOT NULL,
  "currency"        TEXT NOT NULL,
  "method"          TEXT NOT NULL,
  "received_at"     TIMESTAMPTZ(6) NOT NULL,
  "reference"       TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_payments_currency_check" CHECK ("currency" IN ('EGP', 'AED', 'USD', 'SAR')),
  CONSTRAINT "lawfirm_payments_method_check" CHECK ("method" IN ('bank_transfer', 'cheque', 'cash', 'card')),
  CONSTRAINT "lawfirm_payments_invoice_fk" FOREIGN KEY ("organization_id", "invoice_id")
    REFERENCES "lawfirm_invoices" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_payments_invoice_idx" ON "lawfirm_payments" ("organization_id", "invoice_id");
CREATE INDEX "lawfirm_payments_received_idx" ON "lawfirm_payments" ("organization_id", "received_at");

CREATE TABLE "lawfirm_expenses" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "matter_id"       TEXT,
  "description"     TEXT NOT NULL,
  "category"        TEXT NOT NULL DEFAULT 'Disbursement',
  "amount"          DECIMAL(14,2) NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'EGP',
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "incurred_at"     TIMESTAMPTZ(6) NOT NULL,
  "submitted_by_id" TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_expenses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_expenses_currency_check" CHECK ("currency" IN ('EGP', 'AED', 'USD', 'SAR')),
  CONSTRAINT "lawfirm_expenses_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "lawfirm_expenses_matter_fk" FOREIGN KEY ("organization_id", "matter_id")
    REFERENCES "lawfirm_matters" ("organization_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "lawfirm_expenses_org_idx" ON "lawfirm_expenses" ("organization_id");
CREATE INDEX "lawfirm_expenses_matter_idx" ON "lawfirm_expenses" ("organization_id", "matter_id");
CREATE INDEX "lawfirm_expenses_status_idx" ON "lawfirm_expenses" ("organization_id", "status");

-- ===========================================================================
-- Staff profiles + firm settings
-- ===========================================================================
CREATE TABLE "lawfirm_staff_profiles" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "user_id"               TEXT NOT NULL,
  "title"                 TEXT NOT NULL DEFAULT 'Associate',
  "phone"                 TEXT,
  "practice_areas"        TEXT[] NOT NULL DEFAULT '{}',
  "status"                TEXT NOT NULL DEFAULT 'active',
  "weekly_capacity_hours" INTEGER NOT NULL DEFAULT 40,
  "bar_admission"         TEXT,
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_staff_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lawfirm_staff_profiles_user_uq" UNIQUE ("organization_id", "user_id"),
  CONSTRAINT "lawfirm_staff_profiles_status_check" CHECK ("status" IN ('active', 'inactive'))
);
CREATE INDEX "lawfirm_staff_profiles_org_idx" ON "lawfirm_staff_profiles" ("organization_id");

CREATE TABLE "lawfirm_settings" (
  "organization_id"      TEXT NOT NULL,
  "firm_name"            TEXT NOT NULL DEFAULT '',
  "registration_number"  TEXT NOT NULL DEFAULT '',
  "address"              TEXT NOT NULL DEFAULT '',
  "default_currency"     TEXT NOT NULL DEFAULT 'EGP',
  "vat_rate"             DECIMAL(6,4) NOT NULL DEFAULT 0,
  "matter_types"         TEXT[] NOT NULL DEFAULT '{}',
  "courts"               TEXT[] NOT NULL DEFAULT '{}',
  "standard_rates"       JSONB NOT NULL DEFAULT '[]',
  "ai_assistant_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_settings_pkey" PRIMARY KEY ("organization_id"),
  CONSTRAINT "lawfirm_settings_currency_check" CHECK ("default_currency" IN ('EGP', 'AED', 'USD', 'SAR'))
);

-- ===========================================================================
-- Activity feed + reminders
-- ===========================================================================
CREATE TABLE "lawfirm_activity_entries" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "actor_id"        TEXT,
  "action"          TEXT NOT NULL,
  "target_type"     TEXT NOT NULL,
  "target_id"       TEXT NOT NULL,
  "target_label"    TEXT NOT NULL,
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_activity_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lawfirm_activity_entries_at_idx" ON "lawfirm_activity_entries" ("organization_id", "at");
CREATE INDEX "lawfirm_activity_entries_target_idx" ON "lawfirm_activity_entries" ("organization_id", "target_type", "target_id");

CREATE TABLE "lawfirm_reminders" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "matter_id"       TEXT,
  "title"           TEXT NOT NULL,
  "due_at"          TIMESTAMPTZ(6) NOT NULL,
  "done_at"         TIMESTAMPTZ(6),
  "owner_id"        TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lawfirm_reminders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lawfirm_reminders_due_idx" ON "lawfirm_reminders" ("organization_id", "due_at");

-- ===========================================================================
-- updated_at triggers (auric_set_updated_at() defined in the constraints
-- migration 20260829120100)
-- ===========================================================================
CREATE TRIGGER lawfirm_clients_set_updated_at        BEFORE UPDATE ON "lawfirm_clients"        FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_contacts_set_updated_at       BEFORE UPDATE ON "lawfirm_contacts"       FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_matters_set_updated_at        BEFORE UPDATE ON "lawfirm_matters"        FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_matter_notes_set_updated_at   BEFORE UPDATE ON "lawfirm_matter_notes"   FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_hearings_set_updated_at       BEFORE UPDATE ON "lawfirm_hearings"       FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_calendar_events_set_updated_at BEFORE UPDATE ON "lawfirm_calendar_events" FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_tasks_set_updated_at          BEFORE UPDATE ON "lawfirm_tasks"          FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_documents_set_updated_at      BEFORE UPDATE ON "lawfirm_documents"      FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_invoices_set_updated_at       BEFORE UPDATE ON "lawfirm_invoices"       FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_expenses_set_updated_at       BEFORE UPDATE ON "lawfirm_expenses"       FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_staff_profiles_set_updated_at BEFORE UPDATE ON "lawfirm_staff_profiles" FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_settings_set_updated_at       BEFORE UPDATE ON "lawfirm_settings"       FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER lawfirm_reminders_set_updated_at      BEFORE UPDATE ON "lawfirm_reminders"      FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation on every table (§ docs/tenancy.md).
-- Identical shape to the user_roles policy in 20260901120100_multitenancy_rls:
-- a row is visible / writable only when its organization_id equals the active
-- tenant. current_setting(..., true) is NULL/'' outside a tenant context, which
-- never matches an org id, so the safe default is "see nothing / write nothing".
-- FORCE so the table owner is filtered too.
-- (GRANTs to auric_app / auric_system are covered by ALTER DEFAULT PRIVILEGES
-- in 20260901120100.)
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lawfirm_clients', 'lawfirm_contacts', 'lawfirm_matters',
    'lawfirm_matter_participants', 'lawfirm_matter_updates',
    'lawfirm_matter_update_files', 'lawfirm_matter_notes', 'lawfirm_hearings',
    'lawfirm_calendar_events', 'lawfirm_tasks', 'lawfirm_documents',
    'lawfirm_invoices', 'lawfirm_invoice_lines', 'lawfirm_payments',
    'lawfirm_expenses', 'lawfirm_staff_profiles', 'lawfirm_settings',
    'lawfirm_activity_entries', 'lawfirm_reminders'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = current_setting(''app.organization_id'', true))
         WITH CHECK (organization_id = current_setting(''app.organization_id'', true))',
      t
    );
  END LOOP;
END $$;
