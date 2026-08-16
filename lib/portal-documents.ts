// Client-portal document taxonomy (Batch 2, 2026-08-17).
//
// The "Add document" flow is two dropdowns: Category -> Specific document. The
// list is role-filtered (buyers see buyer-relevant categories, sellers theirs).
// ID and proof/source of funds are deliberately NOT here: those are the agent's
// and conveyancer's AML duty, and we don't want to be the store for bank
// statements or photo ID. Buyers get a non-upload note instead (see the tab).

export type DocRole = "buyer" | "seller";

export type DocDef = {
  key: string;
  label: string;
  roles: DocRole[];
  leaseholdOnly?: boolean;
};

export type DocCategory = {
  key: string;
  label: string;
  docs: DocDef[];
};

const BOTH: DocRole[] = ["buyer", "seller"];

export const DOCUMENT_CATEGORIES: DocCategory[] = [
  {
    key: "sale-legal",
    label: "Sale & legal",
    docs: [
      { key: "mos", label: "Memorandum of Sale", roles: BOTH },
      { key: "draft-contract", label: "Draft contract", roles: BOTH },
      { key: "contract", label: "Contract", roles: BOTH },
      { key: "transfer-deed", label: "Transfer deed (TR1)", roles: BOTH },
      { key: "title-register", label: "Title register", roles: BOTH },
      { key: "title-plan", label: "Title plan", roles: BOTH },
      { key: "requisitions", label: "Requisitions on title", roles: BOTH },
      { key: "enquiries-replies", label: "Enquiries & replies", roles: BOTH },
    ],
  },
  {
    key: "property-info",
    label: "Property information",
    docs: [
      { key: "ta6", label: "Property Information Form (TA6)", roles: ["seller"] },
      { key: "ta10", label: "Fittings & Contents (TA10)", roles: ["seller"] },
      { key: "ta7", label: "Leasehold Information (TA7)", roles: ["seller"], leaseholdOnly: true },
      { key: "management-pack", label: "Management pack", roles: ["seller"], leaseholdOnly: true },
    ],
  },
  {
    key: "searches",
    label: "Searches",
    docs: [
      { key: "search-local", label: "Local authority search", roles: ["buyer"] },
      { key: "search-water", label: "Water & drainage search", roles: ["buyer"] },
      { key: "search-environmental", label: "Environmental search", roles: ["buyer"] },
      { key: "search-coal", label: "Coal mining search", roles: ["buyer"] },
      { key: "search-chancel", label: "Chancel repair search", roles: ["buyer"] },
    ],
  },
  {
    key: "survey-energy",
    label: "Survey & energy",
    docs: [
      { key: "mortgage-valuation", label: "Mortgage valuation", roles: ["buyer"] },
      { key: "homebuyer-report", label: "Homebuyer report (Level 2)", roles: ["buyer"] },
      { key: "building-survey", label: "Building survey (Level 3)", roles: ["buyer"] },
      { key: "epc", label: "EPC", roles: ["seller"] },
    ],
  },
  {
    key: "mortgage-finance",
    label: "Mortgage & finance",
    docs: [
      { key: "agreement-in-principle", label: "Agreement in principle", roles: ["buyer"] },
      { key: "mortgage-offer", label: "Mortgage offer", roles: ["buyer"] },
    ],
  },
  {
    key: "guarantees",
    label: "Guarantees & certificates",
    docs: [
      { key: "fensa", label: "FENSA (windows)", roles: ["seller"] },
      { key: "gas-safe", label: "Gas Safe certificate", roles: ["seller"] },
      { key: "eicr", label: "Electrical certificate (EICR)", roles: ["seller"] },
      { key: "damp-guarantee", label: "Damp / timber guarantee", roles: ["seller"] },
      { key: "nhbc", label: "NHBC / new-build warranty", roles: ["seller"] },
    ],
  },
  {
    key: "leasehold",
    label: "Leasehold",
    docs: [
      { key: "lease", label: "Lease", roles: ["seller"], leaseholdOnly: true },
      { key: "ground-rent-accounts", label: "Ground rent / service charge accounts", roles: ["seller"], leaseholdOnly: true },
      { key: "share-of-freehold", label: "Share of freehold documents", roles: ["seller"], leaseholdOnly: true },
    ],
  },
  {
    key: "completion",
    label: "Completion",
    docs: [
      { key: "completion-statement", label: "Completion statement", roles: BOTH },
      { key: "financial-statement", label: "Financial statement", roles: BOTH },
      { key: "sdlt-return", label: "Stamp Duty (SDLT) return", roles: ["buyer"] },
      { key: "buildings-insurance", label: "Buildings insurance", roles: ["buyer"] },
      { key: "land-registry", label: "Land Registry confirmation", roles: BOTH },
    ],
  },
  {
    key: "other",
    label: "Other",
    docs: [{ key: "other", label: "Other document", roles: BOTH }],
  },
];

const ALL_DOCS: DocDef[] = DOCUMENT_CATEGORIES.flatMap((c) => c.docs);
const DOC_BY_KEY = new Map(ALL_DOCS.map((d) => [d.key, d]));
const CATEGORY_BY_DOC = new Map(
  DOCUMENT_CATEGORIES.flatMap((c) => c.docs.map((d) => [d.key, c])),
);

export function docLabel(key: string | null | undefined): string {
  if (!key) return "Document";
  return DOC_BY_KEY.get(key)?.label ?? "Document";
}

export function docCategoryLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return CATEGORY_BY_DOC.get(key)?.label ?? null;
}

export function isKnownDocType(key: string): boolean {
  return DOC_BY_KEY.has(key);
}

// Role- + tenure-filtered category list for the "Add document" dropdowns.
export function categoriesFor(role: DocRole, tenure: "freehold" | "leasehold"): DocCategory[] {
  return DOCUMENT_CATEGORIES
    .map((c) => ({
      ...c,
      docs: c.docs.filter((d) => d.roles.includes(role) && (!d.leaseholdOnly || tenure === "leasehold")),
    }))
    .filter((c) => c.docs.length > 0);
}

// The "ready to add" placeholders shown per side (+ leasehold extras). MOS is
// handled separately (it comes from the agent), so it's not listed here.
export function readyToAddKeys(role: DocRole, tenure: "freehold" | "leasehold"): string[] {
  if (role === "buyer") {
    return ["mortgage-offer", "agreement-in-principle", "homebuyer-report", "buildings-insurance"];
  }
  const base = ["ta6", "ta10", "epc", "gas-safe", "eicr"];
  return tenure === "leasehold" ? [...base, "ta7", "management-pack", "lease"] : base;
}
