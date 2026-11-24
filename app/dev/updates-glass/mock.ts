// /dev/updates-glass — MOCK DATA ONLY. Dev prototype. No DB, no real records.
// Shapes mirror the real Updates feed (components/comms/CommsActivityFeed.tsx:
// UpdateRow / TxGroup / DayBucket) so the redesign preserves every datum the
// live page shows. Representative sample content chosen to exercise every
// filter (all six kinds, both sides, every stage, each status). Addresses and
// names are fictional samples, confined to this dev-only file.

export type Side = "vendor" | "purchaser" | null;
export type Who = "agent" | "client" | "helper" | "solicitor";
export type Kind = "milestone" | "price" | "note" | "reply" | "document" | "notification";
export type StageKey =
  | "instructed" | "draft_pack" | "finances" | "searches" | "enquiries" | "exchange" | "completion";

type RowBase = { id: string; atIso: string; who: Who; side: Side };

export type UpdateRow =
  | (RowBase & { kind: "milestone"; stageKey: StageKey | null; sentence: string; byName: string | null; byImage?: string | null })
  | (RowBase & { kind: "price"; oldPrice: number | null; newPrice: number; reason: string | null; byName: string | null })
  | (RowBase & { kind: "note"; content: string; byName: string | null; byImage?: string | null })
  | (RowBase & { kind: "reply"; content: string })
  | (RowBase & { kind: "document"; filename: string; docUrl: string | null; byName: string | null })
  | (RowBase & { kind: "notification"; sentence: string; pill: string | null });

export type TxGroup = {
  transactionId: string;
  transactionAddress: string;
  status: "active" | "on_hold" | "completed" | "withdrawn";
  expectedExchangeIso: string | null;
  snapshot: { percent: number; stage: string; nextAction: string | null } | null;
  updates: UpdateRow[];
};

export type DayBucket = { label: string; defaultOpen: boolean; txGroups: TxGroup[] };

const now = Date.now();
const mins = (m: number) => new Date(now - m * 60_000).toISOString();
const days = (d: number) => new Date(now + d * 86_400_000).toISOString();

// Representative "uploaded profile photo" (an illustrated portrait, standing in
// for a real photo) so the UserAvatar image branch can be verified alongside the
// branded SVG fallback. Deliberately not the coral brand art.
const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' fill='#6b8cc7'/><circle cx='40' cy='33' r='15' fill='#f3cda8'/><path d='M13 80c0-17 13-25 27-25s27 8 27 25z' fill='#f3cda8'/><path d='M23 31c0-16 34-16 34 0 0-6-4-14-17-14s-17 8-17 14z' fill='#4a3426'/></svg>"
);

export const MOCK_DAYS: DayBucket[] = [
  {
    label: "Today",
    defaultOpen: true,
    txGroups: [
      {
        transactionId: "tx-alder",
        transactionAddress: "14 Bushey Avenue, Broxbourne, EN10 6QE",
        status: "active",
        expectedExchangeIso: days(11),
        snapshot: { percent: 62, stage: "Enquiries", nextAction: "Chase the buyer's solicitor for replies" },
        updates: [
          { id: "u1", kind: "milestone", atIso: mins(18), who: "agent", side: null, stageKey: "enquiries", sentence: "You confirmed all enquiries have been raised with the seller's solicitor.", byName: "Ellis Askey", byImage: PHOTO },
          { id: "u2", kind: "reply", atIso: mins(52), who: "solicitor", side: null, content: "We confirm the boundary runs along the eastern fence line; a copy of the deed plan is enclosed for your records." },
          { id: "u3", kind: "note", atIso: mins(120), who: "client", side: "purchaser", content: "Happy to proceed and keen to exchange before the end of the month.", byName: "James Okafor" },
          { id: "u4", kind: "price", atIso: mins(200), who: "agent", side: "vendor", oldPrice: 42_500_000, newPrice: 41_500_000, reason: "Reduced by £10,000 following the buyer's survey.", byName: "Ellis Askey" },
        ],
      },
      {
        transactionId: "tx-maple",
        transactionAddress: "3 Maple Court, Hertford, SG14 1QF",
        status: "on_hold",
        expectedExchangeIso: days(29),
        snapshot: { percent: 38, stage: "Searches", nextAction: "Receive the local authority search" },
        updates: [
          { id: "u5", kind: "document", atIso: mins(90), who: "agent", side: null, filename: "Local-Authority-Search.pdf", docUrl: "#", byName: "Priya Shah" },
          { id: "u6", kind: "notification", atIso: mins(240), who: "client", side: "purchaser", sentence: "The buyer completed their identity checks.", pill: "ID verified" },
        ],
      },
    ],
  },
  {
    label: "Yesterday",
    defaultOpen: true,
    txGroups: [
      {
        transactionId: "tx-victoria",
        transactionAddress: "7 Victoria Road, Ware, SG12 7AB",
        status: "active",
        expectedExchangeIso: days(4),
        snapshot: { percent: 81, stage: "Exchange", nextAction: "Confirm you're ready to exchange" },
        updates: [
          { id: "u7", kind: "milestone", atIso: mins(1500), who: "agent", side: null, stageKey: "exchange", sentence: "You confirmed you're ready to exchange contracts.", byName: "Ellis Askey" },
          { id: "u14", kind: "note", atIso: mins(1530), who: "client", side: "vendor", content: "Confirmed I'm happy with the proposed completion date.", byName: "Margaret Hill" },
          { id: "u8", kind: "notification", atIso: mins(1560), who: "client", side: "vendor", sentence: "The seller signed and returned their contract.", pill: "Contract signed" },
        ],
      },
      {
        transactionId: "tx-alder",
        transactionAddress: "14 Bushey Avenue, Broxbourne, EN10 6QE",
        status: "active",
        expectedExchangeIso: days(11),
        snapshot: { percent: 62, stage: "Enquiries", nextAction: "Chase the buyer's solicitor for replies" },
        updates: [
          { id: "u9", kind: "milestone", atIso: mins(1680), who: "agent", side: null, stageKey: "searches", sentence: "Searches were received back from the local authority with no adverse entries.", byName: "Priya Shah" },
        ],
      },
    ],
  },
  {
    label: "Monday, 3 November",
    defaultOpen: false,
    txGroups: [
      {
        transactionId: "tx-nathaniel",
        transactionAddress: "22 Nathaniels Walk, Harlow, CM17 9GX",
        status: "completed",
        expectedExchangeIso: days(-6),
        snapshot: { percent: 100, stage: "Post-exchange", nextAction: null },
        updates: [
          { id: "u10", kind: "milestone", atIso: mins(4320), who: "agent", side: null, stageKey: "completion", sentence: "The sale completed and the keys were released to the buyer.", byName: "Ellis Askey" },
          { id: "u11", kind: "note", atIso: mins(4400), who: "agent", side: null, content: "Lovely result, client was delighted and left a five-star review.", byName: "Ellis Askey" },
        ],
      },
      {
        transactionId: "tx-kingfisher",
        transactionAddress: "9 Kingfisher Drive, Bishop's Stortford, CM23 4LP",
        status: "active",
        expectedExchangeIso: days(54),
        snapshot: { percent: 18, stage: "Instructed", nextAction: "Issue the memorandum of sale" },
        updates: [
          { id: "u12", kind: "milestone", atIso: mins(4600), who: "agent", side: null, stageKey: "instructed", sentence: "You instructed the solicitor to act on the sale.", byName: "Ellis Askey" },
          { id: "u13", kind: "document", atIso: mins(4700), who: "agent", side: null, filename: "Memorandum-of-Sale.pdf", docUrl: "#", byName: "Ellis Askey" },
        ],
      },
    ],
  },
];
