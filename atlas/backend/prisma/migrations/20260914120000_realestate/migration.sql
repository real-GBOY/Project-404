-- Atlas real-estate product domain (app/realestate/*).
--
-- One migration for the whole domain, same shape as Mizan's own
-- 20260902120000_lawfirm migration: composite (organization_id, id) unique
-- keys, composite FKs to the parent (a child tagged with the wrong tenant is
-- rejected by the FK, not a trigger), string-union CHECK constraints,
-- updated_at triggers, list indexes, and tenant_isolation RLS on every table
-- (auric_set_updated_at() and the auric_app/auric_system grants already exist
-- from the copied Core baseline migrations that precede this one).
--
-- Hand-written rather than diffed by `prisma migrate dev`; the
-- prisma/schema/realestate-*.prisma models mirror these tables for the
-- Prisma -> Kysely type generator only.

-- ===========================================================================
-- Properties: projects, buildings, units, price lists
-- ===========================================================================
CREATE TABLE "realestate_projects" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "slug"               TEXT NOT NULL,
  "location"           TEXT NOT NULL,
  "developer"          TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'launched',
  "total_units"        INTEGER NOT NULL DEFAULT 0,
  "sold_units"         INTEGER NOT NULL DEFAULT 0,
  "reserved_units"     INTEGER NOT NULL DEFAULT 0,
  "available_units"    INTEGER NOT NULL DEFAULT 0,
  "total_value_egp"    BIGINT NOT NULL DEFAULT 0,
  "revenue_egp"        BIGINT NOT NULL DEFAULT 0,
  "velocity_per_week"  NUMERIC(6,2) NOT NULL DEFAULT 0,
  "sell_through_pct"   NUMERIC(5,2) NOT NULL DEFAULT 0,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_projects_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_projects_org_slug_uq" UNIQUE ("organization_id", "slug"),
  CONSTRAINT "realestate_projects_status_check" CHECK ("status" IN ('pre-launch', 'launched', 'under-construction', 'delivered'))
);
CREATE INDEX "realestate_projects_org_idx" ON "realestate_projects" ("organization_id");

CREATE TABLE "realestate_buildings" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "project_id"        TEXT NOT NULL,
  "key"               TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "floors"            INTEGER NOT NULL,
  "units_per_floor"   INTEGER NOT NULL,
  "handover_date"     DATE,
  "status"            TEXT NOT NULL DEFAULT 'under-construction',
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_buildings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_buildings_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_buildings_project_key_uq" UNIQUE ("organization_id", "project_id", "key"),
  CONSTRAINT "realestate_buildings_status_check" CHECK ("status" IN ('pre-launch', 'launched', 'under-construction', 'delivered')),
  CONSTRAINT "realestate_buildings_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "realestate_projects" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_buildings_project_idx" ON "realestate_buildings" ("organization_id", "project_id");

CREATE TABLE "realestate_units" (
  "id"                   TEXT NOT NULL,
  "organization_id"      TEXT NOT NULL,
  "building_id"          TEXT NOT NULL,
  "project_id"           TEXT NOT NULL,
  "code"                 TEXT NOT NULL,
  "floor"                INTEGER NOT NULL,
  "unit_type"            TEXT NOT NULL,
  "area_sqm"             NUMERIC(7,2) NOT NULL,
  "base_price_egp"       BIGINT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'available',
  "current_customer_id"  TEXT,
  "current_agent_id"     TEXT,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_units_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_units_org_code_uq" UNIQUE ("organization_id", "code"),
  CONSTRAINT "realestate_units_status_check" CHECK ("status" IN ('available', 'reserved', 'sold', 'on-hold', 'unavailable')),
  CONSTRAINT "realestate_units_building_fk" FOREIGN KEY ("organization_id", "building_id")
    REFERENCES "realestate_buildings" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "realestate_units_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "realestate_projects" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_units_building_idx" ON "realestate_units" ("organization_id", "building_id");
CREATE INDEX "realestate_units_project_status_idx" ON "realestate_units" ("organization_id", "project_id", "status");

CREATE TABLE "realestate_price_lists" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "project_id"         TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "version"            TEXT NOT NULL,
  "base_per_sqm_egp"   BIGINT NOT NULL,
  "floor_premium_pct"  NUMERIC(5,2) NOT NULL DEFAULT 0,
  "max_discount_pct"   NUMERIC(5,2) NOT NULL DEFAULT 0,
  "effective_date"     DATE NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'draft',
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_price_lists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_price_lists_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_price_lists_status_check" CHECK ("status" IN ('draft', 'awaiting-approval', 'active')),
  CONSTRAINT "realestate_price_lists_project_fk" FOREIGN KEY ("organization_id", "project_id")
    REFERENCES "realestate_projects" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_price_lists_project_idx" ON "realestate_price_lists" ("organization_id", "project_id");

-- ===========================================================================
-- CRM: leads (also backs Pipeline + Deals), customers, activities, followups
-- ===========================================================================
CREATE TABLE "realestate_leads" (
  "id"                   TEXT NOT NULL,
  "organization_id"      TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "phone"                TEXT NOT NULL,
  "email"                TEXT,
  "source"               TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'new',
  "stage"                TEXT NOT NULL DEFAULT 'new',
  "score"                INTEGER NOT NULL DEFAULT 0,
  "interest_unit_id"     TEXT,
  "interest_text"        TEXT,
  "value_egp"            BIGINT NOT NULL DEFAULT 0,
  "agent_id"             TEXT NOT NULL,
  "probability_pct"      NUMERIC(5,2),
  "expected_close_date"  DATE,
  "last_activity_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_leads_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_leads_source_check" CHECK ("source" IN ('referral', 'website', 'facebook', 'broker', 'exhibition', 'instagram')),
  CONSTRAINT "realestate_leads_status_check" CHECK ("status" IN ('new', 'qualified', 'contacted', 'viewing', 'negotiation', 'lost')),
  CONSTRAINT "realestate_leads_stage_check" CHECK ("stage" IN ('new', 'qualified', 'contacted', 'viewing', 'negotiation', 'reserved', 'contracted', 'sold', 'lost'))
);
CREATE INDEX "realestate_leads_stage_idx" ON "realestate_leads" ("organization_id", "stage");
CREATE INDEX "realestate_leads_agent_idx" ON "realestate_leads" ("organization_id", "agent_id");

CREATE TABLE "realestate_customers" (
  "id"                   TEXT NOT NULL,
  "organization_id"      TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "email"                TEXT,
  "phone"                TEXT,
  "primary_project_id"   TEXT,
  "agent_id"             TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'active',
  "since_date"           DATE NOT NULL DEFAULT CURRENT_DATE,
  "national_id"          TEXT,
  "address"              TEXT,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_customers_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_customers_status_check" CHECK ("status" IN ('active', 'pending'))
);
CREATE INDEX "realestate_customers_agent_idx" ON "realestate_customers" ("organization_id", "agent_id");

CREATE TABLE "realestate_customer_units" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "customer_id"      TEXT NOT NULL,
  "unit_id"          TEXT NOT NULL,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_customer_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_customer_units_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_customer_units_unit_uq" UNIQUE ("organization_id", "unit_id"),
  CONSTRAINT "realestate_customer_units_customer_fk" FOREIGN KEY ("organization_id", "customer_id")
    REFERENCES "realestate_customers" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_customer_units_customer_idx" ON "realestate_customer_units" ("organization_id", "customer_id");

CREATE TABLE "realestate_activities" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "type"             TEXT NOT NULL,
  "subject"          TEXT NOT NULL,
  "related_type"     TEXT,
  "related_id"       TEXT,
  "agent_id"         TEXT NOT NULL,
  "outcome"          TEXT,
  "occurred_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_activities_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_activities_type_check" CHECK ("type" IN ('call', 'meeting', 'viewing', 'email', 'note', 'whatsapp'))
);
CREATE INDEX "realestate_activities_occurred_idx" ON "realestate_activities" ("organization_id", "occurred_at");
CREATE INDEX "realestate_activities_related_idx" ON "realestate_activities" ("organization_id", "related_type", "related_id");

CREATE TABLE "realestate_followups" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "priority"         TEXT NOT NULL DEFAULT 'medium',
  "lead_id"          TEXT,
  "customer_id"      TEXT,
  "reason"           TEXT NOT NULL,
  "agent_id"         TEXT NOT NULL,
  "due_at"           TIMESTAMPTZ(6) NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'open',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_followups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_followups_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_followups_priority_check" CHECK ("priority" IN ('high', 'medium', 'low')),
  CONSTRAINT "realestate_followups_status_check" CHECK ("status" IN ('open', 'in-progress', 'overdue', 'done'))
);
CREATE INDEX "realestate_followups_agent_status_idx" ON "realestate_followups" ("organization_id", "agent_id", "status");

-- ===========================================================================
-- Sales: reservations, contracts, payment plans + installments, commissions
-- ===========================================================================
CREATE TABLE "realestate_reservations" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "unit_id"          TEXT NOT NULL,
  "customer_id"      TEXT NOT NULL,
  "agent_id"         TEXT NOT NULL,
  "reserved_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"       TIMESTAMPTZ(6) NOT NULL,
  "deposit_egp"      BIGINT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'active',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_reservations_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_reservations_unit_uq" UNIQUE ("organization_id", "unit_id"),
  CONSTRAINT "realestate_reservations_status_check" CHECK ("status" IN ('active', 'expiring', 'expired', 'converted'))
);
CREATE INDEX "realestate_reservations_customer_idx" ON "realestate_reservations" ("organization_id", "customer_id");

CREATE TABLE "realestate_contracts" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "reservation_id"   TEXT,
  "customer_id"      TEXT NOT NULL,
  "unit_id"          TEXT NOT NULL,
  "value_egp"        BIGINT NOT NULL,
  "signed_date"      DATE,
  "status"           TEXT NOT NULL DEFAULT 'draft',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_contracts_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_contracts_status_check" CHECK ("status" IN ('draft', 'awaiting-approval', 'signed')),
  CONSTRAINT "realestate_contracts_reservation_fk" FOREIGN KEY ("organization_id", "reservation_id")
    REFERENCES "realestate_reservations" ("organization_id", "id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX "realestate_contracts_customer_idx" ON "realestate_contracts" ("organization_id", "customer_id");
CREATE INDEX "realestate_contracts_unit_idx" ON "realestate_contracts" ("organization_id", "unit_id");

CREATE TABLE "realestate_payment_plans" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "contract_id"         TEXT NOT NULL,
  "unit_id"             TEXT NOT NULL,
  "customer_id"         TEXT NOT NULL,
  "total_egp"           BIGINT NOT NULL,
  "down_payment_pct"    NUMERIC(5,2) NOT NULL,
  "installment_count"   INTEGER NOT NULL,
  "cadence"             TEXT NOT NULL DEFAULT 'quarterly',
  "start_date"          DATE NOT NULL,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_payment_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_payment_plans_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_payment_plans_contract_uq" UNIQUE ("organization_id", "contract_id"),
  CONSTRAINT "realestate_payment_plans_cadence_check" CHECK ("cadence" IN ('monthly', 'quarterly', 'semi-annual', 'annual')),
  CONSTRAINT "realestate_payment_plans_contract_fk" FOREIGN KEY ("organization_id", "contract_id")
    REFERENCES "realestate_contracts" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_payment_plans_customer_idx" ON "realestate_payment_plans" ("organization_id", "customer_id");

CREATE TABLE "realestate_installments" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "payment_plan_id"  TEXT NOT NULL,
  "seq_no"           INTEGER NOT NULL,
  "label"            TEXT NOT NULL,
  "due_date"         DATE NOT NULL,
  "amount_egp"       BIGINT NOT NULL,
  "paid_egp"         BIGINT NOT NULL DEFAULT 0,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_installments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_installments_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_installments_plan_seq_uq" UNIQUE ("organization_id", "payment_plan_id", "seq_no"),
  CONSTRAINT "realestate_installments_status_check" CHECK ("status" IN ('pending', 'partial', 'paid', 'overdue')),
  CONSTRAINT "realestate_installments_plan_fk" FOREIGN KEY ("organization_id", "payment_plan_id")
    REFERENCES "realestate_payment_plans" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_installments_status_due_idx" ON "realestate_installments" ("organization_id", "status", "due_date");

CREATE TABLE "realestate_commissions" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "agent_id"          TEXT NOT NULL,
  "period"            DATE NOT NULL,
  "contracts_count"   INTEGER NOT NULL DEFAULT 0,
  "sales_value_egp"   BIGINT NOT NULL DEFAULT 0,
  "rate_pct"          NUMERIC(5,2) NOT NULL,
  "commission_egp"    BIGINT NOT NULL DEFAULT 0,
  "status"            TEXT NOT NULL DEFAULT 'pending',
  "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_commissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_commissions_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_commissions_agent_period_uq" UNIQUE ("organization_id", "agent_id", "period"),
  CONSTRAINT "realestate_commissions_status_check" CHECK ("status" IN ('pending', 'approved', 'paid'))
);

-- ===========================================================================
-- Finance: payments, saved financial-report definitions
-- ===========================================================================
CREATE TABLE "realestate_payments" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "reference"        TEXT NOT NULL,
  "customer_id"      TEXT NOT NULL,
  "unit_id"          TEXT NOT NULL,
  "installment_id"   TEXT,
  "amount_egp"       BIGINT NOT NULL,
  "method"           TEXT NOT NULL,
  "paid_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"           TEXT NOT NULL DEFAULT 'paid',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_payments_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_payments_org_reference_uq" UNIQUE ("organization_id", "reference"),
  CONSTRAINT "realestate_payments_method_check" CHECK ("method" IN ('bank-transfer', 'cheque', 'cash', 'card')),
  CONSTRAINT "realestate_payments_status_check" CHECK ("status" IN ('paid', 'pending', 'overdue'))
);
CREATE INDEX "realestate_payments_customer_idx" ON "realestate_payments" ("organization_id", "customer_id");
CREATE INDEX "realestate_payments_unit_idx" ON "realestate_payments" ("organization_id", "unit_id");

CREATE TABLE "realestate_financial_reports" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "type"             TEXT NOT NULL,
  "period"           TEXT NOT NULL,
  "owner_id"         TEXT NOT NULL,
  "schedule"         TEXT NOT NULL DEFAULT 'manual',
  "last_run_at"      TIMESTAMPTZ(6),
  "status"           TEXT NOT NULL DEFAULT 'draft',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_financial_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_financial_reports_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_financial_reports_type_check" CHECK ("type" IN ('collections', 'revenue', 'receivables', 'commissions', 'treasury')),
  CONSTRAINT "realestate_financial_reports_schedule_check" CHECK ("schedule" IN ('manual', 'daily', 'weekly', 'monthly')),
  CONSTRAINT "realestate_financial_reports_status_check" CHECK ("status" IN ('draft', 'active'))
);
CREATE INDEX "realestate_financial_reports_type_idx" ON "realestate_financial_reports" ("organization_id", "type");

-- ===========================================================================
-- Operations: tasks, workflows + steps, approvals, documents
-- ===========================================================================
CREATE TABLE "realestate_tasks" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "priority"         TEXT NOT NULL DEFAULT 'medium',
  "title"            TEXT NOT NULL,
  "related_type"     TEXT,
  "related_id"       TEXT,
  "assignee_id"      TEXT NOT NULL,
  "due_at"           TIMESTAMPTZ(6) NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'open',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_tasks_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_tasks_priority_check" CHECK ("priority" IN ('high', 'medium', 'low')),
  CONSTRAINT "realestate_tasks_status_check" CHECK ("status" IN ('open', 'in-progress', 'done'))
);
CREATE INDEX "realestate_tasks_assignee_status_idx" ON "realestate_tasks" ("organization_id", "assignee_id", "status");

CREATE TABLE "realestate_workflows" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_workflows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_workflows_org_id_uq" UNIQUE ("organization_id", "id")
);

CREATE TABLE "realestate_workflow_steps" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "workflow_id"      TEXT NOT NULL,
  "seq_no"           INTEGER NOT NULL,
  "label"            TEXT NOT NULL,
  "assignee_id"      TEXT,
  "state"            TEXT NOT NULL DEFAULT 'pending',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_workflow_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_workflow_steps_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_workflow_steps_workflow_seq_uq" UNIQUE ("organization_id", "workflow_id", "seq_no"),
  CONSTRAINT "realestate_workflow_steps_state_check" CHECK ("state" IN ('done', 'current', 'pending')),
  CONSTRAINT "realestate_workflow_steps_workflow_fk" FOREIGN KEY ("organization_id", "workflow_id")
    REFERENCES "realestate_workflows" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "realestate_approvals" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "kind"             TEXT NOT NULL,
  "subject"          TEXT NOT NULL,
  "related_type"     TEXT,
  "related_id"       TEXT,
  "amount_egp"       BIGINT,
  "requested_by"     TEXT NOT NULL,
  "step_no"          INTEGER NOT NULL DEFAULT 1,
  "step_total"       INTEGER NOT NULL DEFAULT 1,
  "status"           TEXT NOT NULL DEFAULT 'awaiting-approval',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_approvals_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_approvals_kind_check" CHECK ("kind" IN ('discount', 'refund', 'contract', 'commission', 'other')),
  CONSTRAINT "realestate_approvals_status_check" CHECK ("status" IN ('awaiting-approval', 'escalated', 'approved', 'rejected'))
);
CREATE INDEX "realestate_approvals_status_idx" ON "realestate_approvals" ("organization_id", "status");

CREATE TABLE "realestate_documents" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "doc_type"         TEXT NOT NULL,
  "related_type"     TEXT,
  "related_id"       TEXT,
  "file_id"          TEXT,
  "uploaded_by"      TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_documents_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_documents_status_check" CHECK ("status" IN ('draft', 'pending', 'verified'))
);
CREATE INDEX "realestate_documents_related_idx" ON "realestate_documents" ("organization_id", "related_type", "related_id");

-- ===========================================================================
-- AI Copilot (stub): conversations, messages, insights
-- ===========================================================================
CREATE TABLE "realestate_ai_conversations" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "user_id"          TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_ai_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_ai_conversations_org_id_uq" UNIQUE ("organization_id", "id")
);
CREATE INDEX "realestate_ai_conversations_user_idx" ON "realestate_ai_conversations" ("organization_id", "user_id");

CREATE TABLE "realestate_ai_messages" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "conversation_id"  TEXT NOT NULL,
  "role"             TEXT NOT NULL,
  "text"             TEXT NOT NULL,
  "detail"           TEXT,
  "recommend"        TEXT,
  "stats"            JSONB,
  "rows"             JSONB,
  "cites"            JSONB,
  "follow"           JSONB,
  "is_action"        BOOLEAN NOT NULL DEFAULT false,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_ai_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_ai_messages_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_ai_messages_role_check" CHECK ("role" IN ('user', 'ai')),
  CONSTRAINT "realestate_ai_messages_conversation_fk" FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "realestate_ai_conversations" ("organization_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "realestate_ai_messages_conversation_idx" ON "realestate_ai_messages" ("organization_id", "conversation_id");

CREATE TABLE "realestate_ai_insights" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "kind"             TEXT NOT NULL,
  "tag"              TEXT NOT NULL,
  "confidence"       NUMERIC(4,2) NOT NULL,
  "text"             TEXT NOT NULL,
  "detail"           TEXT NOT NULL,
  "cta"              TEXT NOT NULL,
  "target_route"     TEXT,
  "dismissed_by"     TEXT,
  "dismissed_at"     TIMESTAMPTZ(6),
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_ai_insights_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realestate_ai_insights_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "realestate_ai_insights_kind_check" CHECK ("kind" IN ('dashboard', 'feed'))
);
CREATE INDEX "realestate_ai_insights_kind_idx" ON "realestate_ai_insights" ("organization_id", "kind");

-- ===========================================================================
-- Admin: org settings (Team/Roles/Audit Logs/Notifications are thin Core
-- adapters and need no tables of their own)
-- ===========================================================================
CREATE TABLE "realestate_org_settings" (
  "organization_id"             TEXT NOT NULL,
  "reservation_hold_days"       INTEGER NOT NULL DEFAULT 14,
  "escalation_days"             INTEGER NOT NULL DEFAULT 5,
  "default_discount_pct"        NUMERIC(5,2) NOT NULL DEFAULT 0,
  "ai_insight_refresh_minutes"  INTEGER NOT NULL DEFAULT 60,
  "updated_at"                  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realestate_org_settings_pkey" PRIMARY KEY ("organization_id")
);

-- ===========================================================================
-- updated_at triggers (auric_set_updated_at() defined in the copied Core
-- baseline migration 20260829120100)
-- ===========================================================================
CREATE TRIGGER realestate_projects_set_updated_at         BEFORE UPDATE ON "realestate_projects"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_buildings_set_updated_at         BEFORE UPDATE ON "realestate_buildings"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_units_set_updated_at             BEFORE UPDATE ON "realestate_units"             FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_price_lists_set_updated_at       BEFORE UPDATE ON "realestate_price_lists"       FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_leads_set_updated_at             BEFORE UPDATE ON "realestate_leads"             FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_customers_set_updated_at         BEFORE UPDATE ON "realestate_customers"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_followups_set_updated_at         BEFORE UPDATE ON "realestate_followups"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_reservations_set_updated_at      BEFORE UPDATE ON "realestate_reservations"      FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_contracts_set_updated_at         BEFORE UPDATE ON "realestate_contracts"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_payment_plans_set_updated_at     BEFORE UPDATE ON "realestate_payment_plans"     FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_installments_set_updated_at      BEFORE UPDATE ON "realestate_installments"      FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_commissions_set_updated_at       BEFORE UPDATE ON "realestate_commissions"       FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_financial_reports_set_updated_at BEFORE UPDATE ON "realestate_financial_reports" FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_tasks_set_updated_at             BEFORE UPDATE ON "realestate_tasks"             FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_workflows_set_updated_at         BEFORE UPDATE ON "realestate_workflows"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_workflow_steps_set_updated_at    BEFORE UPDATE ON "realestate_workflow_steps"    FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_approvals_set_updated_at         BEFORE UPDATE ON "realestate_approvals"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_documents_set_updated_at         BEFORE UPDATE ON "realestate_documents"         FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_ai_conversations_set_updated_at  BEFORE UPDATE ON "realestate_ai_conversations"  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();
CREATE TRIGGER realestate_org_settings_set_updated_at      BEFORE UPDATE ON "realestate_org_settings"      FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

-- ===========================================================================
-- Row-level security — tenant_isolation on every table (§ docs/tenancy.md).
-- Identical shape to Mizan's lawfirm migration / the user_roles policy in
-- 20260901120100_multitenancy_rls. FORCE so the table owner is filtered too.
-- (GRANTs to auric_app / auric_system are covered by ALTER DEFAULT PRIVILEGES
-- in the copied 20260901120100 migration.)
-- ===========================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'realestate_projects', 'realestate_buildings', 'realestate_units',
    'realestate_price_lists', 'realestate_leads', 'realestate_customers',
    'realestate_customer_units', 'realestate_activities', 'realestate_followups',
    'realestate_reservations', 'realestate_contracts', 'realestate_payment_plans',
    'realestate_installments', 'realestate_commissions', 'realestate_payments',
    'realestate_financial_reports', 'realestate_tasks', 'realestate_workflows',
    'realestate_workflow_steps', 'realestate_approvals', 'realestate_documents',
    'realestate_ai_conversations', 'realestate_ai_messages', 'realestate_ai_insights',
    'realestate_org_settings'
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
