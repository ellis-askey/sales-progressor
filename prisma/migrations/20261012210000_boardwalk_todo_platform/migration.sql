-- Boardwalk To Do — task-management platform (13 tables), second product in
-- the Boardwalk suite. No changes to existing tables. Applied to staging
-- via direct SQL on 2026-10-12; this file is the prod migrate-deploy copy.

-- CreateTable
CREATE TABLE "TodoProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#404648',
    "icon" TEXT,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'team',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "viewPref" TEXT,

    CONSTRAINT "TodoProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoSection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "sectionId" TEXT,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE,
    "dueTime" TEXT,
    "duration" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 4,
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recurrence" JSONB,
    "inboxOwnerId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoLabel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#c3c5c1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoTaskLabel" (
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    CONSTRAINT "TodoTaskLabel_pkey" PRIMARY KEY ("taskId","labelId")
);

-- CreateTable
CREATE TABLE "TodoComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "commentId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoReminder" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "offsetMinutes" INTEGER,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoFilter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoFilter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoUserPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoUserPref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoProject_tenantId_archivedAt_order_idx" ON "TodoProject"("tenantId", "archivedAt", "order");

-- CreateIndex
CREATE INDEX "TodoProjectMember_userId_idx" ON "TodoProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoProjectMember_projectId_userId_key" ON "TodoProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "TodoSection_projectId_order_idx" ON "TodoSection"("projectId", "order");

-- CreateIndex
CREATE INDEX "TodoTask_tenantId_completedAt_dueDate_idx" ON "TodoTask"("tenantId", "completedAt", "dueDate");

-- CreateIndex
CREATE INDEX "TodoTask_tenantId_assigneeId_completedAt_idx" ON "TodoTask"("tenantId", "assigneeId", "completedAt");

-- CreateIndex
CREATE INDEX "TodoTask_tenantId_inboxOwnerId_completedAt_idx" ON "TodoTask"("tenantId", "inboxOwnerId", "completedAt");

-- CreateIndex
CREATE INDEX "TodoTask_projectId_sectionId_order_idx" ON "TodoTask"("projectId", "sectionId", "order");

-- CreateIndex
CREATE INDEX "TodoTask_parentId_idx" ON "TodoTask"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoLabel_tenantId_name_key" ON "TodoLabel"("tenantId", "name");

-- CreateIndex
CREATE INDEX "TodoComment_taskId_createdAt_idx" ON "TodoComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TodoAttachment_taskId_idx" ON "TodoAttachment"("taskId");

-- CreateIndex
CREATE INDEX "TodoReminder_sentAt_remindAt_idx" ON "TodoReminder"("sentAt", "remindAt");

-- CreateIndex
CREATE INDEX "TodoReminder_taskId_idx" ON "TodoReminder"("taskId");

-- CreateIndex
CREATE INDEX "TodoNotification_userId_readAt_createdAt_idx" ON "TodoNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "TodoActivity_taskId_createdAt_idx" ON "TodoActivity"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TodoFilter_userId_order_idx" ON "TodoFilter"("userId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TodoUserPref_userId_key" ON "TodoUserPref"("userId");

-- AddForeignKey
ALTER TABLE "TodoProjectMember" ADD CONSTRAINT "TodoProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TodoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoSection" ADD CONSTRAINT "TodoSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TodoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTask" ADD CONSTRAINT "TodoTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TodoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTask" ADD CONSTRAINT "TodoTask_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TodoSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTask" ADD CONSTRAINT "TodoTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TodoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTaskLabel" ADD CONSTRAINT "TodoTaskLabel_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TodoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTaskLabel" ADD CONSTRAINT "TodoTaskLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "TodoLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoComment" ADD CONSTRAINT "TodoComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TodoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoAttachment" ADD CONSTRAINT "TodoAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TodoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoAttachment" ADD CONSTRAINT "TodoAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TodoComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoReminder" ADD CONSTRAINT "TodoReminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TodoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoActivity" ADD CONSTRAINT "TodoActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TodoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

