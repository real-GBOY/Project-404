-- AlterTable
ALTER TABLE "files" ADD COLUMN     "committed_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'stored';

-- CreateIndex
CREATE INDEX "files_status_idx" ON "files"("status");
