import { verifyAdvisorToken } from "@/lib/advisor-confirm/token";
import { getAdvisorPortalView } from "@/lib/advisor-confirm/portal-data";
import { getPropertyEnrichment } from "@/lib/services/property-enrichment";
import { A, Card, SectionLabel, Chip, ProgressBar, StepDot } from "./ui";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtUpdated(d: Date): string {
  const dd = new Date(d);
  const same = dd.toDateString() === new Date().toDateString();
  if (same) return `Today, ${dd.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, "")}`;
  return dd.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

  const chips = [view.purchaseType, view.tenure, view.price].filter(Boolean) as string[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header / hero */}
      <Card>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: A.ink, lineHeight: 1.25 }}>{view.addressLine1}</p>
        {view.addressLine2 && <p style={{ margin: "2px 0 0", fontSize: 13.5, color: A.muted }}>{view.addressLine2}</p>}
        {chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        )}
        {view.advisingNames && (
          <p style={{ margin: "14px 0 0", fontSize: 13.5, color: A.muted }}>
            Advising <span style={{ color: A.ink, fontWeight: 600 }}>{view.advisingNames}</span>
            {view.firmName ? ` · ${view.firmName}` : ""}
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: A.muted }}>{view.currentStageName ?? "Progress"}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: A.accent }}>{view.readinessPercent}%</span>
          </div>
          <ProgressBar percent={view.readinessPercent} />
          <p style={{ margin: "8px 0 0", fontSize: 11.5, color: A.faint }}>Last updated {fmtUpdated(view.lastUpdated)}</p>
        </div>
      </Card>

      {/* Point of contact */}
      {view.pointOfContact && (
        <Card>
          <SectionLabel>Your point of contact</SectionLabel>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: A.ink }}>{view.pointOfContact.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: A.muted }}>{view.agencyName}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {view.pointOfContact.phone && (
              <a href={`tel:${view.pointOfContact.phone}`} style={{ textDecoration: "none", padding: "9px 14px", borderRadius: 10, border: `1px solid ${A.line}`, color: A.ink, fontSize: 13.5, fontWeight: 600 }}>
                Call
              </a>
            )}
            {view.pointOfContact.email && (
              <a
                href={`mailto:${view.pointOfContact.email}?subject=${encodeURIComponent(`Mortgage: ${view.fullAddress}`)}`}
                style={{ textDecoration: "none", padding: "9px 14px", borderRadius: 10, background: A.accent, color: "#fff", fontSize: 13.5, fontWeight: 600 }}
              >
                Email
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Mortgage steps */}
      <Card>
        <SectionLabel>Mortgage progress</SectionLabel>
        {view.steps.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: A.muted, lineHeight: 1.6 }}>
            The mortgage steps will appear here as the sale reaches them.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {view.steps.map((s) => (
              <div key={s.code} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <StepDot status={s.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: s.status === "upcoming" ? A.faint : A.ink }}>{s.label}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 12.5, color: A.muted }}>
                    {s.status === "complete" ? `Confirmed${fmtDate(s.date) ? ` · ${fmtDate(s.date)}` : ""}` : s.status === "current" ? `In progress${fmtDate(s.date) ? ` · expected ${fmtDate(s.date)}` : ""}` : "Not yet"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Mortgage offer expiry */}
      {view.offerExpiry && (
        <Card style={{ background: A.amberSoft, borderColor: "#F0DFC2" }}>
          <SectionLabel>Mortgage offer</SectionLabel>
          <p style={{ margin: 0, fontSize: 14, color: A.ink, lineHeight: 1.6 }}>
            Offer {view.offerExpiry.approx ? "expected to expire around" : "expires"}{" "}
            <span style={{ fontWeight: 700 }}>{fmtDate(view.offerExpiry.date)}</span>
            {view.offerExpiry.approx ? " (estimated)" : ""}.
          </p>
        </Card>
      )}

      {/* EPC */}
      {epc && epc.rating && (
        <Card>
          <SectionLabel>EPC</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: A.accentSoft, color: A.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
              {epc.rating}
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, color: A.ink }}>
                Current rating <strong>{epc.rating}</strong>
                {epc.potentialRating ? ` · potential ${epc.potentialRating}` : ""}
              </p>
              {epc.validUntil && (
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: A.muted }}>Valid until {fmtDate(epc.validUntil.slice(0, 10))}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Key dates */}
      {(view.keyDates.expectedExchange || view.keyDates.completion) && (
        <Card>
          <SectionLabel>Key dates</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {view.keyDates.expectedExchange && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: A.muted }}>Expected exchange</span>
                <span style={{ color: A.ink, fontWeight: 600 }}>{fmtDate(view.keyDates.expectedExchange)}</span>
              </div>
            )}
            {view.keyDates.completion && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: A.muted }}>Target completion</span>
                <span style={{ color: A.ink, fontWeight: 600 }}>{fmtDate(view.keyDates.completion)}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      <p style={{ margin: "4px 2px 0", fontSize: 11.5, color: A.faint, lineHeight: 1.6 }}>
        This is a private view of {view.fullAddress} shared with you as the mortgage advisor. Please don&rsquo;t forward this link.
      </p>
    </div>
  );
}
