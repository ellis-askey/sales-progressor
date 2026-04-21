// lib/services/property-intel.ts
// Fetches Land Registry price paid history and EPC data for a property address.

export function extractPostcode(address: string): string | null {
  const match = address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i);
  return match ? match[0].toUpperCase().replace(/\s+/, " ") : null;
}

export type PricePaidEntry = {
  date: string;
  amount: number;
  propertyType: string;
  newBuild: boolean;
  estateType: string;
};

export async function fetchPricePaid(postcode: string): Promise<PricePaidEntry[]> {
  const encoded = encodeURIComponent(postcode.trim());
  const sparql = `
    PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
    PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    SELECT ?date ?amount ?propertyType ?newBuild ?estateType WHERE {
      ?addr lrcommon:postcode "${postcode.trim()}"^^xsd:string .
      ?tx lrppi:propertyAddress ?addr ;
          lrppi:pricePaid ?amount ;
          lrppi:transactionDate ?date ;
          lrppi:propertyType/rdfs:label ?propertyType ;
          lrppi:newBuild ?newBuild ;
          lrppi:estateType/rdfs:label ?estateType .
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
  }));
}

export type EpcData = {
  rating: string;
  score: number | null;
  propertyType: string;
  floorArea: number | null;
  builtForm: string;
  inspectionDate: string;
};

export async function fetchEpc(postcode: string): Promise<EpcData | null> {
  const email = process.env.EPC_API_EMAIL;
  const key = process.env.EPC_API_KEY;
  if (!email || !key) return null;

  const auth = Buffer.from(`${email}:${key}`).toString("base64");
  const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(postcode)}&size=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const row = json?.rows?.[0];
  if (!row) return null;

  return {
    rating: row["current-energy-rating"] ?? "",
    score: row["current-energy-efficiency"] ? parseInt(row["current-energy-efficiency"], 10) : null,
    propertyType: row["property-type"] ?? "",
    floorArea: row["total-floor-area"] ? parseFloat(row["total-floor-area"]) : null,
    builtForm: row["built-form"] ?? "",
    inspectionDate: row["inspection-date"] ?? "",
  };
}

export function buildRightmoveUrl(address: string, postcode: string): string {
  const q = encodeURIComponent(postcode);
  return `https://www.rightmove.co.uk/house-prices/${q}.html`;
}

export function buildZooplaUrl(postcode: string): string {
  const q = postcode.toLowerCase().replace(/\s+/g, "-");
  return `https://www.zoopla.co.uk/house-prices/${q}/`;
}
