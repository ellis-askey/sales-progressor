// PM12 — Buyer's solicitor has received the management pack from the
// vendor's solicitor.
//
// Leasehold-only milestone (auto-NR'd on freehold). Final step in the
// three-event management-pack arc — VM8 (requested) → VM9 (received by
// seller) → PM12 (received by buyer). The "what is a management pack"
// explainer lives in VM8; the "back on the seller's side" heads-up
// lives in VM9; this milestone owns the "now with the buyer's
// solicitor — review starts" moment. Non-bilateral.

import type { MilestoneSkeleton } from "@/lib/email-assembler";

export const PM12_SKELETON: MilestoneSkeleton = {

  purchaser: {
    subject: [
      { text: "Your solicitor has the management pack — {address}" },
    ],
    heroLabel: [
      { text: "Management pack with your solicitor" },
    ],
    opening: [
      { text: "Your solicitor now has the management pack." },
    ],
    whatHappened: [
      // VM8 already explained the pack composition (lease, service
      // charges, ground rent, planned works, insurance, disputes) when
      // the seller's solicitor requested it weeks ago. Re-listing it
      // here would mean the buyer reads the same bundle description
      // twice in the management-pack arc, so this body skips the
      // contents recap and focuses on what's about to happen with it.
      {
        text: "The management pack has been forwarded across from the seller's solicitor and is now with your solicitor. They can review the leasehold side of the property in full alongside the rest of the contract pack.",
      },
    ],
    whatNext: [
      {
        text: "Your solicitor will work through the pack carefully and is likely to raise leasehold-specific enquiries with the seller's side over the next week or two. The leasehold detail is where buyer's solicitors tend to scrutinise most closely, so don't be surprised if the enquiries list is meaningful — that's the job being done properly.",
      },
      {
        text: "If your solicitor flags anything significant to you (a major works charge coming, an unusually short lease, a service charge arrears, a restrictive clause), that's the moment to read carefully and ask questions before deciding how to proceed.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  vendor: {
    subject: [
      { text: "Buyer's solicitor has the management pack — {address}" },
    ],
    heroLabel: [
      { text: "Management pack with buyer's side" },
    ],
    opening: [
      { text: "The management pack is now with the buyer's solicitor." },
    ],
    whatHappened: [
      {
        text: "The buyer's solicitor has confirmed receipt of the management pack. With the rest of the contract pack already on their side, they can now review the leasehold detail in full.",
      },
    ],
    whatNext: [
      {
        text: "Expect leasehold-specific enquiries to come back from the buyer's solicitor over the next week or two. Your solicitor will handle those, but may need your input on points the freeholder is best placed to answer — planned works, service charge history, anything the management pack didn't cover cleanly.",
      },
    ],
    action: [
      { text: "View your portal" },
    ],
  },

  progressor: {
    subject: [
      { text: "PM12 complete: Management pack received by buyer's side — {address}" },
    ],
    heroLabel: [
      { text: "PM12 — Management pack received by buyer's solicitor" },
    ],
    opening: [
      { text: "Logged on {address}." },
    ],
    whatHappened: [
      { text: "Purchaser solicitor has confirmed receipt of management pack from vendor solicitor." },
    ],
    action: [
      { text: "View transaction" },
    ],
  },
};
