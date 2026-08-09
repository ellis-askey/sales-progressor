// Public no-auth quote-request page. Token = Contact.portalToken (already
// unique + already used for /portal and /feedback). Client picks a service
// type, sees firms that cover their outward code, picks 1 to N firms, fills
// in preferences, submits.
//
// Whitelisted in middleware.ts (matcher exclusion + authorized callback).

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { outwardCode } from "@/lib/utils/address";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import { extractFirstName } from "@/lib/contacts/displayName";
import { QuoteFlow } from "./QuoteFlow";

export const metadata = {
  title: "Get a survey quote | Sales Progressor",
};

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    include: {
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
        },
      },
    },
  });

  if (!contact) notFound();

  const outward = outwardCode(contact.transaction.propertyAddress);

  const [serviceTypes, coveringFirms] = await Promise.all([
    prisma.providerServiceType.findMany({
      where: { kind: "surveyor", active: true },
      orderBy: { sortOrder: "asc" },
    }),
    outward
      ? prisma.providerFirm.findMany({
          where: {
            kind: "surveyor",
            active: true,
            coverage: { some: { outwardCode: outward } },
          },
          include: {
            serviceTypes: { select: { serviceTypeId: true } },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const firmsForClient = coveringFirms.map((f) => ({
    id: f.id,
    name: f.name,
    notes: f.notes,
    website: f.website,
    logoUrl: getProviderLogoUrl(f.logoPath),
    serviceTypeIds: f.serviceTypes.map((s) => s.serviceTypeId),
  }));

  return (
    <main
      style={{
        minHeight: "100svh",
        background: "linear-gradient(160deg, #FEF7ED 0%, #FDF2E9 100%)",
        padding: "24px 20px 64px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #FF8A65, #FF6B4A)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.5 0 2.91.37 4.15 1.01" />
              </svg>
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#7c2d12" }}>Sales Progressor</span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#FF6B4A", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Get a survey quote
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1c1917", letterSpacing: "-0.02em", margin: "0 0 6px", lineHeight: 1.15 }}>
            {extractFirstName(contact.name)}, let's find you a surveyor
          </h1>
          <p style={{ fontSize: 14, color: "#78716c", margin: 0, lineHeight: 1.5 }}>
            For your purchase at <strong style={{ color: "#44403c" }}>{contact.transaction.propertyAddress}</strong>. We'll only send quotes to firms that cover your area.
          </p>
        </header>

        <QuoteFlow
          token={token}
          propertyAddress={contact.transaction.propertyAddress}
          outwardCode={outward}
          serviceTypes={serviceTypes.map((s) => ({
            id: s.id,
            label: s.label,
            description: s.description,
          }))}
          firms={firmsForClient}
          contactName={contact.name}
          contactEmail={contact.email ?? ""}
          contactPhone={contact.phone ?? ""}
        />

        <footer style={{ marginTop: 32, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "#a8a29e" }}>
            Your details are only shared with the firms you select. Read our{" "}
            <a href="/privacy" style={{ color: "#FF6B4A", textDecoration: "underline" }}>
              privacy policy
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
