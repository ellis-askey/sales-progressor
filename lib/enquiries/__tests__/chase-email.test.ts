import { buildEnquiryChaseEmail } from "@/lib/enquiries/chase-email";
import { buildInHouseSignoff } from "@/lib/email/in-house-signoff";
import { timeGreeting } from "@/lib/emails/greeting";

const morning = new Date("2026-08-14T09:00:00Z"); // 10:00 London (BST) -> morning
const afternoon = new Date("2026-08-14T14:00:00Z"); // 15:00 London -> afternoon

describe("timeGreeting", () => {
  it("greets by time of day, never by name", () => {
    expect(timeGreeting(morning)).toBe("Good morning");
    expect(timeGreeting(afternoon)).toBe("Good afternoon");
  });
});

describe("enquiries chase email", () => {
  const base = {
    address: "12 Elm Road",
    clientNames: ["Jordan Blake"],
    senderName: "Ellis Askey",
    agencyName: "Hillcrest Estates",
    provideUpdateUrl: "https://portal.thesalesprogressor.co.uk/s/tok123",
    now: morning,
  };

  it("chases the seller's solicitor for the outstanding replies", () => {
    const e = buildEnquiryChaseEmail({ ...base, court: "seller_solicitor" });
    expect(e.subject).toBe("Sale of 12 Elm Road, Client: Jordan Blake");
    expect(e.text).toContain("Good morning,");
    expect(e.text).toContain("I hope you are well.");
    expect(e.text).toContain("the outstanding enquiries for 12 Elm Road");
    expect(e.text).toContain("where things currently stand");
    expect(e.text).toContain("simply reply to this email");
    expect(e.text).toContain("Best regards,\nEllis Askey\nHillcrest Estates");
    expect(e.html).toContain("Provide an update");
  });

  it("signs outsourced files with the in-house block, never SP branding (white label)", () => {
    const sig = buildInHouseSignoff({ name: "Ellis Askey", agency: "Hillcrest Estates", phone: "07700 900123" });
    const e = buildEnquiryChaseEmail({
      ...base,
      court: "seller_solicitor",
      agentSignatureHtml: sig.html,
      agentSignatureText: sig.text.trim(),
    });
    expect(e.text).toContain("Best regards,\nEllis Askey\nHillcrest Estates\n07700 900123");
    expect(e.html).toContain("font-weight:700");
    expect(e.html).toContain("Hillcrest Estates");
    expect(e.text).not.toContain("The Sales Progressor");
    expect(e.html).not.toContain("The Sales Progressor");
  });

  it("chases the buyer's solicitor about satisfaction", () => {
    const e = buildEnquiryChaseEmail({ ...base, court: "buyer_solicitor" });
    expect(e.subject).toBe("Purchase of 12 Elm Road, Client: Jordan Blake");
    expect(e.text).toContain("the enquiries for 12 Elm Road");
    expect(e.text).toContain("satisfied with the replies");
    expect(e.text).not.toContain("where things currently stand");
  });

  it("subjects two clients with an ampersand", () => {
    const e = buildEnquiryChaseEmail({ ...base, clientNames: ["Jordan Blake", "Sam Blake"], court: "buyer_solicitor" });
    expect(e.subject).toBe("Purchase of 12 Elm Road, Clients: Jordan Blake & Sam Blake");
  });

  it("has no em-dashes or exclamation marks (voice)", () => {
    for (const court of ["seller_solicitor", "buyer_solicitor"] as const) {
      const e = buildEnquiryChaseEmail({ ...base, court });
      expect(e.text).not.toMatch(/[—!]/);
      expect(e.html).not.toMatch(/[—!]/);
    }
  });
});
