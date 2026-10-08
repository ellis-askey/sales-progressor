// lib/auth/company-name.ts
// Keep company names from duplicating each other — or our own brand — at signup.
//
// Neither Agency.name nor ProgressionBusiness.name has a DB-level unique
// constraint, and names are typed free-hand at signup. This guard runs inside the
// account-creation transaction (createDirectorWithAgency /
// createProgressionBusinessWithOwner) and throws a friendly, surfaced error if the
// typed name is reserved (our brand) or already in use by another agency or
// progression business. Comparison is case-, punctuation-, suffix- and
// spacing-insensitive, so "The Sales Progressor Ltd." and "thesalesprogressor"
// both resolve to the reserved brand.

import type { Prisma, PrismaClient } from "@prisma/client";

export class CompanyNameUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyNameUnavailableError";
  }
}

// Canonical form for comparison: lowercase, strip punctuation + common legal
// suffixes (ltd / limited / llp / plc / inc / co), collapse whitespace.
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, " ")
    .replace(/\b(ltd|limited|llp|plc|inc|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Despaced key — also catches "TheSalesProgressor" / "sales  progressor".
function despaced(name: string): string {
  return normalizeCompanyName(name).replace(/\s/g, "");
}

// Our own brand. Never available to another agency or business.
const RESERVED_DESPACED = new Set(
  ["the sales progressor", "sales progressor", "tsp"].map(despaced),
);

export function isReservedCompanyName(name: string): boolean {
  return RESERVED_DESPACED.has(despaced(name));
}

type DbClient = PrismaClient | Prisma.TransactionClient;

// Throws CompanyNameUnavailableError when the name is our reserved brand, or is
// already used by an existing agency or (non-TSP) progression business. Scanning
// every name and normalising in memory is fine at the current agency/business
// counts; if that set ever grows large, back this with a stored normalised column
// + a unique index.
export async function assertCompanyNameAvailable(
  db: DbClient,
  rawName: string,
  label: "agency" | "business",
): Promise<void> {
  const norm = normalizeCompanyName(rawName);
  if (!norm) return; // empty is caught by the required-field checks upstream

  if (isReservedCompanyName(rawName)) {
    throw new CompanyNameUnavailableError("That name isn't available. Please choose a different one.");
  }

  const [agencies, businesses] = await Promise.all([
    db.agency.findMany({ select: { name: true } }),
    db.progressionBusiness.findMany({ where: { isTsp: false }, select: { name: true } }),
  ]);
  const taken = [...agencies, ...businesses].some((r) => normalizeCompanyName(r.name) === norm);
  if (taken) {
    throw new CompanyNameUnavailableError(`That ${label} name is already taken. Please choose a different one.`);
  }
}
