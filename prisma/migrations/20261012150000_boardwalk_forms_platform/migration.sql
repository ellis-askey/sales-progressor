-- Boardwalk Forms — white-label form-builder platform (first tenant: Boardwalk).
-- Six new tables, zero changes to existing TSP tables. Applied to staging via
-- direct SQL (pooled connection) on 2026-10-12; this file is the prod
-- migrate-deploy copy per docs/CONVENTIONS.md "How to add a new database migration".

-- CreateTable
CREATE TABLE "FormTenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandColor" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTenantUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "resetTokenHash" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publicId" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFormResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "meta" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFormUpload" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "responseId" TEXT,
    "questionId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFormUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFormStat" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "starts" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TenantFormStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormTenant_slug_key" ON "FormTenant"("slug");

-- CreateIndex
CREATE INDEX "FormTenantUser_email_idx" ON "FormTenantUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FormTenantUser_tenantId_email_key" ON "FormTenantUser"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "TenantForm_publicId_key" ON "TenantForm"("publicId");

-- CreateIndex
CREATE INDEX "TenantForm_tenantId_status_lastEditedAt_idx" ON "TenantForm"("tenantId", "status", "lastEditedAt");

-- CreateIndex
CREATE INDEX "TenantFormResponse_formId_submittedAt_idx" ON "TenantFormResponse"("formId", "submittedAt");

-- CreateIndex
CREATE INDEX "TenantFormUpload_formId_idx" ON "TenantFormUpload"("formId");

-- CreateIndex
CREATE INDEX "TenantFormUpload_responseId_idx" ON "TenantFormUpload"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFormStat_formId_date_key" ON "TenantFormStat"("formId", "date");

-- AddForeignKey
ALTER TABLE "FormTenantUser" ADD CONSTRAINT "FormTenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FormTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantForm" ADD CONSTRAINT "TenantForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FormTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFormResponse" ADD CONSTRAINT "TenantFormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "TenantForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFormUpload" ADD CONSTRAINT "TenantFormUpload_formId_fkey" FOREIGN KEY ("formId") REFERENCES "TenantForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFormUpload" ADD CONSTRAINT "TenantFormUpload_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "TenantFormResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFormStat" ADD CONSTRAINT "TenantFormStat_formId_fkey" FOREIGN KEY ("formId") REFERENCES "TenantForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
