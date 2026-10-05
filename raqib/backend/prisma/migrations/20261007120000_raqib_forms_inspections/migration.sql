-- Raqib Phase 3 — forms and versions, inspections with an immutable form snapshot, answers, guard
-- evaluations, return flags and evidence links.
--
-- Historical integrity is enforced here, not only in the application:
--   * a published form version can never change (trigger);
--   * starting an inspection copies the version's items into raqib_inspection_items, which are immutable
--     (trigger) — answers reference those snapshot rows, so no later form edit can change what an inspection meant.

-- ===========================================================================
-- Forms and versions
-- ===========================================================================
CREATE TABLE "raqib_forms" (
  "id"             TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "category"       TEXT NOT NULL,
  "name_ar"        TEXT NOT NULL,
  "name_en"        TEXT NOT NULL,
  "description_ar" TEXT NOT NULL DEFAULT '',
  "description_en" TEXT NOT NULL DEFAULT '',
  "active"         BOOLEAN NOT NULL DEFAULT true,
  "is_default"     BOOLEAN NOT NULL DEFAULT false,
  "created_by"     TEXT,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_forms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_forms_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_forms_code_uq" UNIQUE ("organization_id", "code"),
  CONSTRAINT "raqib_forms_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE,
  CONSTRAINT "raqib_forms_category_check" CHECK ("category" IN ('site', 'guard')),
  CONSTRAINT "raqib_forms_name_check" CHECK (length(btrim("name_en")) > 0 AND length(btrim("name_ar")) > 0)
);
-- One default form per category (the one a visit uses when it starts).
CREATE UNIQUE INDEX "raqib_forms_default_uq" ON "raqib_forms" ("organization_id", "category") WHERE "is_default";

CREATE TABLE "raqib_form_versions" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "form_id"         TEXT NOT NULL,
  "version"         TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'draft',
  -- [{ key, title:{ar,en}, items:[{ key, text:{ar,en}, weight, type, required, na, evidenceOnNc }] }]
  "sections"        JSONB NOT NULL DEFAULT '[]',
  "note_ar"         TEXT NOT NULL DEFAULT '',
  "note_en"         TEXT NOT NULL DEFAULT '',
  "created_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_by"    TEXT,
  "published_at"    TIMESTAMPTZ(6),
  "superseded_at"   TIMESTAMPTZ(6),
  CONSTRAINT "raqib_form_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_form_versions_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_form_versions_uq" UNIQUE ("organization_id", "form_id", "version"),
  CONSTRAINT "raqib_form_versions_form_fk" FOREIGN KEY ("organization_id", "form_id")
    REFERENCES "raqib_forms" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_form_versions_status_check" CHECK ("status" IN ('draft', 'published', 'archived')),
  CONSTRAINT "raqib_form_versions_sections_check" CHECK (jsonb_typeof("sections") = 'array')
);
CREATE UNIQUE INDEX "raqib_form_versions_published_uq" ON "raqib_form_versions" ("organization_id", "form_id") WHERE "status" = 'published';
CREATE UNIQUE INDEX "raqib_form_versions_draft_uq" ON "raqib_form_versions" ("organization_id", "form_id") WHERE "status" = 'draft';

-- Published and archived versions are frozen. A published version may only be archived (superseded).
CREATE FUNCTION raqib_form_versions_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'a published form version cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'archived' THEN RAISE EXCEPTION 'an archived form version is immutable'; END IF;
  IF OLD.status = 'published' THEN
    IF NEW.status <> 'archived' OR NEW.sections IS DISTINCT FROM OLD.sections OR NEW.version <> OLD.version OR NEW.form_id <> OLD.form_id THEN
      RAISE EXCEPTION 'a published form version is immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER raqib_form_versions_guard_t BEFORE UPDATE OR DELETE ON "raqib_form_versions"
  FOR EACH ROW EXECUTE FUNCTION raqib_form_versions_guard();

-- ===========================================================================
-- Inspections — one per started visit, bound to the form versions it ran on.
-- ===========================================================================
CREATE TABLE "raqib_inspections" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "visit_id"              TEXT NOT NULL,
  "form_version_id"       TEXT NOT NULL,
  "guard_form_version_id" TEXT,
  "scoring_policy"        TEXT NOT NULL DEFAULT 'weighted_compliance_v1',
  "started_by"            TEXT,
  "started_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at"          TIMESTAMPTZ(6),
  -- stored at submission (the authoritative figure for reports and analytics); null = not scoreable or not submitted
  "score_pct"             INTEGER,
  "counts"                JSONB,
  CONSTRAINT "raqib_inspections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_inspections_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_inspections_visit_uq" UNIQUE ("organization_id", "visit_id"),
  CONSTRAINT "raqib_inspections_visit_fk" FOREIGN KEY ("organization_id", "visit_id")
    REFERENCES "raqib_visits" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_inspections_form_fk" FOREIGN KEY ("organization_id", "form_version_id")
    REFERENCES "raqib_form_versions" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_inspections_guard_form_fk" FOREIGN KEY ("organization_id", "guard_form_version_id")
    REFERENCES "raqib_form_versions" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_inspections_score_check" CHECK ("score_pct" IS NULL OR "score_pct" BETWEEN 0 AND 100)
);
CREATE INDEX "raqib_inspections_form_idx" ON "raqib_inspections" ("organization_id", "form_version_id");

-- The immutable snapshot of the form's items taken when the inspection started.
CREATE TABLE "raqib_inspection_items" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "inspection_id"    TEXT NOT NULL,
  "kind"             TEXT NOT NULL,
  "section_pos"      INTEGER NOT NULL,
  "section_key"      TEXT NOT NULL,
  "section_title_ar" TEXT NOT NULL,
  "section_title_en" TEXT NOT NULL,
  "position"         INTEGER NOT NULL,
  "item_key"         TEXT NOT NULL,
  "text_ar"          TEXT NOT NULL,
  "text_en"          TEXT NOT NULL,
  "weight"           INTEGER NOT NULL,
  "answer_type"      TEXT NOT NULL,
  "required"         BOOLEAN NOT NULL,
  "na_allowed"       BOOLEAN NOT NULL,
  "evidence_on_nc"   BOOLEAN NOT NULL,
  CONSTRAINT "raqib_inspection_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_inspection_items_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_inspection_items_key_uq" UNIQUE ("inspection_id", "kind", "item_key"),
  CONSTRAINT "raqib_inspection_items_insp_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_inspection_items_kind_check" CHECK ("kind" IN ('site', 'guard')),
  CONSTRAINT "raqib_inspection_items_weight_check" CHECK ("weight" BETWEEN 0 AND 10)
);
CREATE INDEX "raqib_inspection_items_insp_idx" ON "raqib_inspection_items" ("organization_id", "inspection_id", "kind", "section_pos", "position");

CREATE FUNCTION raqib_inspection_items_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'inspection items are an immutable snapshot'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER raqib_inspection_items_immutable_t BEFORE UPDATE ON "raqib_inspection_items"
  FOR EACH ROW EXECUTE FUNCTION raqib_inspection_items_immutable();

CREATE TABLE "raqib_answers" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "inspection_id"   TEXT NOT NULL,
  "item_id"         TEXT NOT NULL,
  "value"           TEXT,
  "note"            TEXT,
  "severity"        TEXT,
  -- the submission round in which the answer was last edited (a returned item counts as fixed once edited in a later round)
  "edited_round"    INTEGER NOT NULL DEFAULT 1,
  "updated_by"      TEXT,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_answers_item_uq" UNIQUE ("organization_id", "item_id"),
  CONSTRAINT "raqib_answers_insp_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_answers_item_fk" FOREIGN KEY ("organization_id", "item_id")
    REFERENCES "raqib_inspection_items" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_answers_value_check" CHECK ("value" IS NULL OR "value" IN ('c', 'n', 'x')),
  CONSTRAINT "raqib_answers_severity_check" CHECK ("severity" IS NULL OR "severity" IN ('low', 'medium', 'high'))
);
CREATE INDEX "raqib_answers_insp_idx" ON "raqib_answers" ("organization_id", "inspection_id");

-- Guard evaluation: one 1–5 score per guard per criterion (criteria are snapshot items of kind 'guard').
CREATE TABLE "raqib_guard_scores" (
  "organization_id" TEXT NOT NULL,
  "inspection_id"   TEXT NOT NULL,
  "guard_id"        TEXT NOT NULL,
  "item_id"         TEXT NOT NULL,
  "score"           INTEGER NOT NULL,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_guard_scores_pkey" PRIMARY KEY ("organization_id", "inspection_id", "guard_id", "item_id"),
  CONSTRAINT "raqib_guard_scores_insp_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_guard_scores_item_fk" FOREIGN KEY ("organization_id", "item_id")
    REFERENCES "raqib_inspection_items" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_guard_scores_guard_fk" FOREIGN KEY ("organization_id", "guard_id")
    REFERENCES "raqib_guards" ("organization_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "raqib_guard_scores_score_check" CHECK ("score" BETWEEN 1 AND 5)
);
CREATE TABLE "raqib_guard_notes" (
  "organization_id" TEXT NOT NULL,
  "inspection_id"   TEXT NOT NULL,
  "guard_id"        TEXT NOT NULL,
  "note"            TEXT NOT NULL DEFAULT '',
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_guard_notes_pkey" PRIMARY KEY ("organization_id", "inspection_id", "guard_id"),
  CONSTRAINT "raqib_guard_notes_insp_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_guard_notes_guard_fk" FOREIGN KEY ("organization_id", "guard_id")
    REFERENCES "raqib_guards" ("organization_id", "id") ON DELETE RESTRICT
);

-- Items a reviewer sent back, per submission round (written by the review workflow).
CREATE TABLE "raqib_inspection_flags" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "inspection_id"   TEXT NOT NULL,
  "item_id"         TEXT NOT NULL,
  "round"           INTEGER NOT NULL,
  "created_by"      TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raqib_inspection_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_inspection_flags_uq" UNIQUE ("organization_id", "inspection_id", "item_id", "round"),
  CONSTRAINT "raqib_inspection_flags_insp_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "raqib_inspection_flags_item_fk" FOREIGN KEY ("organization_id", "item_id")
    REFERENCES "raqib_inspection_items" ("organization_id", "id") ON DELETE CASCADE
);

-- ===========================================================================
-- Evidence — a Core file (private, presigned upload) linked to its business context.
-- ===========================================================================
CREATE TABLE "raqib_evidence" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "file_id"         TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "mime"            TEXT NOT NULL,
  "size_bytes"      BIGINT NOT NULL,
  "context"         TEXT NOT NULL,
  "inspection_id"   TEXT,
  "item_id"         TEXT,
  "guard_id"        TEXT,
  "ref_id"          TEXT,
  "uploaded_by"     TEXT,
  "uploaded_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removed_at"      TIMESTAMPTZ(6),
  CONSTRAINT "raqib_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raqib_evidence_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "raqib_evidence_file_uq" UNIQUE ("organization_id", "file_id"),
  CONSTRAINT "raqib_evidence_kind_check" CHECK ("kind" IN ('photo', 'video', 'doc')),
  CONSTRAINT "raqib_evidence_context_check" CHECK ("context" IN ('answer', 'guard_eval', 'corrective_action', 'observation')),
  CONSTRAINT "raqib_evidence_insp_fk" FOREIGN KEY ("organization_id", "inspection_id")
    REFERENCES "raqib_inspections" ("organization_id", "id") ON DELETE RESTRICT
);
CREATE INDEX "raqib_evidence_item_idx" ON "raqib_evidence" ("organization_id", "inspection_id", "item_id") WHERE "removed_at" IS NULL;
CREATE INDEX "raqib_evidence_ref_idx" ON "raqib_evidence" ("organization_id", "context", "ref_id") WHERE "removed_at" IS NULL;

CREATE TRIGGER raqib_forms_set_updated_at BEFORE UPDATE ON "raqib_forms"
  FOR EACH ROW EXECUTE FUNCTION auric_set_updated_at();

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['raqib_forms', 'raqib_form_versions', 'raqib_inspections', 'raqib_inspection_items', 'raqib_answers',
                           'raqib_guard_scores', 'raqib_guard_notes', 'raqib_inspection_flags', 'raqib_evidence']
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
