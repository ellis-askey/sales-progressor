import { notFound } from "next/navigation";
import { SenderDomainSection, type SenderStatus, type View } from "@/components/progression/SenderDomainSection";

// Dev-only harness: the REAL "Sending address" card (SenderDomainSection) rendered
// byte-for-byte in every stage, with hardcoded data (no network / no auth / no DB).
// 404 in production (same prod-block convention as the rest of /dev). Lets us eyeball
// before / during / after single-sender, and the full DNS path, side by side.

const AGENCY = "Homes by Wright";
const OWNER = "Ellis";
const EMAIL = "ellis@homebywright.co.uk";

// A sample uploaded logo (navy house mark) so the preview shows the logo avatar; in
// the real app this is the agency's own uploaded logo, else it falls back to initials.
const SAMPLE_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%231f3b57'/%3E%3Cpath d='M50 22 L78 46 V80 H60 V58 H40 V80 H22 V46 Z' fill='%23ffffff'/%3E%3C/svg%3E";

const baseStatus: Omit<SenderStatus, "senderEmail" | "senderVerified" | "method" | "domain"> = {
  agencyName: AGENCY,
  ownerName: OWNER,
  ownerEmail: EMAIL,
  logoUrl: SAMPLE_LOGO,
};

const domainRecord = {
  id: "dev-domain",
  domain: "homebywright.co.uk",
  status: "pending",
  dkimValid: false,
  spfValid: false,
  cnameRecords: [
    { host: "em1234.homebywright.co.uk", data: "u1234.wl.sendgrid.net", type: "CNAME" },
    { host: "s1._domainkey.homebywright.co.uk", data: "s1.domainkey.u1234.wl.sendgrid.net", type: "CNAME" },
    { host: "s2._domainkey.homebywright.co.uk", data: "s2.domainkey.u1234.wl.sendgrid.net", type: "CNAME" },
  ],
};

const STAGES: { n: string; title: string; note: string; status: SenderStatus; view: View }[] = [
  {
    n: "1",
    title: "Before — nothing set up",
    note: "The default every client starts on. Panel shows the neutral address + replies to the owner's inbox.",
    status: { ...baseStatus, senderEmail: null, senderVerified: false, method: null, domain: null },
    view: "overview",
  },
  {
    n: "2",
    title: "Choosing how to set it up",
    note: "The two real routes: a mailbox they've been given, or authenticating the whole domain.",
    status: { ...baseStatus, senderEmail: null, senderVerified: false, method: null, domain: null },
    view: "method",
  },
  {
    n: "3",
    title: "During — single sender (confirm the mailbox)",
    note: "After they enter the address, we email it a link; they paste it back to confirm. Still sending as default until confirmed.",
    status: { ...baseStatus, senderEmail: EMAIL, senderVerified: false, method: "single", domain: null },
    view: "single-sent",
  },
  {
    n: "4",
    title: "After — set up & verified",
    note: "Done. Panel now shows their own address, From and reply, with the green Verified pill.",
    status: { ...baseStatus, senderEmail: EMAIL, senderVerified: true, method: "single", domain: null },
    view: "verified",
  },
  {
    n: "5",
    title: "The full DNS way (domain authentication)",
    note: "The other route: add these records to the domain once, then any address on it can send, with no per-mailbox step.",
    status: { ...baseStatus, senderEmail: EMAIL, senderVerified: false, method: "domain", domain: domainRecord },
    view: "domain-records",
  },
];

export default function SenderStatesDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#f3f0ec", padding: "40px 20px 80px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", color: "#1a1d29" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e2452a", margin: "0 0 8px" }}>/dev · sending address</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 10px" }}>Every stage, byte-for-byte</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#4a5162", margin: "0 0 8px", maxWidth: "58ch" }}>
          The real card with hardcoded data — example address <strong>{EMAIL}</strong> for <strong>{AGENCY}</strong>. Nothing here fetches or saves; the buttons are inert.
        </p>
        {STAGES.map((s) => (
          <section key={s.n} style={{ marginTop: 44 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
              <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, fontWeight: 700, color: "#e2452a", background: "rgba(255,107,74,0.1)", border: "1px solid rgba(255,107,74,0.2)", borderRadius: 6, padding: "2px 7px" }}>{s.n}</span>
              <div>
                <p style={{ fontSize: 15.5, fontWeight: 750, letterSpacing: "-0.01em", margin: 0 }}>{s.title}</p>
                <p style={{ fontSize: 13, color: "#8b91a3", margin: "3px 0 0", lineHeight: 1.5, maxWidth: "62ch" }}>{s.note}</p>
              </div>
            </div>
            <SenderDomainSection base="/api/agent/clients/dev/sender" scope="client" subjectName={AGENCY} preview={{ status: s.status, view: s.view }} />
          </section>
        ))}
      </div>
    </div>
  );
}
