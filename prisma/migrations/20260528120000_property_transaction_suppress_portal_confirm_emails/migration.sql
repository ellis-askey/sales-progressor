-- Temporary internal-staff debug toggle for the buyer/seller portal
-- confirmation email. When true, sendAdminMilestoneNotificationToPortal
-- is skipped on milestone confirms. All other side effects of a confirm
-- (chain notifications, celebrations, reminder engine knock-on, DB
-- writes) continue to fire normally.
--
-- SetAt and SetById form an audit trail so we can find forgotten
-- toggles via SQL: SELECT id, propertyAddress FROM "PropertyTransaction"
-- WHERE "suppressPortalConfirmEmails" = true.

ALTER TABLE "PropertyTransaction"
  ADD COLUMN "suppressPortalConfirmEmails"        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "suppressPortalConfirmEmailsSetAt"   TIMESTAMP(3),
  ADD COLUMN "suppressPortalConfirmEmailsSetById" TEXT;
