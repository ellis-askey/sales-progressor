// Per-registrar "where to add the CNAME" hints, shared by the agency-facing
// DomainAuthFlow and the Command Centre DomainAuth panel so both stay in sync.
// {host} / {data} are substituted with the first CNAME record when displayed.
export const REGISTRAR_GUIDES: { name: string; steps: string }[] = [
  { name: "Cloudflare", steps: "DNS → Add record → Type: CNAME → Name: {host} → Target: {data} → Proxy: DNS Only (grey cloud)" },
  { name: "GoDaddy", steps: "My Products → DNS → Add → Type: CNAME → Host: {host} → Points to: {data}" },
  { name: "Google Domains", steps: "DNS → Custom records → Create new record → Type: CNAME → Host name: {host} → Data: {data}" },
  { name: "Namecheap", steps: "Domain List → Manage → Advanced DNS → Add New Record → CNAME → Host: {host} → Value: {data}" },
  { name: "123-reg", steps: "Manage DNS → Add Records → CNAME → Subdomain: {host} → Destination: {data}" },
  { name: "IONOS", steps: "Domain → DNS → Add record → Type: CNAME → Hostname: {host} → Points to: {data}" },
];
