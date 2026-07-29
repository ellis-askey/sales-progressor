import type { ScenePalette } from "../PropertyScene";

// Extended chain data — real fields from ChainDrawer.tsx + LinkCard.tsx.
// Status label set matches lib/chain/status.ts.
// Enrichments (sale price, agent person, milestone, activity, exchange band)
// are additions the deep-dive page shows over the compact drawer.

export type ChainLinkStatus =
  | "Unclaimed"
  | "Invited"
  | "Bounced"
  | "Declined"
  | "Claimed"
  | "Your file";

export type ChainLink = {
  id: string;
  position: number;      // 1..N top to bottom
  address1: string;      // first comma segment
  address2: string;      // rest
  postcode: string;
  agencyName: string;    // real: firmName from claimedBy or stubAgencyName
  status: ChainLinkStatus;
  scene: ScenePalette;
  isViewer: boolean;
  isYourFile: boolean;   // gets the coral left stripe in real drawer

  // Real drawer fields
  descriptorLine?: string;   // "Invite sent · 3d ago" / "Agent declined · 5d ago"
  progress?: number;         // 0..100 (only when claimed)
  predictedExchange?: string; // "late Aug" — currently suppressed behind MEDIANS_READY

  // Enrichments for the deep-dive page (labelled clearly)
  agentPerson?: string;      // "Sarah Whittaker" — deep-dive only
  agentEmail?: string;
  agentPhone?: string;
  price?: string;            // deep-dive only
  priceNumeric?: number;
  currentMilestone?: string; // deep-dive only
  lastActivity?: string;     // deep-dive only

  // For DECLINED
  declinedAt?: string;
  declinedReason?: string;

  // For Unclaimed / Invited
  contactHint?: string;      // suggested firm if unknown
};

export const fullChain: ChainLink[] = [
  {
    id: "l1", position: 1,
    address1: "18 Meadowlark Drive",
    address2: "Berkhamsted",
    postcode: "HP4 3AB",
    agencyName: "Beechwood Estates",
    status: "Claimed",
    scene: "autumn",
    isViewer: false,
    isYourFile: false,
    descriptorLine: "Claimed 5d ago",
    progress: 68,
    predictedExchange: "mid Aug",
    agentPerson: "Sarah Whittaker",
    agentEmail: "sarah@beechwood.co.uk",
    agentPhone: "01442 220 111",
    price: "£820,000",
    priceNumeric: 820000,
    currentMilestone: "Enquiries",
    lastActivity: "yesterday",
  },
  {
    id: "l2", position: 2,
    address1: "12 Oakfield Road",
    address2: "Berkhamsted",
    postcode: "HP4 3XX",
    agencyName: "Akeman Residential",
    status: "Your file",
    scene: "golden",
    isViewer: true,
    isYourFile: true,
    descriptorLine: "This is your file",
    progress: 62,
    agentPerson: "Ellis Laurent",
    agentEmail: "ellis@akemanres.co.uk",
    agentPhone: "01442 220 200",
    price: "£585,000",
    priceNumeric: 585000,
    currentMilestone: "Enquiries",
    lastActivity: "3h ago",
  },
  {
    id: "l3", position: 3,
    address1: "4 Church Terrace",
    address2: "Hemel Hempstead",
    postcode: "HP1 2EE",
    agencyName: "Roger Platt",
    status: "Declined",
    scene: "mist",
    isViewer: false,
    isYourFile: false,
    descriptorLine: "Agent declined · 4d ago",
    declinedAt: "23 Jul 2026",
    declinedReason: "Agent chose not to share sale updates",
    price: "£420,000",
    priceNumeric: 420000,
  },
  {
    id: "l4", position: 4,
    address1: "Rose Cottage",
    address2: "Church Lane, Hemel Hempstead",
    postcode: "HP1 3CC",
    agencyName: "Beckett & Sons",
    status: "Unclaimed",
    scene: "spring",
    isViewer: false,
    isYourFile: false,
    descriptorLine: "Email needed",
    price: "£340,000",
    priceNumeric: 340000,
    contactHint: "01442 220 900",
  },
];

export const chainSummary = {
  totalValue: "£2.16m",
  totalValueNumeric: 2165000,
  linkCount: 4,
  claimedCount: 2,       // Claimed + Your file
  claimRate: 50,
  weakestLink: "Roger Platt · declined 23 Jul",
  weakestLinkPosition: 3,
  predictedCompletion: "late September",
  daysOldest: 74,
  chainRisk: "medium" as const,
  brokenChain: false,
  chainSplit: false,
  bottleneckDaysBehind: 0,
};

// Chain-wide banners — mirrors real ChainDrawer banner order + copy
export type ChainBanner = {
  id: string;
  tone: "warn" | "danger" | "info";
  title: string;
  body: string;
  actionLabel?: string;
};

export const chainBanners: ChainBanner[] = [
  {
    id: "b1", tone: "warn",
    title: "An agent declined your invite",
    body: "4 Church Terrace, Hemel Hempstead. You can resend the invite if you'd like Roger Platt to reconsider.",
    actionLabel: "Resend the invite",
  },
];

// Cross-link activity — deep-dive addition (not in drawer)
export const chainActivity = [
  { id: "a1", timeAgo: "3h ago", link: "18 Meadowlark Drive", event: "Sarah at Beechwood confirmed searches received", kind: "milestone" as const },
  { id: "a2", timeAgo: "yesterday", link: "4 Church Terrace", event: "Roger Platt declined the chain invite", kind: "declined" as const },
  { id: "a3", timeAgo: "3 days ago", link: "12 Oakfield Road (you)", event: "You escalated Grange Legal", kind: "chase" as const },
  { id: "a4", timeAgo: "5 days ago", link: "18 Meadowlark Drive", event: "Sarah at Beechwood joined the chain", kind: "joined" as const },
];
