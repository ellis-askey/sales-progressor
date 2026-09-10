-- Store the rendered HTML of solicitor chase emails at send time, so the
-- automated-emails detail drawer can show the real email (they send directly,
-- with no queue payload to preview). Null on existing rows + non-email rows.
ALTER TABLE "OutboundMessage" ADD COLUMN "sentEmailHtml" TEXT;
