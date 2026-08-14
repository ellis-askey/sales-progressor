import { prisma } from "@/lib/prisma";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { solicitorCodesForSide, solicitorStepLabel } from "@/lib/solicitor-confirm/codes";
import { getEnquiryTrackerView } from "@/lib/enquiries/tracker";
import { SolicitorRespond } from "./SolicitorRespond";
import { SolicitorEnquiries } from "./SolicitorEnquiries";

export const dynamic = "force-dynamic";

function formatPrice(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

// "Alice Smith & Bob Smith" → "Alice & Bob Smith" is over-engineering; keep it
// plain: join full names with " & " (matches the email subject rule).
function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

type PageProps = { params: Promise<{ token: string }> };

export default async function SolicitorConfirmPage({ params }: PageProps) {
  const { token } = await params;
  const decoded = verifySolicitorToken(token);

  if (!decoded) {
    return <Shell><InvalidNotice /></Shell>;
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: {
      id: true,
      propertyAddress: true,
      purchasePrice: true,
      activeBuyerRoundId: true,
      agency: { select: { name: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
    },
  });

  if (!tx) {
    return <Shell><InvalidNotice /></Shell>;
  }

  const side = decoded.side;
  const brand = tx.agency?.name ?? "Sales Progression";
  const sellerNames = joinNames(tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name));
  const buyerNames = joinNames(tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name));
  const firmName =
    side === "vendor" ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name;
  const actingFor = side === "vendor" ? "The seller" : "The buyer";

  // Load the solicitor-owned steps for this side that are still open
  // (available). Complete / locked / not-required steps are never shown.
  const scope = forRound(tx.activeBuyerRoundId, tx.id);
  const codes = solicitorCodesForSide(side);
  const rows = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: tx.id,
      state: "available",
      milestoneDefinition: { code: { in: Array.from(codes) } },
      ...milestoneScopeWhere(scope),
    },
    select: {
      expectedDate: true,
      milestoneDefinition: { select: { id: true, code: true, name: true, orderIndex: true } },
    },
    orderBy: { milestoneDefinition: { orderIndex: "asc" } },
  });

  const steps = rows.map((r) => ({
    id: r.milestoneDefinition.id,
    code: r.milestoneDefinition.code,
    label: solicitorStepLabel(r.milestoneDefinition.code, r.milestoneDefinition.name),
    expectedDate: r.expectedDate ? r.expectedDate.toISOString().slice(0, 10) : null,
  }));

  // Enquiries loop: shown whenever the file's enquiries stage is open, separate
  // from the milestone steps above (the loop is tracked, not chased as a step).
  const enquiries = await getEnquiryTrackerView(tx.id);
  const enquiriesOpen = !!enquiries && enquiries.status !== "closed";
  const courtLine =
    enquiries?.currentlyWith === "buyer_solicitor"
      ? "The enquiries are with the buyer's solicitor to review the replies."
      : "We're waiting on the seller's solicitor to answer the outstanding enquiries.";

  // Whether the recipient has anything to act on at all — steps OR the loop.
  const hasAnything = steps.length > 0 || enquiriesOpen;

  return (
    <Shell>
      <Letterhead brand={brand} />
      <div style={{ background: "#ffffff", borderLeft: "1px solid #dfe5ec", borderRight: "1px solid #dfe5ec", padding: "28px 26px 8px" }}>
        <p style={{ margin: "0 0 12px", fontSize: 15, color: "#0f2740", fontWeight: 600 }}>
          {hasAnything ? "Where do things stand?" : "Thank you"}
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#33475b" }}>
          {hasAnything
            ? `I'm looking after ${sellerNames || "our client"} and overseeing the progression on this sale. You can confirm where things stand, give an expected date, or leave a short update below. It takes about a minute and needs no password.`
            : "There is nothing outstanding on this matter from your side right now. Thank you for your help keeping things moving."}
        </p>
      </div>

      <MatterDetails
        address={tx.propertyAddress}
        price={formatPrice(tx.purchasePrice)}
        seller={sellerNames}
        buyer={buyerNames}
        firmName={firmName ?? null}
        actingFor={actingFor}
      />

      {steps.length > 0 && (
        <div style={{ background: "#ffffff", borderLeft: "1px solid #dfe5ec", borderRight: "1px solid #dfe5ec", padding: "8px 26px 4px" }}>
          <SolicitorRespond token={token} steps={steps} />
        </div>
      )}

      {enquiriesOpen && (
        <SolicitorEnquiries
          token={token}
          side={side}
          courtLine={courtLine}
          outstandingNote={enquiries?.outstandingNote ?? null}
        />
      )}

      <Footer brand={brand} />
    </Shell>
  );
}

// ─── Presentational pieces (server-rendered, inline-styled to match the email) ─

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#eef1f5", padding: "28px 16px", fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function Letterhead({ brand }: { brand: string }) {
  return (
    <div style={{ background: "#0f2740", borderRadius: "10px 10px 0 0", padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", letterSpacing: ".2px" }}>{brand}</span>
      <span style={{ fontSize: 11, color: "#9fb3c8", textTransform: "uppercase", letterSpacing: "1.2px" }}>Sale progression</span>
    </div>
  );
}

function MatterDetails({ address, price, seller, buyer, firmName, actingFor }: {
  address: string; price: string | null; seller: string; buyer: string; firmName: string | null; actingFor: string;
}) {
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: "flex", padding: "3px 0", fontSize: 13, lineHeight: 1.5 }}>
      <span style={{ color: "#6b7c93", width: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#0f2740" }}>{value}</span>
    </div>
  );
  return (
    <div style={{ background: "#ffffff", borderLeft: "1px solid #dfe5ec", borderRight: "1px solid #dfe5ec", padding: "12px 26px 4px" }}>
      <div style={{ background: "#f6f8fb", border: "1px solid #e3e9f0", borderRadius: 8, padding: "16px 18px" }}>
        <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "#6b7c93" }}>Matter details</p>
        <Row label="Property" value={address} />
        {price && <Row label="Sale price" value={price} />}
        {seller && <Row label="Seller" value={seller} />}
        {buyer && <Row label="Buyer" value={buyer} />}
        {firmName && <Row label="Your firm" value={firmName} />}
        <Row label="You are acting for" value={actingFor} />
      </div>
    </div>
  );
}

function Footer({ brand }: { brand: string }) {
  return (
    <div style={{ background: "#f6f8fb", border: "1px solid #dfe5ec", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "18px 26px" }}>
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "#8493a8" }}>
        Sent by {brand} in relation to the matter above. If you&rsquo;re not the right person for this file, just reply to the email and let me know.
      </p>
    </div>
  );
}

function InvalidNotice() {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #dfe5ec", borderRadius: 10, padding: "40px 28px", textAlign: "center" }}>
      <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "#0f2740" }}>This link is not valid</p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#6b7c93" }}>
        The link may have expired or been mistyped. Please reply to the email you received and I&rsquo;ll send a fresh one.
      </p>
    </div>
  );
}
