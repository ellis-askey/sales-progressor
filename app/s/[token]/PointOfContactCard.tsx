import { Phone, EnvelopeSimple, WhatsappLogo, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { PortalCard, CardKicker } from "./portal-cards";
import { S } from "./ui";

// "Your point of contact" — the person progressing this file (the assigned
// progressor on an outsourced matter, else the agency's agent): name, photo,
// and one-tap call / email / WhatsApp / save-contact. The single biggest gap
// versus the client portal's Team card.
export type ContactPerson = { name: string; phone: string | null; email: string | null; image: string | null };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function whatsappHref(phone: string): string {
  let d = phone.replace(/[\s\-().+]/g, "");
  if (d.startsWith("0")) d = "44" + d.slice(1);
  return `https://wa.me/${d}`;
}

function vcardHref(p: ContactPerson, org: string): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${p.name}`,
    org ? `ORG:${org}` : "",
    p.phone ? `TEL;TYPE=CELL:${p.phone}` : "",
    p.email ? `EMAIL;TYPE=WORK:${p.email}` : "",
    "END:VCARD",
  ].filter(Boolean);
  return "data:text/vcard;charset=utf-8," + encodeURIComponent(lines.join("\n"));
}

function Action({ href, icon, label, external }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      style={{ flex: 1, minWidth: 0, display: "inline-flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", padding: "8px 6px", borderRadius: 10, background: "rgba(15,39,64,0.04)", color: S.inkSoft }}
    >
      <span style={{ color: S.accent, display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </a>
  );
}

export function PointOfContactCard({ person, agencyName }: { person: ContactPerson; agencyName: string }) {
  return (
    <PortalCard glassId="sol-contact" label="Point of contact">
      <CardKicker>Your point of contact</CardKicker>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        {person.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={person.image} alt="" style={{ width: 48, height: 48, borderRadius: 24, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span style={{ width: 48, height: 48, borderRadius: 24, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: S.accentBg, color: S.accent, fontSize: 16, fontWeight: 700 }}>{initials(person.name)}</span>
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.ink, lineHeight: 1.3 }}>{person.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: S.muted }}>Progressing this sale · {agencyName}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
        {person.phone && <Action href={`tel:${person.phone}`} icon={<Phone size={15} weight="regular" />} label="Call" />}
        {person.email && <Action href={`mailto:${person.email}`} icon={<EnvelopeSimple size={15} weight="regular" />} label="Email" />}
        {person.phone && <Action href={whatsappHref(person.phone)} icon={<WhatsappLogo size={15} weight="regular" />} label="WhatsApp" external />}
        <Action href={vcardHref(person, agencyName)} icon={<DownloadSimple size={15} weight="regular" />} label="Save" />
      </div>
    </PortalCard>
  );
}
