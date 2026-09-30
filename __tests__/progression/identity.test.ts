/**
 * @jest-environment node
 *
 * Client-facing progression identity (Phase 3a). Proves TSP/null files resolve
 * to the EXACT pre-generalisation hardcoded values (byte-identical), and an
 * external business uses its own identity without ever leaking TSP's.
 */
import {
  clientFacingIdentity,
  whatsappLink,
  progressorSenderAddress,
} from "@/lib/progression/identity";

describe("clientFacingIdentity", () => {
  it("null business resolves to The Sales Progressor's exact values", () => {
    expect(clientFacingIdentity(null)).toEqual({
      orgName: "The Sales Progressor",
      contactWhatsapp: "+447508862929",
      senderEmail: "ellis@thesalesprogressor.co.uk",
      senderDomain: "thesalesprogressor.co.uk",
      isTsp: true,
    });
  });

  it("the TSP business row (isTsp) also resolves to TSP's values", () => {
    const tsp = {
      name: "The Sales Progressor",
      contactWhatsapp: "+447508862929",
      senderEmail: "ellis@thesalesprogressor.co.uk",
      senderDomain: "thesalesprogressor.co.uk",
      isTsp: true,
    };
    expect(clientFacingIdentity(tsp).isTsp).toBe(true);
    expect(clientFacingIdentity(tsp).orgName).toBe("The Sales Progressor");
  });

  it("an external business uses its OWN identity", () => {
    const sarah = {
      name: "Sarah's Progression Co",
      contactWhatsapp: "+447900000000",
      senderEmail: "sarah@sarahprogression.co.uk",
      senderDomain: "sarahprogression.co.uk",
      isTsp: false,
    };
    expect(clientFacingIdentity(sarah)).toEqual({
      orgName: "Sarah's Progression Co",
      contactWhatsapp: "+447900000000",
      senderEmail: "sarah@sarahprogression.co.uk",
      senderDomain: "sarahprogression.co.uk",
      isTsp: false,
    });
  });

  it("an external business with no configured sender falls back to the platform address, NOT a personal TSP one", () => {
    const sarah = {
      name: "Sarah's Progression Co",
      contactWhatsapp: null,
      senderEmail: null,
      senderDomain: null,
      isTsp: false,
    };
    const id = clientFacingIdentity(sarah);
    expect(id.senderEmail).toBe("updates@thesalesprogressor.co.uk");
    expect(id.senderEmail).not.toBe("ellis@thesalesprogressor.co.uk");
    expect(id.contactWhatsapp).toBeNull(); // no WhatsApp button rather than TSP's number
  });
});

describe("whatsappLink", () => {
  it("produces the exact TSP link from the stored number", () => {
    expect(whatsappLink("+447508862929")).toBe("https://wa.me/447508862929");
  });
  it("is null when no number is set", () => {
    expect(whatsappLink(null)).toBeNull();
  });
});

describe("progressorSenderAddress", () => {
  const tsp = clientFacingIdentity(null);

  it("TSP: prefers the progressor's own @thesalesprogressor address, else ellis@ (unchanged)", () => {
    expect(progressorSenderAddress(tsp, "jo@thesalesprogressor.co.uk")).toBe("jo@thesalesprogressor.co.uk");
    expect(progressorSenderAddress(tsp, "someone@elsewhere.com")).toBe("ellis@thesalesprogressor.co.uk");
    expect(progressorSenderAddress(tsp, null)).toBe("ellis@thesalesprogressor.co.uk");
  });

  it("external: prefers the progressor's own on-domain address, else the business sender; never ellis@", () => {
    const sarah = clientFacingIdentity({
      name: "Sarah's Progression Co",
      contactWhatsapp: null,
      senderEmail: "sarah@sarahprogression.co.uk",
      senderDomain: "sarahprogression.co.uk",
      isTsp: false,
    });
    expect(progressorSenderAddress(sarah, "kim@sarahprogression.co.uk")).toBe("kim@sarahprogression.co.uk");
    expect(progressorSenderAddress(sarah, "sarah@gmail.com")).toBe("sarah@sarahprogression.co.uk");
    expect(progressorSenderAddress(sarah, "ellis@thesalesprogressor.co.uk")).not.toBe("ellis@thesalesprogressor.co.uk");
  });
});
