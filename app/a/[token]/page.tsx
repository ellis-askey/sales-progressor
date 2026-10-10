import { verifyAdvisorToken } from "@/lib/advisor-confirm/token";
import { getAdvisorPortalView } from "@/lib/advisor-confirm/portal-data";
import { getPropertyEnrichment } from "@/lib/services/property-enrichment";
import { PortalOverviewHero, type OverviewTile } from "@/components/portal/PortalOverviewHero";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { P } from "@/components/portal/portal-ui";
import { AdvisorMortgageSteps } from "./AdvisorMortgageSteps";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateShort(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function startOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.getTime();
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: P.textMuted }}>
      {children}
    </p>
  );
}

export default async function AdvisorOverviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = verifyAdvisorToken(token);
  if (!decoded) return null; // layout renders the invalid notice
  const view = await getAdvisorPortalView(decoded.transactionId, decoded.side);
  if (!view) return null;

  // EPC is a live lookup — never let it block or break the page.
  const epc = await getPropertyEnrichment(view.fullAddress)
    .then((e) => (e.epc.status === "ok" && e.epc.data ? e.epc.data : null))
    .catch(() => null);

  // Build the shared client hero's props from the sale's 6-stage journey.
  const firstIncompleteIdx = view.displayStages.findIndex((s) => s.status !== "complete" && s.status !== "skipped");
  const tiles: OverviewTile[] = view.displayStages.map((s, i) => {
    const isComplete = s.status === "complete" || s.status === "skipped";
    const isActive = !isComplete && i === firstIncompleteIdx;
    const status: OverviewTile["status"] = isComplete ? "complete" : isActive ? "active" : "pending";
    return {
      key: s.key,
      label: s.name,
      status,
      text: isComplete ? "Completed" : isActive ? "In progress" : "To do",
      completedDate: isComplete && s.completedAt ? fmtDateShort(s.completedAt) : undefined,
    };
  });
  const currentStepNumber = firstIncompleteIdx >= 0 ? firstIncompleteIdx + 1 : view.displayStages.length || 1;
  const exchangeDone = view.displayStages.find((s) => s.key === "exchange")?.status === "complete";
  const completionDone = view.displayStages.find((s) => s.key === "completion")?.status === "complete";
  const currentStage4 = completionDone ? "Completion" : exchangeDone ? "Exchange" : "Conveyancing";
  const activeTile = tiles.find((t) => t.status === "active");
  const currentStageSubLabel = activeTile ? activeTile.label : completionDone ? "Complete" : "";
  const headlineWhen = view.plannedDate ?? view.estimateDate;
  const daysUntilPredicted = headlineWhen ? Math.round((startOfDayMs(headlineWhen) - startOfDayMs(new Date())) / 86_400_000) : null;

  const callHref = view.pointOfContact?.phone ? `tel:${view.pointOfContact.phone}` : null;
  const emailHref = view.pointOfContact?.email
    ? `mailto:${view.pointOfContact.email}?subject=${encodeURIComponent(`Mortgage: ${view.fullAddress}`)}`
    : null;

  return (
    <div className="portal-reveal-stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="portal-reveal-host">
        <PortalOverviewHero
          address={view.addressLine1}
          addressLine2={view.addressLine2 || null}
          photoUrl={null}
          status={view.status}
          tenure={view.tenureRaw}
          purchaseType={view.purchaseTypeRaw}
          percent={view.readinessPercent}
          currentStepNumber={currentStepNumber}
          currentStage4={currentStage4}
          currentStageSubLabel={currentStageSubLabel}
          tiles={tiles}
          targetDate={view.targetDate}
          estimateDate={view.estimateDate}
          plannedDate={view.plannedDate}
          daysUntilPredicted={daysUntilPredicted}
          progressHref={`/a/${token}`}
        />
      </div>

      {/* Mortgage steps — the ones the advisor is concerned with. */}
      <PortalGlassCard glassId="advisor-mortgage" label="Mortgage progress" style={{ padding: 18 }}>
        <SectionLabel>Mortgage progress</SectionLabel>
        {view.steps.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: P.textSecondary, lineHeight: 1.6 }}>
            The mortgage steps will appear here as the sale reaches them.
          </p>
        ) : (
          <AdvisorMortgageSteps token={token} steps={view.steps} />
        )}
        <p style={{ margin: "16px 0 0", fontSize: 11.5, color: P.textMuted, lineHeight: 1.6 }}>
          Nothing here is binding. It just keeps everyone&rsquo;s file up to date.
        </p>
      </PortalGlassCard>

      {/* Point of contact — real portal buttons (coral primary + hairline). */}
      {view.pointOfContact && (
        <PortalGlassCard glassId="advisor-contact" label="Contact" style={{ padding: 18 }}>
          <SectionLabel>Your point of contact</SectionLabel>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.textPrimary }}>{view.pointOfContact.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: P.textSecondary }}>{view.agencyName}</p>
          {(callHref || emailHref) && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {callHref && (
                <a
                  href={callHref}
                  className="pbtn pbtn-secondary pbtn-press"
                  style={{ flex: 1, textAlign: "center", padding: "11px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
                >
                  Call
                </a>
              )}
              {emailHref && (
                <a
                  href={emailHref}
                  className="pbtn pbtn-primary pbtn-press"
                  style={{ flex: 1, textAlign: "center", padding: "11px 16px", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", background: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)", color: "#fff" }}
                >
                  Email
                </a>
              )}
            </div>
          )}
        </PortalGlassCard>
      )}

      {/* Mortgage offer expiry */}
      {view.offerExpiry && (
        <PortalGlassCard glassId="advisor-offer" label="Mortgage offer" style={{ padding: 18 }}>
          <SectionLabel>Mortgage offer</SectionLabel>
          <p style={{ margin: 0, fontSize: 14, color: P.textPrimary, lineHeight: 1.6 }}>
            Offer {view.offerExpiry.approx ? "expected to expire around" : "expires"}{" "}
            <span style={{ fontWeight: 700 }}>{fmtDate(view.offerExpiry.date)}</span>
            {view.offerExpiry.approx ? " (estimated)" : ""}.
          </p>
        </PortalGlassCard>
      )}

      {/* EPC */}
      {epc && epc.rating && (
        <PortalGlassCard glassId="advisor-epc" label="EPC" style={{ padding: 18 }}>
          <SectionLabel>EPC</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: P.successBg, color: P.success, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
              {epc.rating}
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, color: P.textPrimary }}>
                Current rating <strong>{epc.rating}</strong>
                {epc.potentialRating ? ` · potential ${epc.potentialRating}` : ""}
              </p>
              {epc.validUntil && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: P.textSecondary }}>Valid until {fmtDate(epc.validUntil.slice(0, 10))}</p>}
            </div>
          </div>
        </PortalGlassCard>
      )}

      <p style={{ margin: "4px 2px 0", fontSize: 11.5, color: P.textMuted, lineHeight: 1.6 }}>
        This is a private view of {view.fullAddress} shared with you as the mortgage advisor. Please don&rsquo;t forward this link.
      </p>
    </div>
  );
}
