// PROTOTYPE (/dev) — "Review before send" drawer, v2.
//
// Server component: generates each recipient's email HTML through the REAL
// renderers the live queue uses (richMilestoneEmailHtml for a single update,
// renderEditedEmailHtml for a merged digest), so the drawer preview is
// byte-for-byte what lands in the inbox. Two scenarios: a single update and a
// digest (multiple confirmed steps, each editable/removable).

import { richMilestoneEmailHtml } from "@/lib/services/portal";
import { renderEditedEmailHtml } from "@/lib/email/milestone-digest";
import { resolveEmailTheme } from "@/lib/email/brand-theme";
import { getMilestoneCopy, type RecipientEmailCopy as RC } from "@/lib/portal-copy";
import { ReviewDrawerV2, type PreviewRecipient } from "./ReviewDrawerV2";
import { DevThemeShell } from "./DevThemeShell";

const ADDRESS = "2 Conifer Close, Waltham Cross, EN7 6EY";
const PORTAL_URL = "https://portal.thesalesprogressor.co.uk/portal/demo/progress";
const FROM = "updates@adproperties.uk";

function interp(s: string): string {
  return s.replace(/\{address\}/g, ADDRESS).replace(/\{[a-zA-Z]+\}/g, "").replace(/\s{2,}/g, " ").trim();
}
function bake(copy: RC): RC {
  return {
    subject: interp(copy.subject), heroLabel: interp(copy.heroLabel), opening: interp(copy.opening),
    whatHappened: interp(copy.whatHappened), whatNext: copy.whatNext ? interp(copy.whatNext) : null, action: copy.action,
  };
}
function renderSingle(copy: RC, greeting: string): string {
  return richMilestoneEmailHtml({
    greeting, copy: bake(copy), address: ADDRESS, ctaUrl: PORTAL_URL,
    progressorName: "Ellis Askey", progressorEmail: "ellis@thesalesprogressor.co.uk",
  });
}
function singleText(copy: RC, greeting: string): string {
  const c = bake(copy);
  return [greeting, "", c.opening, "", c.whatHappened, ...(c.whatNext ? ["", c.whatNext] : [])].join("\n");
}

// Digest: greeting + a short intro + one line per confirmed step, rendered via
// the real edited-email renderer (branded shell, byte-faithful).
const DIGEST_GREETING = "Hi Debbie,";
const DIGEST_INTRO = "A few things have moved on your sale at 2 Conifer Close. Here's the latest:";
const DIGEST_UPDATES = [
  { id: "u1", line: "Your completed property information forms have been returned to your solicitor." },
  { id: "u2", line: "Your solicitor has sent the draft contract pack to the buyer's solicitor." },
  { id: "u3", line: "The buyer's solicitor has raised their first round of enquiries." },
];
function digestText(updates: { line: string }[]): string {
  return [DIGEST_GREETING, "", DIGEST_INTRO, "", ...updates.map((u) => `• ${u.line}`)].join("\n");
}
function renderDigest(updates: { line: string }[]): string {
  return renderEditedEmailHtml({
    address: ADDRESS, heading: `Updates on ${ADDRESS}`, text: digestText(updates),
    portalUrl: PORTAL_URL, theme: resolveEmailTheme(null),
  });
}

export default function Page() {
  const vendorCopy = getMilestoneCopy("VM7").emailCopy!.vendor!;
  const buyerCopy = getMilestoneCopy("PM14").emailCopy!.purchaser!;

  const singleBatch: PreviewRecipient[] = [
    {
      id: "c1", name: "Mrs Debbie Knight", role: "vendor", email: "debbie.knight@gmail.com", from: FROM,
      address: ADDRESS, portalUrl: PORTAL_URL, greeting: "Hi Debbie,",
      subject: interp(vendorCopy.subject), text: singleText(vendorCopy, "Hi Debbie,"), html: renderSingle(vendorCopy, "Hi Debbie,"),
    },
    {
      id: "c2", name: "Mr Tom Whitfield", role: "purchaser", email: "tom.whitfield@outlook.com", from: FROM,
      address: ADDRESS, portalUrl: PORTAL_URL, greeting: "Hi Tom,",
      subject: interp(buyerCopy.subject), text: singleText(buyerCopy, "Hi Tom,"), html: renderSingle(buyerCopy, "Hi Tom,"),
    },
  ];

  const digestBatch: PreviewRecipient[] = [
    {
      id: "d1", name: "Mrs Debbie Knight", role: "vendor", email: "debbie.knight@gmail.com", from: FROM,
      address: ADDRESS, portalUrl: PORTAL_URL, greeting: DIGEST_GREETING,
      subject: `Updates on ${ADDRESS}`, text: digestText(DIGEST_UPDATES), html: renderDigest(DIGEST_UPDATES),
      digestIntro: DIGEST_INTRO, digestUpdates: DIGEST_UPDATES,
    },
  ];

  return (
    <DevThemeShell>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted,#8A8178)" }}>Prototype · /dev</p>
      <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary,#2A2320)" }}>Review before send — v2</h1>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--agent-text-secondary,#5C544C)", lineHeight: 1.5 }}>
        The preview is the <strong>real</strong> email HTML (same renderers the send path uses), in a sandboxed iframe — byte-for-byte what lands in the inbox. Toggle dark mode top-right; open each to feel the chrome; edit + save re-renders faithfully.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ReviewDrawerV2 label="Open — single update (2 recipients)" recipients={singleBatch} />
        <ReviewDrawerV2 label="Open — digest (3 updates, 1 recipient)" recipients={digestBatch} />
      </div>
    </DevThemeShell>
  );
}
