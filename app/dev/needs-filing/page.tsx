"use client";

// /dev/needs-filing — review page for critique #296.
//
// Renders the REAL <NeedsFilingCard> (the hub "Needs filing" tray) with crafted
// rows, so what you approve here is byte-for-byte what ships. The headline
// specimen is the 2 Magnolia Way case: two files at the SAME address (an on-hold
// old sale + a new active sale). The fix sorts the active file first and appends
// each file's state + price so the two buttons are no longer identical. Dev-only.
//
// Buttons are visual only here (the file/dismiss server actions run against real
// ids; these crafted ids simply no-op). Resize the window to see the mobile wrap.

import { notFound } from "next/navigation";
import { NeedsFilingCard } from "@/components/hub/NeedsFilingCard";
import type { PendingInboundRow } from "@/lib/services/pending-inbound";

const ADDR = "2 Magnolia Way, Cheshunt, Waltham Cross, EN8 0FD";
const mins = (n: number) => new Date(Date.now() - n * 60000);

type Specimen = { name: string; when: string; rows: PendingInboundRow[] };

const SPECIMENS: Specimen[] = [
  {
    name: "1 · Two files at the same address (the fix)",
    when:
      "What you hit on 2 Magnolia Way: an on-hold old sale and a new active sale, same address. Before, both buttons just said “File to 2 Magnolia Way”. Now the active file leads and each button shows its state + price.",
    rows: [
      {
        id: "dev-dup-1",
        direction: "inbound",
        subject: "Sale of 2 Magnolia Way, Cheshunt, Waltham Cross, EN8 0FD",
        partyEmail: "billyjamesleonard@gmail.com",
        partyName: "Billy Leonard",
        receivedAt: mins(42),
        preview: "Hi, just following up on the sale progressing at 2 Magnolia Way, could you confirm where we are with searches.",
        // Deliberately on-hold FIRST, to prove the active one is sorted to the front.
        candidates: [
          { transactionId: "dev-tx-old", address: ADDR, status: "on_hold", priceLabel: "£385k" },
          { transactionId: "dev-tx-new", address: ADDR, status: "active", priceLabel: "£395k" },
        ],
      },
    ],
  },
  {
    name: "2 · Same address, as an email thread",
    when: "The same clash but across a reply thread (collapses to one card). The two distinguishable buttons file every email in the thread at once.",
    rows: [
      {
        id: "dev-thread-1",
        direction: "inbound",
        subject: "Re: 2 Magnolia Way Cheshunt Waltham Cross EN8 0FD",
        partyEmail: "john@viavia.co.uk",
        partyName: "John (Via Via)",
        receivedAt: mins(12),
        preview: "Thanks, noted. Will chase the other side today.",
        candidates: [
          { transactionId: "dev-tx-old", address: ADDR, status: "on_hold", priceLabel: "£385k" },
          { transactionId: "dev-tx-new", address: ADDR, status: "active", priceLabel: "£395k" },
        ],
      },
      {
        id: "dev-thread-2",
        direction: "outbound",
        subject: "2 Magnolia Way Cheshunt Waltham Cross EN8 0FD",
        partyEmail: "john@viavia.co.uk",
        partyName: "John (Via Via)",
        receivedAt: mins(90),
        preview: "Morning John, where are we up to on this one.",
        candidates: [
          { transactionId: "dev-tx-old", address: ADDR, status: "on_hold", priceLabel: "£385k" },
          { transactionId: "dev-tx-new", address: ADDR, status: "active", priceLabel: "£395k" },
        ],
      },
    ],
  },
  {
    name: "3 · One file (unchanged)",
    when: "The ordinary case: a single candidate file. No state/price suffix is added; the plain button is unchanged.",
    rows: [
      {
        id: "dev-single-1",
        direction: "inbound",
        subject: "Update on 25 Austin House",
        partyEmail: "conveyancing@brightsolicitors.co.uk",
        partyName: "Bright Solicitors",
        receivedAt: mins(200),
        preview: "Please find enclosed the draft contract pack for your review.",
        candidates: [
          { transactionId: "dev-tx-single", address: "25 Austin House, Leeds, LS1 4DL", status: "active", priceLabel: "£240k" },
        ],
      },
    ],
  },
  {
    name: "4 · Two DIFFERENT properties (unchanged)",
    when: "A solicitor acting on two of your sales. The addresses already differ, so no suffix is added. The suffix only appears when the address itself is identical.",
    rows: [
      {
        id: "dev-distinct-1",
        direction: "inbound",
        subject: "Enquiries round two",
        partyEmail: "conveyancing@brightsolicitors.co.uk",
        partyName: "Bright Solicitors",
        receivedAt: mins(300),
        preview: "Responses to the outstanding enquiries on both matters attached.",
        candidates: [
          { transactionId: "dev-tx-x", address: "54 Buryholme, Broxbourne, EN10 6PE", status: "active", priceLabel: "£310k" },
          { transactionId: "dev-tx-y", address: "129 High Road, Broxbourne, EN10 7BS", status: "active", priceLabel: "£275k" },
        ],
      },
    ],
  },
];

export default function DevNeedsFilingPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px 80px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>
        Needs-filing tray: distinguishable buttons
      </h1>
      <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", margin: "6px 0 0", lineHeight: 1.5 }}>
        Critique #296. The real hub tray card, showing how two files at one address now read apart. Resize narrow to
        see the buttons wrap on mobile.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 28 }}>
        {SPECIMENS.map((s) => (
          <section key={s.name}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", margin: "0 0 2px" }}>{s.name}</h2>
            <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 10px", lineHeight: 1.5 }}>{s.when}</p>
            <NeedsFilingCard rows={s.rows} defaultCollapsed={false} />
          </section>
        ))}
      </div>
    </div>
  );
}
