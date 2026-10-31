"use client";

// /dev/onward-readonly — seeded preview of the portal "Your onward" tab when we
// run the neighbour file but couldn't tie this client to a confirmable contact on
// it. This is the exact PortalOnwardReadOnly component the real portal now renders
// (OPM-2/OPM-3 fix): real live steps, property address, a "View only" badge and an
// honest "your team keeps this updated" line — with every Confirm/Skip/Upload
// control stripped so there are no dead buttons. Mock data only; blocks in prod.

import { notFound } from "next/navigation";
import { PortalOnwardReadOnly } from "@/components/portal/PortalOnwardReadOnly";

type Seed = {
  code: string;
  label: string;
  whoLabel: string;
  state: "done" | "now" | "locked";
  postExchange?: boolean;
};

// A realistic mid-process purchase: onboarding + mortgage done, searches/survey in
// flight, exchange still ahead.
const SEED: Seed[] = [
  { code: "PM1", label: "Instruct your solicitor", whoLabel: "Done by the buyer", state: "done" },
  { code: "PM3", label: "Complete ID & AML checks", whoLabel: "Done by the buyer", state: "done" },
  { code: "PM4", label: "Pay money on account to solicitor", whoLabel: "Done by the buyer", state: "done" },
  { code: "PM5", label: "Submit mortgage application", whoLabel: "Done by the buyer", state: "done" },
  { code: "PM6", label: "Lender valuation booked", whoLabel: "Arranged by the lender", state: "done" },
  { code: "PM11", label: "Mortgage offer received", whoLabel: "Issued by the lender", state: "now" },
  { code: "PM9", label: "Book your survey", whoLabel: "Arranged by the buyer", state: "now" },
  { code: "PM10", label: "Survey report received", whoLabel: "Produced by the surveyor", state: "locked" },
  { code: "PM7", label: "Draft contract pack received", whoLabel: "Sent by the seller's solicitor", state: "done" },
  { code: "PM8", label: "Searches ordered", whoLabel: "Ordered by the buyer's solicitor", state: "now" },
  { code: "PM13", label: "Search results received", whoLabel: "Returned by the authorities", state: "locked" },
  { code: "PM14", label: "Initial enquiries raised", whoLabel: "Raised by the buyer's solicitor", state: "locked" },
  { code: "PM22", label: "Contract documents issued to you", whoLabel: "Sent by the buyer's solicitor", state: "locked" },
  { code: "PM26", label: "Contracts exchanged", whoLabel: "Handled by both solicitors", state: "locked", postExchange: true },
];

export default function DevOnwardReadOnlyPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const now = Date.now();
  const milestones = SEED.map((s, i) => ({
    id: `seed-${s.code}`,
    code: s.code,
    orderIndex: i,
    isComplete: s.state === "done",
    isNotRequired: false,
    isAvailable: s.state !== "locked",
    isPostExchange: !!s.postExchange,
    isExchangeGate: s.code === "PM25",
    completedAt: s.state === "done" ? new Date(now - (SEED.length - i) * 86400000) : null,
    eventDate: null,
    expectedDate: null,
    label: s.label,
    labelOther: null,
    who: "other",
    whoLabel: s.whoLabel,
    confirmedByPortal: false,
    description: null,
    eventDateRequired: false,
  }));

  return (
    <PortalOnwardReadOnly
      address="14 Emperor Close, Berkhamsted HP4 2AB"
      milestones={milestones}
      side="purchaser"
      hasExchanged={false}
      saleActive={true}
    />
  );
}
