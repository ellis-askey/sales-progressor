/**
 * @jest-environment node
 *
 * Outsource intro email WhatsApp block (Phase 3b): the CTA is present with the
 * business's link and omitted entirely when no number is configured (so an
 * external business never shows TSP's line).
 */
import { buildOutsourceIntroEmail, type OutsourceIntroVars } from "@/lib/emails/outsource-intro-template";

const base: OutsourceIntroVars = {
  clientFirstName: "Jo",
  address: "1 Test Street",
  agentFirstName: "Taylor",
  agentLastName: "Kay",
  agencyName: "Akeman Residential",
  portalUrl: null,
  saleNoun: "sale",
  whatsappUrl: null,
};

describe("buildOutsourceIntroEmail WhatsApp block", () => {
  it("includes the WhatsApp CTA (text + html) when a link is provided", () => {
    const email = buildOutsourceIntroEmail({ ...base, whatsappUrl: "https://wa.me/447900000000" });
    expect(email.text).toContain("WhatsApp us: https://wa.me/447900000000");
    expect(email.html).toContain("https://wa.me/447900000000");
    expect(email.html).toContain("WhatsApp us");
  });

  it("omits the WhatsApp CTA entirely when no link is provided", () => {
    const email = buildOutsourceIntroEmail({ ...base, whatsappUrl: null });
    expect(email.text).not.toContain("WhatsApp");
    expect(email.text).not.toContain("wa.me");
    expect(email.html).not.toContain("wa.me");
    expect(email.html).not.toContain("WhatsApp us");
  });
});
