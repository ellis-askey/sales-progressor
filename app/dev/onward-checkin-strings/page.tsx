"use client";

// /dev/onward-checkin-strings — sign-off surface for the related-sale / onward-
// purchase → chain check-in bridge wording.
//
// Every one of the 9 check-in beats for each direction, rendered exactly as it
// would appear on a chains check-in "Last update" line: the confirmer's avatar
// (client = side-tinted initials, agent = photo) + the composed sentence + date.
// Our-side rows show both the client-confirmed and agent-confirmed line; far-
// side rows (solicitor unknown) show the neutral agent line only.
//
// Dev-only (404 in production). Review on localhost:3001. Nothing is wired into
// the live confirm actions until these are signed off.

import { notFound } from "next/navigation";
import { ContactAvatar } from "@/components/ui/Avatar";
import { onwardCheckInLine, type OnwardSide } from "@/lib/chain/onward-checkin-bridge";

const WHEN = "24th Oct";
const AGENT = "Ellis Askey";
const AGENT_IMG = "https://i.pravatar.cc/80?img=12";

type Row = {
  stepKey: string;
  beat: string;
  milestone: string | null; // our-side milestone code; null for a far-side beat
  side: OnwardSide; // the side this beat's phrasing follows
  ours: boolean; // our client's side (firm known) vs far side (neutral, agent-only)
};

// Canonical CHECK_IN_STEPS order, annotated per direction.
const RELATED_SALE: { client: string; clientRole: "purchaser" | "vendor"; solicitor: string; rows: Row[] } = {
  // Our buyer is the SELLER of their related sale. They confirm via their portal.
  client: "Abygail Keeley",
  clientRole: "purchaser", // our buyer → buyer-green
  solicitor: "Dutton Gregory",
  rows: [
    { stepKey: "dcp_issued", beat: "DCP issued", milestone: "VM7", side: "vendor", ours: true },
    { stepKey: "searches_ordered", beat: "Searches ordered", milestone: null, side: "purchaser", ours: false },
    { stepKey: "finances_arranged", beat: "Finances arranged", milestone: null, side: "purchaser", ours: false },
    { stepKey: "searches_received", beat: "Searches received", milestone: null, side: "purchaser", ours: false },
    { stepKey: "enquiries_raised", beat: "Enquiries raised", milestone: "VM10", side: "vendor", ours: true },
    { stepKey: "enquiries_satisfied", beat: "Enquiries satisfied", milestone: "VM21", side: "vendor", ours: true },
    { stepKey: "contracts_issued", beat: "Contracts issued", milestone: "VM16", side: "vendor", ours: true },
    { stepKey: "seller_signed_returned", beat: "Seller signed & returned", milestone: "VM17", side: "vendor", ours: true },
    { stepKey: "buyer_signed_returned", beat: "Buyer signed & returned", milestone: null, side: "purchaser", ours: false },
  ],
};

const ONWARD_PURCHASE: { client: string; clientRole: "purchaser" | "vendor"; solicitor: string; rows: Row[] } = {
  // Our seller is the BUYER of their onward purchase. They confirm via their portal.
  client: "Julie Martin",
  clientRole: "vendor", // our seller → seller-blue
  solicitor: "Sterling Law",
  rows: [
    { stepKey: "dcp_issued", beat: "DCP received", milestone: "PM7", side: "purchaser", ours: true },
    { stepKey: "searches_ordered", beat: "Searches ordered", milestone: "PM8", side: "purchaser", ours: true },
    { stepKey: "finances_arranged", beat: "Finances arranged", milestone: "PM11", side: "purchaser", ours: true },
    { stepKey: "searches_received", beat: "Searches received", milestone: "PM13", side: "purchaser", ours: true },
    { stepKey: "enquiries_raised", beat: "Enquiries raised", milestone: "PM14", side: "purchaser", ours: true },
    { stepKey: "enquiries_satisfied", beat: "Enquiries satisfied", milestone: "PM20", side: "purchaser", ours: true },
    { stepKey: "contracts_issued", beat: "Contracts issued", milestone: "PM22", side: "purchaser", ours: true },
    { stepKey: "seller_signed_returned", beat: "Seller signed & returned", milestone: null, side: "vendor", ours: false },
    { stepKey: "buyer_signed_returned", beat: "Buyer signed & returned", milestone: "PM23", side: "purchaser", ours: true },
  ],
};

function Line({ name, roleType, image, text }: { name: string; roleType: string; image?: string | null; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flexShrink: 0 }}>
        <ContactAvatar contact={{ name, roleType }} size={22} image={image ?? null} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>{text}</span>
        <span style={{ flexShrink: 0, fontSize: 11, lineHeight: 1.45, color: "var(--agent-text-faint, #b8b0a4)", whiteSpace: "nowrap" }}>{WHEN}</span>
      </div>
    </div>
  );
}

function Direction({
  title,
  sub,
  data,
}: {
  title: string;
  sub: string;
  data: typeof RELATED_SALE;
}) {
  const clientSource = data.clientRole === "purchaser" ? "buyer" : "seller"; // our buyer confirms related; our seller confirms onward
  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", margin: "4px 0 0", lineHeight: 1.5 }}>{sub}</p>
      <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
        {data.rows.map((r) => (
          <div
            key={r.stepKey}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--agent-border-subtle)",
              background: "var(--agent-surface-elevated, #fff)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)" }}>{r.beat}</span>
              {r.milestone && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--agent-text-muted)", background: "rgba(127,127,127,0.12)", padding: "1px 7px", borderRadius: 99 }}>{r.milestone}</span>
              )}
              <span style={{ fontSize: 10.5, fontWeight: 600, color: r.ours ? "var(--agent-coral-deep)" : "var(--agent-text-faint, #b8b0a4)", marginLeft: "auto" }}>
                {r.ours ? "Our side · firm known" : "Far side · neutral"}
              </span>
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              {r.ours && (
                <Line
                  name={data.client}
                  roleType={data.clientRole}
                  text={onwardCheckInLine({ stepKey: r.stepKey, side: r.side, source: clientSource, confirmerName: data.client, solicitorName: data.solicitor })}
                />
              )}
              <Line
                name={AGENT}
                roleType="agent"
                image={AGENT_IMG}
                text={onwardCheckInLine({ stepKey: r.stepKey, side: r.side, source: "agent", confirmerName: AGENT, solicitorName: r.ours ? data.solicitor : null })}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DevOnwardCheckinStringsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 20px 90px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>
        Related sale / onward purchase &rarr; check-in lines
      </h1>
      <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", margin: "6px 0 0", lineHeight: 1.55 }}>
        Every one of the 9 check-in beats for each direction, rendered as it will appear on the chains
        check-in &ldquo;Last update&rdquo; line. Each shows the <b>client-confirmed</b> line (where applicable) and the
        <b> agent-confirmed</b> line. Our client&rsquo;s side names the solicitor; the far side (solicitor unknown)
        falls back to the neutral agent line with no client line. Sign off here before it&rsquo;s wired into the
        live confirm actions.
      </p>

      <Direction
        title="1 · Our buyer's related sale"
        sub="Our buyer is the seller of that sale, confirming via their portal (buyer-green). Firm is our buyer's solicitor."
        data={RELATED_SALE}
      />
      <Direction
        title="2 · Our seller's onward purchase"
        sub="Our seller is the buyer of that sale, confirming via their portal (seller-blue). Firm is our seller's solicitor."
        data={ONWARD_PURCHASE}
      />
    </div>
  );
}
