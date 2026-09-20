// lib/services/property-intel.ts
// Fetches Land Registry price paid history and EPC data for a property address.

export function extractPostcode(address: string): string | null {
  const match = address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i);
  return match ? match[0].toUpperCase().replace(/\s+/, " ") : null;
}

/**
 * Extract the primary addressable object name (house number or name) from a
 * full address string. Used to filter Land Registry and EPC lookups to the
 * specific property rather than all addresses sharing the postcode.
 *
 * Returns null if nothing useful can be extracted (falls back to postcode-only).
 */
export function extractPaon(address: string): string | null {
  // Strip postcode and anything after it
  const withoutPostcode = address
    .replace(/,?\s*[A-Z]{1,2}[0-9][0-9A-Z]?\s+[0-9][A-Z]{2}\s*$/i, "")
    .trim();
  // Take the first comma-separated part ("10 High Street" or "The Old Rectory")
  const firstPart = withoutPostcode.split(",")[0].trim();
  if (!firstPart) return null;

  // Numeric house number (e.g. "10", "10A", "10-12")
  const numMatch = firstPart.match(/^(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)\b/);
  if (numMatch) return numMatch[1].toUpperCase();

  // Named property: use the whole first part (e.g. "THE OLD RECTORY")
  return firstPart.toUpperCase();
}

export type PricePaidEntry = {
  date: string;
  amount: number;
  propertyType: string;
  newBuild: boolean;
  estateType: string;
  paon?: string;
  saon?: string;
  street?: string;
};

export async function fetchPricePaid(postcode: string, paon?: string | null): Promise<PricePaidEntry[]> {
  // Pin to the specific property when we have a house number/name
  const paonClause = paon
    ? `?addr lrcommon:paon "${paon.replace(/"/g, "\\'")}"^^xsd:string .`
    : "";

  const sparql = `
    PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
    PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?date ?amount ?propertyType ?newBuild ?estateType ?paon ?saon ?street WHERE {
      ?addr lrcommon:postcode "${postcode.trim()}"^^xsd:string .
      ${paonClause}
      ?tx lrppi:propertyAddress ?addr ;
          lrppi:pricePaid ?amount ;
          lrppi:transactionDate ?date ;
          lrppi:propertyType/rdfs:label ?propertyType ;
          lrppi:newBuild ?newBuild ;
          lrppi:estateType/rdfs:label ?estateType .
      OPTIONAL { ?addr lrcommon:paon ?paon }
      OPTIONAL { ?addr lrcommon:saon ?saon }
      OPTIONAL { ?addr lrcommon:street ?street }
    }
    ORDER BY DESC(?date)
    LIMIT 10
  `.trim();

  const url = `https://landregistry.data.gov.uk/landregistry/query?query=${encodeURIComponent(sparql)}&output=json`;

  const res = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return [];

  const json = await res.json();
  const bindings: Array<Record<string, { value: string }>> = json?.results?.bindings ?? [];

  return bindings.map((b) => ({
    date: b.date?.value ?? "",
    amount: parseInt(b.amount?.value ?? "0", 10),
    propertyType: b.propertyType?.value ?? "Unknown",
    newBuild: b.newBuild?.value === "true",
    estateType: b.estateType?.value ?? "",
    paon: b.paon?.value,
    saon: b.saon?.value,
    street: b.street?.value,
  }));
}

// Count of registered sales in a postcode district (outcode) over the last N
// months — the "market size" for the Map view's share metric. Land Registry
// Price Paid is REGISTERED/completed sales only (not agreed/SSTC), so the share
// derived from this is honestly "share of registered sales", not a Rightmove-
// style agreed-share. STRSTARTS on the outcode + a trailing space scopes to the
// district precisely (so "BS6 " never catches "BS60 ..."). Cached 24h at the
// fetch layer, exactly like fetchPricePaid. Returns null on any failure so the
// caller can degrade to "no market data" rather than a wrong number.
export async function fetchAreaSales(outcode: string, months = 12): Promise<number | null> {
  const oc = outcode.trim().toUpperCase();
  if (!/^[A-Z]{1,2}[0-9][0-9A-Z]?$/.test(oc)) return null;
  const since = new Date(Date.now() - months * 30.44 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const sparql = `
    PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
    PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    SELECT (COUNT(?tx) AS ?n) WHERE {
      ?addr lrcommon:postcode ?pc .
      ?tx lrppi:propertyAddress ?addr ;
          lrppi:transactionDate ?date .
      FILTER(STRSTARTS(?pc, "${oc} "))
      FILTER(?date >= "${since}"^^xsd:date)
    }
  `.trim();

  const url = `https://landregistry.data.gov.uk/landregistry/query?query=${encodeURIComponent(sparql)}&output=json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const n = json?.results?.bindings?.[0]?.n?.value;
    return n != null ? parseInt(n, 10) : null;
  } catch {
    return null;
  }
}

export type EpcData = {
  rating: string;
  score: number | null;
  // Potential rating/score the certificate estimates after recommended
  // improvements — same EPC row, so free to surface. Lets the card show
  // "current vs potential" energy efficiency.
  potentialRating: string;
  potentialScore: number | null;
  propertyType: string;
  floorArea: number | null;
  builtForm: string;
  inspectionDate: string;
  // Domestic EPCs are valid for 10 years from inspection. Derived, not a raw
  // field, so the card can flag an expired certificate.
  validUntil: string | null;
  // Already present in the EPC row, previously discarded. UPRN is our stable
  // property identity; localAuthority + address corroborate the match; tenure is
  // the EPC's own tenure (owner-occupied / rented / social) — NOT legal
  // freehold/leasehold, so it must be labelled as such wherever shown.
  uprn: string | null;
  tenure: string;
  localAuthority: string;
  address: string;
};

// Distinguishes a reachable-but-no-certificate result from an outright lookup
// failure, so the card can say "no certificate on record" vs "couldn't reach
// the register" instead of collapsing both to "No EPC found".
export type EpcResult =
  | { status: "ok"; data: EpcData | null }
  | { status: "error" };

// A whole postcode's domestic certificates. 100 comfortably covers even a
// flat-heavy postcode, so ours is always in the set to match locally.
const EPC_ROW_LIMIT = 100;

function epcValidUntil(inspectionDate: string): string | null {
  if (!inspectionDate) return null;
  const d = new Date(inspectionDate);
  if (isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 10);
  return d.toISOString().slice(0, 10);
}

// A single row from the new /api/domestic/search response. The search endpoint
// returns a SUMMARY per certificate — it does not include score, potential
// rating, floor area, property type, built form or tenure (those live on the
// full certificate, fetched separately by certificate number).
type EpcSearchRow = {
  certificateNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  addressLine4?: string;
  postcode?: string;
  postTown?: string;
  council?: string;
  constituency?: string;
  currentEnergyEfficiencyBand?: string;
  registrationDate?: string;
  uprn?: number | string;
  schemaType?: string;
};

function epcRowAddress(row: EpcSearchRow): string {
  return [row.addressLine1, row.addressLine2, row.addressLine3, row.addressLine4]
    .filter((p) => p && p.trim())
    .join(", ");
}

// The full certificate's "data" block. Keys vary by certificate schema, so this
// is an untyped bag we read defensively (snake_case first, then kebab-case and
// known aliases) rather than a fixed shape.
type EpcCertData = Record<string, unknown>;

function certField(data: EpcCertData, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = data[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}
function certStr(data: EpcCertData, ...keys: string[]): string {
  const v = certField(data, ...keys);
  return v == null ? "" : String(v);
}
function certNum(data: EpcCertData, ...keys: string[]): number | null {
  const v = certField(data, ...keys);
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

// Fetch the full certificate by number. Returns its "data" block, or null on any
// failure — callers fall back to the search summary so the rating still shows.
async function fetchEpcCertificate(certificateNumber: string, token: string): Promise<EpcCertData | null> {
  const url = `https://api.get-energy-performance-data.communities.gov.uk/api/certificate?certificate_number=${encodeURIComponent(certificateNumber)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    return data && typeof data === "object" ? (data as EpcCertData) : null;
  } catch {
    return null;
  }
}

// Map the full certificate "data" block to EpcData. Keys are tried in the new
// API's snake_case, then the legacy kebab-case, then sensible aliases.
function mapEpcCert(data: EpcCertData, summary: EpcSearchRow): EpcData {
  const inspectionDate =
    certStr(data, "inspection_date", "inspection-date") ||
    certStr(data, "registration_date", "registration-date") ||
    (summary.registrationDate ?? "");
  const validUntil =
    certStr(data, "expiry_date", "expiry-date") || epcValidUntil(inspectionDate) || null;
  const addressParts = [
    certStr(data, "address_line_1", "address1", "address"),
    certStr(data, "address_line_2", "address2"),
    certStr(data, "address_line_3", "address3"),
  ].filter((p) => p);
  return {
    rating: certStr(data, "current_energy_efficiency_band", "current-energy-rating", "current_energy_rating") || (summary.currentEnergyEfficiencyBand ?? ""),
    score: certNum(data, "current_energy_efficiency", "current-energy-efficiency"),
    potentialRating: certStr(data, "potential_energy_efficiency_band", "potential-energy-rating", "potential_energy_rating"),
    potentialScore: certNum(data, "potential_energy_efficiency", "potential-energy-efficiency"),
    propertyType: certStr(data, "property_type", "property-type"),
    floorArea: certNum(data, "total_floor_area", "total-floor-area"),
    builtForm: certStr(data, "built_form", "built-form"),
    inspectionDate,
    validUntil,
    uprn:
      (certField(data, "uprn") != null ? String(certField(data, "uprn")).trim() : "") ||
      (summary.uprn != null ? String(summary.uprn).trim() : "") ||
      null,
    tenure: certStr(data, "tenure"),
    localAuthority: certStr(data, "council", "local_authority_label", "local-authority-label") || (summary.council ?? ""),
    address: addressParts.length ? addressParts.join(", ") : epcRowAddress(summary),
  };
}

// Resolve a search-summary row to full EpcData: fetch the full certificate and
// map it; if that fetch fails, degrade to the summary (rating still shows).
async function resolveEpc(row: EpcSearchRow, token: string): Promise<EpcData> {
  const certNo = row.certificateNumber;
  if (certNo) {
    const full = await fetchEpcCertificate(certNo, token);
    if (full) return mapEpcCert(full, row);
  }
  return mapEpcRow(row);
}

function mapEpcRow(row: EpcSearchRow): EpcData {
  // registrationDate is when the certificate was lodged — the closest thing the
  // search summary gives us to a certified date, and EPC validity runs 10 years
  // from lodgement, so it drives validUntil too.
  const inspectionDate = row.registrationDate ?? "";
  return {
    rating: row.currentEnergyEfficiencyBand ?? "",
    score: null,
    potentialRating: "",
    potentialScore: null,
    propertyType: "",
    floorArea: null,
    builtForm: "",
    inspectionDate,
    validUntil: epcValidUntil(inspectionDate),
    uprn: row.uprn != null ? String(row.uprn).trim() || null : null,
    tenure: "",
    localAuthority: row.council ?? "",
    address: epcRowAddress(row),
  };
}

// How well an EPC row's address matches the searched house number/name.
// Numeric PAONs ("21A") demand an exact first-token match — "21" and "21A" are
// different homes. Named properties ("The Old Rectory") match forgivingly, since
// the register and Land Registry often format the same name differently.
function epcMatchScore(address1: string, searchPaon: string): number {
  const a = (address1 ?? "").toUpperCase().trim();
  const s = (searchPaon ?? "").toUpperCase().trim();
  if (!a || !s) return 0;
  const aFirst = a.split(/[\s,]+/)[0] ?? "";
  const sFirst = s.split(/[\s,]+/)[0] ?? "";
  if (/^\d/.test(sFirst)) return aFirst === sFirst ? 3 : 0; // numeric: exact only
  if (aFirst === sFirst) return 3;
  if (a.includes(s)) return 2;
  if (sFirst.length >= 4 && a.includes(sFirst)) return 1;
  return 0;
}

// Fetch the best-matching domestic EPC for a property. Pulls a page of the
// postcode's certificates (not just the single nearest, which was the main
// cause of false "No EPC found" results) and picks the row that best matches
// the house number/name.
export async function fetchEpcStatus(postcode: string, paon?: string | null): Promise<EpcResult> {
  const key = process.env.EPC_API_KEY;
  if (!key) return { status: "ok", data: null };

  // The Open Data Communities API (epc.opendatacommunities.org) was retired on
  // 30 May 2026 — it now 301-redirects and no longer serves data. This is the
  // replacement service, which uses Bearer auth. The token is the ready-made
  // bearer token copied from the account's "my account" page and is used
  // verbatim (not base64-encoded). EPC_API_EMAIL is no longer used.
  const token = key;
  // Search by POSTCODE ONLY and match the house number/name locally. The
  // register's own &address= filter is unreliable — it 404s for addresses it
  // actually holds (e.g. "21 Mandelyns") — so we pull the postcode's whole set
  // of certificates and pick ours from it. page_size caps the page (1–5000).
  const url = `https://api.get-energy-performance-data.communities.gov.uk/api/domestic/search?postcode=${encodeURIComponent(postcode)}&page_size=${EPC_ROW_LIMIT}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      next: { revalidate: 86400 },
    });
  } catch {
    return { status: "error" };
  }

  // The register returns 404 (and sometimes 200 with no rows) when a postcode
  // has no domestic certificates. That's a genuine "none on record", not an
  // outage — so it's an ok result with null data, not an error.
  if (res.status === 404) return { status: "ok", data: null };
  if (!res.ok) return { status: "error" };

  let rows: EpcSearchRow[] = [];
  try {
    const json = await res.json();
    // New API: { data: [ ...rows ], pagination: {...} }.
    rows = Array.isArray(json?.data) ? json.data : [];
  } catch {
    return { status: "error" };
  }
  if (rows.length === 0) return { status: "ok", data: null };

  // No house number/name to pin to: take the register's nearest result.
  if (!paon) return { status: "ok", data: await resolveEpc(rows[0], token) };

  // Pick the best-scoring row. A zero best-score means none of the returned
  // certificates are for this specific address (a genuine "no certificate").
  let best: EpcSearchRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = epcMatchScore(row.addressLine1 ?? "", paon);
    if (score > bestScore) { best = row; bestScore = score; }
  }
  return { status: "ok", data: best ? await resolveEpc(best, token) : null };
}

// Backward-compatible wrapper (EpcData | null) for callers that don't need the
// error/absent distinction — e.g. the new-sale property lookup.
export async function fetchEpc(postcode: string, paon?: string | null): Promise<EpcData | null> {
  const result = await fetchEpcStatus(postcode, paon);
  return result.status === "ok" ? result.data : null;
}

export function buildRightmoveUrl(address: string, postcode: string): string {
  const q = encodeURIComponent(postcode);
  return `https://www.rightmove.co.uk/house-prices/${q}.html`;
}

export function buildZooplaUrl(postcode: string): string {
  const q = postcode.toLowerCase().replace(/\s+/g, "-");
  return `https://www.zoopla.co.uk/house-prices/${q}/`;
}

export function buildLandRegUrl(postcode: string): string {
  return `https://search-property-information.service.gov.uk/search/address?postcode=${encodeURIComponent(postcode)}`;
}
