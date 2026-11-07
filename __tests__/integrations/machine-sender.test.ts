import { isMachineSender } from "@/lib/integrations/mail/sender";

describe("isMachineSender", () => {
  it.each([
    "notifications@vercel.com",
    "noreply@md.getsentry.com",
    "noreply@alerts.zoopla.co.uk",
    "no-reply@rightmove.co.uk",
    "alerts@somecrm.com",
    "mailer-daemon@example.com",
    "updates@monday.com",
    "notify@linkedin.com",
  ])("flags machine sender %s", (addr) => {
    expect(isMachineSender(addr)).toBe(true);
  });

  it.each([
    "alexandra.ridley@curwens.co.uk",
    "john@viavia.co.uk",
    "birmingham@collective.legal",
    "faizan.h@muve.me.uk",
    "conveyancing@firm.co.uk",
    "info@estateagent.co.uk",
    "jo@keytocompletion.co.uk",
  ])("leaves human sender %s", (addr) => {
    expect(isMachineSender(addr)).toBe(false);
  });
});
