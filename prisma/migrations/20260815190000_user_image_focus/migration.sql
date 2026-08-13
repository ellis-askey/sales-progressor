-- Focal point (percent) for cropping a user's avatar into circular frames, so a
-- portrait headshot's face can be nudged to centre. 50/50 = dead centre, so
-- existing avatars are unaffected. Set from the Command Centre agent drill-down.
-- Apply staging-first, verify, then production (Law 3).
ALTER TABLE "User" ADD COLUMN "imageFocusX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "User" ADD COLUMN "imageFocusY" INTEGER NOT NULL DEFAULT 50;
