import { prisma } from "@/lib/prisma";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { resolveDisplayStages, type ResolvedStage } from "@/lib/milestones/display-stages";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { solicitorCodesForSide, solicitorStepLabel } from "@/lib/solicitor-confirm/codes";
import { getEnquiryTrackerView } from "@/lib/enquiries/tracker";
import { markChaseOpened, recipientForSide } from "@/lib/enquiries/chase-log";
import { SolicitorRespond } from "./SolicitorRespond";
import { SolicitorEnquiries } from "./SolicitorEnquiries";
import { SolicitorRaisePanel } from "./SolicitorRaisePanel";
import { S } from "./ui";

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
      expectedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
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
  // Experiment tracking: record that the solicitor opened their link, against
  // the most recent still-unopened chase send. Fire-and-forget — must never
  // affect the page render.
  void markChaseOpened(tx.id, recipientForSide(side)).catch(() => {});
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

  // Whole-sale progress at a glance (Stage 3): the six display stages across
  // BOTH sides, read-only. Reuses the resolver the agent app + client portal
  // use, so the solicitor sees the same honest picture everyone else does.
  const allRows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id, ...milestoneScopeWhere(scope) },
    select: { state: true, completedAt: true, milestoneDefinition: { select: { code: true } } },
  });
  const displayStages = resolveDisplayStages(
    allRows.map((r) => ({
      code: r.milestoneDefinition.code,
      isComplete: r.state === "complete",
      isNotRequired: r.state === "not_required",
      completion: { completedAt: r.completedAt },
    })),
    {
      expectedExchangeDate: tx.expectedExchangeDate ?? null,
      overridePredictedDate: tx.overridePredictedDate ?? null,
      targetCompletionDate: tx.completionDate ?? null,
    },
  );

  // Enquiries loop: shown whenever the file's enquiries stage is open, separate
  // from the milestone steps above (the loop is tracked, not chased as a step).
  const enquiries = await getEnquiryTrackerView(tx.id);
  const enquiriesOpen = !!enquiries && enquiries.status !== "closed";
  const courtLine =
    enquiries?.currentlyWith === "buyer_solicitor"
      ? "The enquiries are with the buyer's solicitor to review the replies."
      : "We're waiting on the seller's solicitor to answer the outstanding enquiries.";

  // Raise chase: shown to the buyer's solicitor when the file is still waiting
  // on enquiries to be raised (an open raise chase). Mutually exclusive with the
  // loop — raising closes this and opens the tracker.
  const raiseChase =
    side === "purchaser"
      ? await prisma.enquiryRaiseChase.findUnique({ where: { transactionId: tx.id }, select: { closedAt: true } })
      : null;
  const raiseOpen = !!raiseChase && !raiseChase.closedAt && !enquiriesOpen;

  // Whether the recipient has anything to act on at all — steps, the loop, or
  // the raise chase.
  const hasAnything = steps.length > 0 || enquiriesOpen || raiseOpen;

  return (
    <Shell>
      <Header brand={brand} />

      <Card>
        <h1 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 700, color: S.ink, letterSpacing: "-0.01em" }}>
          {hasAnything ? "Where do things stand?" : `Thank you, ${firmName ?? "and all the best"}`}
        </h1>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: S.inkSoft }}>
          {hasAnything
            ? `I'm looking after ${sellerNames || "our client"} and keeping this sale moving. Confirm where things stand, add an expected date, or leave a short note below. It takes about a minute, with no login.`
            : "There's nothing outstanding from your side right now. Thank you for helping keep things moving."}
        </p>
        {hasAnything && (
          <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.55, color: S.muted }}>
            A quick update here keeps the buyer and seller informed on our side, so you hear from us less.
          </p>
        )}
      </Card>

      <MatterDetails
        address={tx.propertyAddress}
        price={formatPrice(tx.purchasePrice)}
        seller={sellerNames}
        buyer={buyerNames}
        firmName={firmName ?? null}
        actingFor={actingFor}
      />

      <ProgressStrip stages={displayStages} />

      {steps.length > 0 && (
        <div>
          <SectionHeading>What&rsquo;s due from you</SectionHeading>
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

      {raiseOpen && <SolicitorRaisePanel token={token} />}

      <Footer brand={brand} />
    </Shell>
  );
}

// ─── Presentational pieces — the solicitor-portal skin (see ./ui.ts) ─────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100svh",
        background: `linear-gradient(180deg, ${S.bgTop} 0%, ${S.bgBottom} 34%)`,
        padding: "22px 16px 56px",
        fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${S.cardBorder}`,
        borderRadius: 16,
        boxShadow: S.cardShadow,
        padding: "20px 22px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: "4px 4px 10px", fontSize: 15, fontWeight: 700, color: S.ink }}>{children}</h2>
  );
}

function Header({ brand }: { brand: string }) {
  return (
    <div
      style={{
        background: S.primary,
        borderRadius: 16,
        padding: "20px 22px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: S.cardShadow,
      }}
    >
      <span style={{ fontSize: 17, fontWeight: 700, color: "#ffffff", letterSpacing: ".2px" }}>{brand}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#9fb3c8", textTransform: "uppercase", letterSpacing: "1.4px" }}>Sale progression</span>
    </div>
  );
}

function MatterDetails({ address, price, seller, buyer, firmName, actingFor }: {
  address: string; price: string | null; seller: string; buyer: string; firmName: string | null; actingFor: string;
}) {
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: "flex", gap: 16, padding: "6px 0", fontSize: 13.5, lineHeight: 1.5, alignItems: "baseline" }}>
      <span style={{ color: S.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: S.ink, fontWeight: 600, marginLeft: "auto", textAlign: "right" }}>{value}</span>
    </div>
  );
  return (
    <Card style={{ padding: "18px 22px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: S.muted }}>Matter details</p>
      <Row label="Property" value={address} />
      {price && <Row label="Sale price" value={price} />}
      {seller && <Row label="Seller" value={seller} />}
      {buyer && <Row label="Buyer" value={buyer} />}
      {firmName && <Row label="Your firm" value={firmName} />}
      <Row label="You are acting for" value={actingFor} />
    </Card>
  );
}

function fmtShort(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Read-only "where the sale is up to" strip: the six display stages across both
// sides. Scrolls horizontally on narrow screens.
function ProgressStrip({ stages }: { stages: ResolvedStage[] }) {
  return (
    <Card style={{ padding: "18px 18px 16px" }}>
      <p style={{ margin: "0 0 16px 2px", fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: S.muted }}>
        Where the sale is up to
      </p>
      <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
        {stages.map((s, i) => (
          <StageNode key={s.key} stage={s} index={i + 1} />
        ))}
      </div>
    </Card>
  );
}

function StageNode({ stage, index }: { stage: ResolvedStage; index: number }) {
  const st = stage.status;
  const circle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    margin: "0 auto",
    ...(st === "complete"
      ? { background: S.primary, color: "#ffffff" }
      : st === "in_progress"
        ? { background: S.accentTint, border: `2px solid ${S.accent}`, color: S.accent }
        : st === "up_next"
          ? { background: "#ffffff", border: "2px solid #cbd6e4", color: S.inkSoft }
          : st === "skipped"
            ? { background: "#eef2f8", color: "#9fb0c4" }
            : { background: "#ffffff", border: "1px solid #e2e9f2", color: "#9fb0c4" }),
  };
  const sub =
    st === "complete"
      ? stage.completedAt ? fmtShort(stage.completedAt) : "Done"
      : st === "in_progress"
        ? "In progress"
        : st === "up_next"
          ? "Up next"
          : st === "skipped"
            ? "Skipped"
            : stage.forecastDate ? `~ ${fmtShort(stage.forecastDate)}` : "To do";
  const subColor = st === "in_progress" ? S.accent : st === "up_next" ? S.ink : S.faint;
  return (
    <div style={{ flex: "1 0 76px", minWidth: 76, textAlign: "center" }}>
      <div style={circle}>{st === "complete" ? "✓" : st === "skipped" ? "–" : index}</div>
      <p
        style={{
          margin: "9px 0 0",
          fontSize: 11,
          fontWeight: 600,
          color: st === "skipped" ? "#9fb0c4" : S.ink,
          lineHeight: 1.3,
          textDecoration: st === "skipped" ? "line-through" : "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {stage.name}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 10, color: subColor, fontWeight: st === "in_progress" ? 700 : 400, lineHeight: 1.3, whiteSpace: "nowrap" }}>
        {sub}
      </p>
    </div>
  );
}

function Footer({ brand }: { brand: string }) {
  return (
    <p style={{ margin: "8px 4px 0", fontSize: 11.5, lineHeight: 1.6, color: S.faint, textAlign: "center" }}>
      Sent by {brand} in relation to the matter above. If you&rsquo;re not the right person for this file, just reply to the email and let us know.
    </p>
  );
}

function InvalidNotice() {
  return (
    <Card style={{ padding: "40px 28px", textAlign: "center" }}>
      <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: S.ink }}>This link is not valid</p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: S.muted }}>
        The link may have expired or been mistyped. Please reply to the email you received and we&rsquo;ll send a fresh one.
      </p>
    </Card>
  );
}
