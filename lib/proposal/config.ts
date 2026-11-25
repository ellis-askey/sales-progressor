// Shared, environment-agnostic configuration for the Boardwalk partnership
// proposal microsite. Safe to import from both server and client code — holds
// no secrets. The password, signing key and analytics all live server-side
// (lib/proposal/auth.ts, lib/proposal/access.ts).

export const PROPOSAL_SLUG = "boardwalk";

/** The non-public location the original PDF is streamed from (never under /public). */
export const PROPOSAL_PDF_RELATIVE = "private/proposal/beyond-sales-progression.pdf";
export const PROPOSAL_PDF_DOWNLOAD_NAME = "Beyond Sales Progression — TSP x Boardwalk.pdf";

/** Fallback access password when no ProposalAccess row exists yet (pre-migration). */
export const PROPOSAL_DEFAULT_PASSWORD = "2027";

// ── The narrative. One entry per section, in reading order. Drives the chapter
// navigation, the scroll-progress indicator and the analytics section map, so
// there is exactly one source of truth for "what sections exist". ────────────
export interface ProposalSectionDef {
  id: string;
  /** Short label for the chapter rail. */
  nav: string;
  /** Section eyebrow number shown in the rail and header. */
  index: number;
  /** Whether it appears in the chapter navigation (the cover does not). */
  inNav: boolean;
}

export const PROPOSAL_SECTIONS: ProposalSectionDef[] = [
  { id: "cover", nav: "Top", index: 0, inNav: false },
  { id: "opportunity", nav: "The opportunity", index: 1, inNav: true },
  { id: "platform", nav: "The platform", index: 2, inNav: true },
  { id: "partnership", nav: "The partnership", index: 3, inNav: true },
  { id: "cycle", nav: "Build once", index: 4, inNav: true },
  { id: "forms", nav: "Forms & tasks", index: 5, inNav: true },
  { id: "flywheel", nav: "Growth flywheel", index: 6, inNav: true },
  { id: "chain", nav: "Organic reach", index: 7, inNav: true },
  { id: "commercial", nav: "Commercial model", index: 8, inNav: true },
  { id: "boardwalk", nav: "Boardwalk economics", index: 9, inNav: true },
  { id: "progressor", nav: "Progressor network", index: 10, inNav: true },
  { id: "software", nav: "Operational tools", index: 11, inNav: true },
  { id: "combined", nav: "Combined model", index: 12, inNav: true },
  { id: "ai", nav: "AI & the source of truth", index: 13, inNav: true },
  { id: "investment", nav: "Investment", index: 14, inNav: true },
  { id: "equity", nav: "Partnership & equity", index: 15, inNav: true },
  { id: "roadmap", nav: "Roadmap", index: 16, inNav: true },
  { id: "governance", nav: "Governance & risk", index: 17, inNav: true },
  { id: "closing", nav: "Where we go", index: 18, inNav: true },
];

export const PROPOSAL_SECTION_IDS = PROPOSAL_SECTIONS.map((s) => s.id);
export const CLOSING_SECTION_ID = "closing";

export type ProposalEventKind =
  | "auth_success"
  | "section_view"
  | "section_expand"
  | "calculator_open"
  | "reached_close"
  | "pdf_download"
  | "return_visit";

export const PROPOSAL_EVENT_KINDS: ProposalEventKind[] = [
  "auth_success",
  "section_view",
  "section_expand",
  "calculator_open",
  "reached_close",
  "pdf_download",
  "return_visit",
];
