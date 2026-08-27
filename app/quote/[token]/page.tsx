// Public no-auth quote-request page. Token = Contact.portalToken (already
// unique + already used for /portal and /feedback). Client picks a service
// type, sees firms that cover their outward code, picks 1 to N firms, fills
// in preferences, submits.
//
// Whitelisted in middleware.ts (matcher exclusion + authorized callback).
//
// Visual system: the app's light "sunset" tokens (see design/tokens.ts) so the
// page reads as part of Sales Progressor, not a bolt-on. This page is the base
// the wider portal re-skin will follow.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { outwardCode } from "@/lib/utils/address";
import { getOnwardSignalForFile } from "@/lib/services/onward";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import { extractFirstName } from "@/lib/contacts/displayName";
import { QuoteFlow } from "./QuoteFlow";
import { AppBackground } from "@/components/decor/AppBackground";
import { A } from "./ui";
import "@/app/styles/elevra.css";

export const metadata = {
  title: "Request a quote | Sales Progressor",
};

export const dynamic = "force-dynamic";

function tenureLabel(tenure: string | null, isShareOfFreehold: boolean): string | null {
  if (isShareOfFreehold) return "Share of freehold";
  if (tenure === "freehold") return "Freehold";
  if (tenure === "leasehold") return "Leasehold";
  return null;
}

function priceLabel(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ onward?: string }>;
}) {
  const { token } = await params;
  const { onward: onwardParam } = await searchParams;
  const onward = onwardParam === "1";

  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    include: {
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          purchasePrice: true,
          tenure: true,
          isShareOfFreehold: true,
        },
      },
    },
  });

  if (!contact) notFound();

  // Onward mode: point the whole picker at the property they're buying (from
  // the chain link above their file), not the file's own address.
  let targetAddress = contact.transaction.propertyAddress;
  if (onward) {
    const sig = await getOnwardSignalForFile(contact.transaction.id);
    if (!sig.onwardAddress) {
      return (
        <main style={{ minHeight: "100svh", padding: "24px 20px 64px" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: A.textPrimary, marginBottom: 8 }}>
              We need your onward address first
            </h1>
            <p style={{ fontSize: 14, color: A.textMuted }}>
              Add the property you&apos;re buying in your portal, then we can find surveyors that cover that area.
            </p>
          </div>
        </main>
      );
    }
    targetAddress = sig.onwardAddress;
  }

  const outward = outwardCode(targetAddress);

  const [serviceTypes, coveringFirms, brokerFirms] = await Promise.all([
    // All active service types across every provider kind.
    prisma.providerServiceType.findMany({
      where: { active: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    }),
    // Surveyors + structural engineers are gated to firms covering the postcode.
    outward
      ? prisma.providerFirm.findMany({
          where: {
            kind: { in: ["surveyor", "structural_engineer"] },
            active: true,
            coverage: { some: { outwardCode: outward } },
          },
          include: { serviceTypes: { select: { serviceTypeId: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    // Mortgage brokers work nationwide — no coverage gate, TSP default first.
    prisma.providerFirm.findMany({
      where: { kind: "mortgage_broker", active: true },
      include: { serviceTypes: { select: { serviceTypeId: true } } },
      orderBy: [{ tspDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  const allFirms = [...coveringFirms, ...brokerFirms];
  const firmsForClient = allFirms.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    notes: f.notes,
    website: f.website,
    logoUrl: getProviderLogoUrl(f.logoPath),
    serviceTypeIds: f.serviceTypes.map((s) => s.serviceTypeId),
  }));

  // Only offer a category the client can act on (has at least one available firm).
  const KIND_LABELS: Record<string, string> = {
    surveyor: "Surveyor",
    structural_engineer: "Structural engineer",
    mortgage_broker: "Mortgage broker",
  };
  const availableKinds = (["surveyor", "structural_engineer", "mortgage_broker"] as const)
    .filter((k) => allFirms.some((f) => f.kind === k))
    .map((k) => ({ kind: k as string, label: KIND_LABELS[k] }));

  return (
    <main
      style={{
        minHeight: "100svh",
        background: "transparent",
        padding: "24px 20px 64px",
      }}
    >
      {/* Ultimate fallback base, behind the WebGL backdrop, for the pre-mount
       * first frame or a no-WebGL browser. AppBackground paints its own white
       * base + iridescence on top of this once mounted. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-20"
        style={{ background: "linear-gradient(180deg, #FBFAFF 0%, #F2EFFA 100%)" }}
      />
      <AppBackground />

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: A.coralDeep, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Request a quote
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: A.textPrimary, letterSpacing: "-0.02em", margin: "0 0 6px", lineHeight: 1.15 }}>
            {extractFirstName(contact.name)}, what do you need?
          </h1>
          <p style={{ fontSize: 14, color: A.textMuted, margin: 0, lineHeight: 1.5 }}>
            For <strong style={{ color: A.textSecondary }}>{targetAddress}</strong>
            {onward ? " (the property you're buying)" : ""}. We'll only pass your details to the firms you choose.
          </p>
        </header>

        <QuoteFlow
          token={token}
          propertyAddress={targetAddress}
          outwardCode={outward}
          onward={onward}
          priceLabel={onward ? null : priceLabel(contact.transaction.purchasePrice)}
          tenureLabel={onward ? null : tenureLabel(contact.transaction.tenure, contact.transaction.isShareOfFreehold)}
          kinds={availableKinds}
          serviceTypes={serviceTypes.map((s) => ({
            id: s.id,
            kind: s.kind,
            label: s.label,
            description: s.description,
          }))}
          firms={firmsForClient}
          contactName={contact.name}
          contactEmail={contact.email ?? ""}
          contactPhone={contact.phone ?? ""}
        />

        <footer style={{ marginTop: 32, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: A.textFaint }}>
            Your details are only shared with the firms you select. Read our{" "}
            <a href="/privacy" style={{ color: A.coralDeep, textDecoration: "underline" }}>
              privacy policy
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
