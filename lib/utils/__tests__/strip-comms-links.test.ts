/**
 * @jest-environment node
 */

// Coverage for the 2026-08-18 addition: solicitor response links
// (/s/<token>) are stripped + collected like /portal/ deep-links, so the
// activity feed renders the "Open response page" button instead of a raw
// URL (the enquiries chase emails surfaced this gap).

import { stripCommsLinksForAgent, stripCommsLinksSilent } from "@/lib/utils/strip-comms-links";

const SOLICITOR_BODY = [
  "Hi Sana,",
  "",
  "If you're satisfied with the replies, please confirm below.",
  "",
  "https://portal.thesalesprogressor.co.uk/s/Y21xcdpcHRoMDAwNHBkNmx0M2pscnNhYy5wdXJjaGFzZXIl.abc123",
  "",
  "Alternatively, simply reply to this email and it will come directly to me.",
].join("\n");

describe("solicitor /s/ links", () => {
  test("agent strip pulls the /s/ link out as a button target", () => {
    const { text, portalLinks } = stripCommsLinksForAgent(SOLICITOR_BODY);
    expect(portalLinks).toHaveLength(1);
    expect(portalLinks[0]).toContain("/s/");
    expect(text).not.toContain("https://");
    expect(text).toContain("please confirm below.");
    expect(text).toContain("Alternatively, simply reply");
  });

  test("silent strip removes the /s/ link entirely", () => {
    const text = stripCommsLinksSilent(SOLICITOR_BODY);
    expect(text).not.toContain("https://");
    expect(text).toContain("please confirm below.");
  });

  test("mid-path /s/ segments do not false-match", () => {
    const body = "See the guide:\n\nhttps://example.com/docs/s/not-a-token\n\nThanks.";
    const { portalLinks } = stripCommsLinksForAgent(body);
    expect(portalLinks).toHaveLength(0);
  });

  test("/portal/ deep-links still collect as before", () => {
    const body = "Open the page below.\n\nhttps://portal.thesalesprogressor.co.uk/portal/tok123/respond\n\nThanks.";
    const { text, portalLinks } = stripCommsLinksForAgent(body);
    expect(portalLinks).toEqual(["https://portal.thesalesprogressor.co.uk/portal/tok123/respond"]);
    expect(text).not.toContain("https://");
  });
});
