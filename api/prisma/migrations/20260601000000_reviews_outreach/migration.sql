-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('in_app', 'glassdoor');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('draft', 'queued', 'sent', 'failed');

-- AlterTable
ALTER TABLE "companies"
    ADD COLUMN "recruiter_name" TEXT,
    ADD COLUMN "recruiter_email" TEXT,
    ADD COLUMN "recruiter_title" TEXT,
    ADD COLUMN "glassdoor_id" TEXT;

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "source" "ReviewSource" NOT NULL DEFAULT 'in_app',
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "pros" TEXT,
    "cons" TEXT,
    "author_title" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreaches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "recruiter_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'draft',
    "provider_id" TEXT,
    "sent_at" TIMESTAMPTZ,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "outreaches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_company_id_key" ON "reviews"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_source_external_id_key" ON "reviews"("source", "external_id");

-- CreateIndex
CREATE INDEX "reviews_company_id_created_at_idx" ON "reviews"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "outreaches_user_id_created_at_idx" ON "outreaches"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "outreaches_job_id_idx" ON "outreaches"("job_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
