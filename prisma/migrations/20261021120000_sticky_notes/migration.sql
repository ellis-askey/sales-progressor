-- Freeform draggable sticky notes on a property file (internal scratchpad). Additive.
CREATE TABLE "StickyNote" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 32,
    "y" INTEGER NOT NULL DEFAULT 32,
    "width" INTEGER NOT NULL DEFAULT 224,
    "height" INTEGER NOT NULL DEFAULT 200,
    "z" INTEGER NOT NULL DEFAULT 1,
    "colour" TEXT NOT NULL DEFAULT 'butter',
    "text" TEXT NOT NULL DEFAULT '',
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StickyNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StickyNote_transactionId_idx" ON "StickyNote"("transactionId");

ALTER TABLE "StickyNote" ADD CONSTRAINT "StickyNote_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StickyNote" ADD CONSTRAINT "StickyNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
