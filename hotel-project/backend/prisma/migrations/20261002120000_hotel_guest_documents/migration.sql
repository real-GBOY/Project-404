-- HotelOS Slice 7 — guest documents: a guest's ID scan or other paperwork, as a link to a file
-- owned by Core's files module (which stores the bytes and enforces its own tenancy).
CREATE TABLE "hotel_guest_documents" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "guest_id"        TEXT NOT NULL,
  "file_id"         TEXT NOT NULL,
  "kind"            TEXT NOT NULL,
  "label"           TEXT,
  "uploaded_by"     TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_guest_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hotel_guest_documents_org_id_uq" UNIQUE ("organization_id", "id"),
  CONSTRAINT "hotel_guest_documents_file_uq" UNIQUE ("organization_id", "file_id"),
  CONSTRAINT "hotel_guest_documents_guest_fk" FOREIGN KEY ("organization_id", "guest_id")
    REFERENCES "hotel_guests" ("organization_id", "id") ON DELETE CASCADE,
  CONSTRAINT "hotel_guest_documents_kind_check" CHECK ("kind" IN ('id_document', 'other'))
);
CREATE INDEX "hotel_guest_documents_guest_idx" ON "hotel_guest_documents" ("organization_id", "guest_id");

DO $$
BEGIN
  ALTER TABLE "hotel_guest_documents" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "hotel_guest_documents" FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "hotel_guest_documents"
    USING (organization_id = current_setting('app.organization_id', true))
    WITH CHECK (organization_id = current_setting('app.organization_id', true));
END $$;
