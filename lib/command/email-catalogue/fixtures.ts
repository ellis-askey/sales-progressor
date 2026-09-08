// Synthetic fixture data for the Command Centre Email Catalogue. All clearly
// fake ("Preview Estates"). No live tenant data is read, so the catalogue is
// safe to render on any environment and raises no multi-tenant concern.
//
// Shapes here feed the REAL email builders — see registry.ts. Keep values
// realistic so the previews read like genuine sends.

import { resolveEmailTheme, type EmailTheme, type EmailThemeInput } from "@/lib/email/brand-theme";

export const CATALOGUE_BASE = "https://portal.thesalesprogressor.co.uk";

// The fake agency the previews are sent "on behalf of".
export const FIXTURE_AGENCY = {
  name: "Preview Estates",
  // Authenticated sending identity (as if verified in SendGrid).
  quoteSenderEmail: "hello@previewestates.co.uk",
  quoteSenderVerified: true,
  domain: "previewestates.co.uk",
  // Logo band inputs — no real logo file in fixtures, so the logo band renders
  // empty and email bodies fall back to the agency name as text (matches an
  // agency that hasn't uploaded a logo).
  logoPath: null as string | null,
  logoTileColor: "#ffffff" as string | null,
  logoScale: "md" as string | null,
  logoAlign: "left" as string | null,
};

// The agency's own agent (signs self-managed files).
export const FIXTURE_AGENT = {
  name: "Emily Chen",
  firstName: "Emily",
  email: "emily@previewestates.co.uk", // on the authenticated agency domain
  jobTitle: "Director",
  phone: "+44 117 496 0100",
  directMobile: "+44 7508 862929",
};

// Our internal progressor (runs outsourced files; signs the in-house block).
export const FIXTURE_PROGRESSOR = {
  name: "Ellis Askey",
  firstName: "Ellis",
  email: "ellis@thesalesprogressor.co.uk",
  phone: "+44 117 900 1234",
};

export const FIXTURE_PROPERTY = {
  address: "12 Oakfield Road, Wandsworth",
  addressShort: "12 Oakfield Road",
  postcode: "SW18 3RT",
  pricePence: 45000000,
  completionDateLong: "Friday, 19 September 2026",
};

export const FIXTURE_VENDORS = [
  { firstName: "Sarah", name: "Sarah Bennett" },
  { firstName: "Tom", name: "Tom Bennett" },
];
export const FIXTURE_PURCHASERS = [{ firstName: "James", name: "James Carter" }];

export const FIXTURE_SOLICITORS = {
  vendorFirm: "Whitfield & Co Solicitors",
  purchaserFirm: "Bartlett Legal",
  handlerFirstName: "Rachel",
};

// A sample custom theme so the toolbar's "custom" branding value shows real
// theming (navy flat header + teal button), distinct from the coral default.
const CUSTOM_THEME_INPUT: EmailThemeInput = { headerColor: "#0F1B2D", buttonColor: "#2E7D6B" };

export function catalogueTheme(kind: "coral" | "custom"): EmailTheme {
  return resolveEmailTheme(kind === "custom" ? CUSTOM_THEME_INPUT : null);
}

// Join names for subjects/bodies: "A", "A & B", "A, B & C".
export function joinNames(names: string[]): string {
  const c = names.filter(Boolean);
  if (c.length === 0) return "";
  if (c.length === 1) return c[0];
  return `${c.slice(0, -1).join(", ")} & ${c[c.length - 1]}`;
}
