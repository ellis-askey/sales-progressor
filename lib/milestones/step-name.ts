// Steps-tab display personalisation (critique 8fh91y).
//
// Milestone step labels are stored generically ("Seller has instructed their
// solicitor", "Buyer's solicitor has ordered searches"). We hold the real
// parties on the file, so on the AGENT Steps tab we swap the generic references
// for the actual names — the solicitor FIRM, and the seller/buyer names (full,
// titles stripped). Anything we don't have falls back to the exact generic
// wording, so a label never reads half-filled.
//
// Scope: agent Steps tab only. The client portal and client emails are NOT
// touched — they keep the plain wording.
//
// Grammar (British English):
//   - a firm acts as a body → plural verb ("Curwens have issued")
//   - a client subject agrees with the count (one → has, two+ → have)
//   - the singular fallback ("the seller's solicitor") stays "has"
//
// See the approved before/after table for every step.

import { nameWithoutTitle } from "@/lib/contacts/displayName";

export type PartyNameContext = {
  sellers: string | null; // "Neil Emery" / "Neil Emery and Jane Emery" (full, no titles); null if none on file
  sellerCount: number;
  buyers: string | null;
  buyerCount: number;
  sellerFirm: string | null; // solicitor firm name; null if not set
  buyerFirm: string | null;
};

const joinNames = (arr: string[]): string | null =>
  arr.length === 0 ? null : arr.length === 1 ? arr[0] : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? "").trim();
  return t ? t : null;
};

// Build the context from the file's contacts + solicitor firms. Principals only
// (a helper is never named), and purchasers scoped to the active buyer round so
// a relisted file never shows the previous buyer's name.
export function buildPartyNameContext(
  contacts: Array<{ name: string; roleType: string; isPrincipal: boolean; buyerRoundId: string | null }>,
  sellerFirm: string | null,
  buyerFirm: string | null,
  activeBuyerRoundId: string | null,
): PartyNameContext {
  const sellerNames = contacts
    .filter((c) => c.roleType === "vendor" && c.isPrincipal)
    .map((c) => nameWithoutTitle(c.name))
    .filter((n): n is string => !!n && !!n.trim());
  const buyerNames = contacts
    .filter((c) => c.roleType === "purchaser" && c.isPrincipal && (activeBuyerRoundId ? c.buyerRoundId === activeBuyerRoundId : true))
    .map((c) => nameWithoutTitle(c.name))
    .filter((n): n is string => !!n && !!n.trim());

  return {
    sellers: joinNames(sellerNames),
    sellerCount: sellerNames.length,
    buyers: joinNames(buyerNames),
    buyerCount: buyerNames.length,
    sellerFirm: clean(sellerFirm),
    buyerFirm: clean(buyerFirm),
  };
}

// Personalise a single step label. Pure string work, so it runs on the client
// row. Each slot resolves independently and falls back to the generic wording
// when the name/firm isn't on file. Order matters (firm-as-subject and the
// possessive "…'s solicitor" before the bare "the seller/buyer").
export function personaliseStepName(name: string, code: string, ctx: PartyNameContext): string {
  const side: "vendor" | "purchaser" = code.startsWith("VM") ? "vendor" : "purchaser";
  let s = name;

  // 1. Firm as the subject → plural verb.
  if (ctx.sellerFirm) s = s.replace(/^Seller's solicitor has /, `${ctx.sellerFirm} have `);
  if (ctx.buyerFirm) s = s.replace(/^Buyer's solicitor has /, `${ctx.buyerFirm} have `);

  // 2. Firm named possessively as an object (the OTHER side's solicitor).
  if (ctx.buyerFirm) s = s.replace(/the buyer's solicitor/g, ctx.buyerFirm);
  if (ctx.sellerFirm) s = s.replace(/the (?:seller|vendor)'s solicitor/g, ctx.sellerFirm);

  // 3. Client as the subject → verb agrees with the count.
  if (ctx.sellers) s = s.replace(/^Seller has /, `${ctx.sellers} ${ctx.sellerCount > 1 ? "have" : "has"} `);
  if (ctx.buyers) s = s.replace(/^Buyer has /, `${ctx.buyers} ${ctx.buyerCount > 1 ? "have" : "has"} `);

  // 4. Client as an object ("the seller" / "the buyer", never the possessive).
  if (ctx.sellers) s = s.replace(/the seller(?!'s)/g, ctx.sellers);
  if (ctx.buyers) s = s.replace(/the buyer(?!'s)/g, ctx.buyers);

  // 5. "their solicitor" → the client's OWN-side firm.
  const ownFirm = side === "vendor" ? ctx.sellerFirm : ctx.buyerFirm;
  if (ownFirm) s = s.replace(/their solicitor/g, ownFirm);

  return s;
}
