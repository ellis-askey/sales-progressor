// Convert a full CNAME host (the FQDN SendGrid gives us) to the "subdomain only"
// form that common registrars' DNS panels actually want.
//
// Most registrars (GoDaddy, Namecheap, IONOS, 123-reg) append the zone to whatever
// you type in the Host/Name field, so they expect just "em1234" — pasting the full
// "em1234.example.com" produces "em1234.example.com.example.com" and fails.
// Cloudflare / Google accept the short form too, so the subdomain form is the one
// value that's correct everywhere. The full host is only ever kept as a labelled
// fallback for rare advanced setups.
//
//   "em1234.example.com"           + "example.com" -> "em1234"
//   "s1._domainkey.example.com"    + "example.com" -> "s1._domainkey"
//   "example.com"                  + "example.com" -> "@"   (the apex)
//   anything not ending in domain  -> returned unchanged (never worse than raw)
export function relativeHost(host: string, domain: string): string {
  const h = (host ?? "").trim().replace(/\.$/, "");
  const d = (domain ?? "").trim().replace(/\.$/, "").toLowerCase();
  if (!h) return "";
  if (!d) return h;
  const hl = h.toLowerCase();
  if (hl === d) return "@";
  if (hl.endsWith("." + d)) return h.slice(0, h.length - d.length - 1);
  return h;
}
