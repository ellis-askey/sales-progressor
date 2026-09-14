// Map a domain's authoritative nameservers to the DNS provider whose step-guide
// we should surface, so we can pre-select the right one for the agent instead of
// making them find it. Returns a name that matches REGISTRAR_GUIDES, or null when
// we can't tell (they then pick from the list). Matched on the nameserver's
// parent domain — e.g. "ns01.domaincontrol.com" -> GoDaddy.

const NS_PROVIDERS: { suffixes: string[]; name: string }[] = [
  { suffixes: ["cloudflare.com"], name: "Cloudflare" },
  { suffixes: ["domaincontrol.com"], name: "GoDaddy" },
  { suffixes: ["registrar-servers.com"], name: "Namecheap" },
  { suffixes: ["googledomains.com"], name: "Google Domains" },
  { suffixes: ["ui-dns.com", "ui-dns.de", "ui-dns.org", "ui-dns.biz"], name: "IONOS" },
  { suffixes: ["123-reg.co.uk", "reg365.net"], name: "123-reg" },
];

export function detectRegistrarFromNameservers(nameservers: string[]): string | null {
  for (const raw of nameservers) {
    const host = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
    if (!host) continue;
    for (const p of NS_PROVIDERS) {
      if (p.suffixes.some((s) => host === s || host.endsWith("." + s))) return p.name;
    }
  }
  return null;
}
