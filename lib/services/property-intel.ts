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

function mapEpcRow(row: Record<string, string>): EpcData {
  const inspectionDate = row["inspection-date"] ?? "";
  return {
    rating: row["current-energy-rating"] ?? "",
    score: row["current-energy-efficiency"] ? parseInt(row["current-energy-efficiency"], 10) : null,
    potentialRating: row["potential-energy-rating"] ?? "",
    potentialScore: row["potential-energy-efficiency"] ? parseInt(row["potential-energy-efficiency"], 10) : null,
    propertyType: row["property-type"] ?? "",
    floorArea: row["total-floor-area"] ? parseFloat(row["total-floor-area"]) : null,
    builtForm: row["built-form"] ?? "",
    inspectionDate,
    validUntil: epcValidUntil(inspectionDate),
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
  const email = process.env.EPC_API_EMAIL;
  const key = process.env.EPC_API_KEY;
  if (!email || !key) return { status: "ok", data: null };

  const auth = Buffer.from(`${email}:${key}`).toString("base64");
  // Search by POSTCODE ONLY and match the house number/name locally. The
  // register's own &address= filter is unreliable — it 404s for addresses it
  // actually holds (e.g. "21 Mandelyns") — so we pull the postcode's whole set
  // of certificates and pick ours from it.
  const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(postcode)}&size=${EPC_ROW_LIMIT}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
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

  let rows: Record<string, string>[] = [];
  try {
    const json = await res.json();
    rows = json?.rows ?? [];
  } catch {
    return { status: "error" };
  }
  if (rows.length === 0) return { status: "ok", data: null };

  // No house number/name to pin to: take the register's nearest result.
  if (!paon) return { status: "ok", data: mapEpcRow(rows[0]) };

  // Pick the best-scoring row. A zero best-score means none of the returned
  // certificates are for this specific address (a genuine "no certificate").
  let best: Record<string, string> | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = epcMatchScore(row["address1"] ?? "", paon);
    if (score > bestScore) { best = row; bestScore = score; }
  }
  return { status: "ok", data: best ? mapEpcRow(best) : null };
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
