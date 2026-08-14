import { buildEnquiryChaseEmail } from "@/lib/enquiries/chase-email";
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
    senderName: "Ellis Askey",
    agencyName: "The Sales Progressor",
    provideUpdateUrl: "https://portal.thesalesprogressor.co.uk/s/tok123",
    now: morning,
  };

  it("chases the seller's solicitor for the outstanding replies", () => {
    const e = buildEnquiryChaseEmail({ ...base, court: "seller_solicitor" });
    expect(e.subject).toBe("Enquiries on 12 Elm Road");
    expect(e.text).toContain("Good morning,");
    expect(e.text).toContain("I hope you are well.");
    expect(e.text).toContain("the outstanding enquiries for 12 Elm Road");
    expect(e.text).toContain("where things currently stand");
    expect(e.text).toContain("simply reply to this email");
    expect(e.text).toContain("Kind regards,\nEllis Askey\nThe Sales Progressor");
    expect(e.html).toContain("Provide an update");
  });

  it("chases the buyer's solicitor about satisfaction", () => {
    const e = buildEnquiryChaseEmail({ ...base, court: "buyer_solicitor" });
    expect(e.text).toContain("the enquiries for 12 Elm Road");
    expect(e.text).toContain("satisfied with the replies");
    expect(e.text).not.toContain("where things currently stand");
  });

  it("has no em-dashes or exclamation marks (voice)", () => {
    for (const court of ["seller_solicitor", "buyer_solicitor"] as const) {
      const e = buildEnquiryChaseEmail({ ...base, court });
      expect(e.text).not.toMatch(/[—!]/);
      expect(e.html).not.toMatch(/[—!]/);
    }
  });
});
