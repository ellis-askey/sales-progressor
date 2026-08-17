-- Client-chosen portal overview layout: { order: string[], hidden: string[] }.
ALTER TABLE "Contact" ADD COLUMN "overviewLayout" JSONB;
