"use client";

// PREVIEW ONLY (critique #297). A faithful copy of the client-portal "Expected
// exchange" card (components/portal/PortalKeyDatesCard.tsx) with the proposed
// changes, so the look is signed off before the real shared component (which also
// drives the agent Client-portal settings preview) is touched:
//   1. Estimate column: "around late December"  ->  "W/C 15 Jun 2026" (snapped to
//      the Monday; no ordinal, short month + year, to match the other dates).
//   2. 12-week target: a caption line underneath ("Target date to be ready to
//      exchange.").
//   3. Right column always reads "Estimated exchange" (the old "Planned exchange"
//      state — an agent override of the predicted date — is just their estimate,
//      and the agent side calls it "Expected exchange (set)", never "Planned").
// Nothing here is wired into the real portal.

import { P } from "@/components/portal/portal-ui";

const CAPTION = "Target date to be ready to exchange.";

// Short month + year, no ordinal — matches the card's other dates (fmtDateLong).
function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
// Week-commencing: snap to the Monday, then render like the other dates.
//   -> "W/C 15 Jun 2026"
function formatWeekCommencing(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return `W/C ${fmtDateLong(d)}`;
}

const CALENDAR_SVG = (stroke: string) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// Faithful reproduction of PortalKeyDatesCard with the #297 changes applied.
// `exchangeDate` is the agent-set override OR the live prediction — both now read
// "Estimated exchange" and both render as W/C.
function PreviewCard({
  targetDate, exchangeDate, daysToGo,
}: {
  targetDate: Date | null;
  exchangeDate: Date | null;
  daysToGo: number | null;
}) {
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: P.cardBg, boxShadow: P.shadowSm }}>
      <div className="portal-keydates-grid">
        {/* Left: 12-week target + NEW caption */}
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 13 }}>
          {CALENDAR_SVG(P.primary)}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, color: P.textSecondary, fontWeight: 500 }}>12-week target</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: P.textPrimary, lineHeight: 1.2 }}>
              {targetDate ? `by ${fmtDateLong(targetDate)}` : "To be confirmed"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: P.textMuted, lineHeight: 1.35 }}>{CAPTION}</p>
          </div>
        </div>
        {/* Right: always "Estimated exchange", always W/C */}
        <div className="portal-keydates-col2" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 13, borderLeft: `0.5px solid ${P.border}` }}>
          {CALENDAR_SVG(P.textMuted)}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, color: P.textSecondary, fontWeight: 500 }}>Estimated exchange</p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: P.textPrimary, lineHeight: 1.2 }}>
              {exchangeDate ? formatWeekCommencing(exchangeDate) : "To be confirmed"}
            </p>
            {typeof daysToGo === "number" && daysToGo >= 0 && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: P.textMuted }}>
                {daysToGo === 0 ? "today" : daysToGo === 1 ? "about 1 day to go" : `about ${daysToGo} days to go`}
              </p>
            )}
          </div>
        </div>
      </div>
      {/* Reassurance band (unchanged) */}
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, background: P.successBg, borderTop: `0.5px solid ${P.border}` }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
          <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" />
        </svg>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#065F46", lineHeight: 1.2 }}>You&apos;re in good hands</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#047857", lineHeight: 1.35 }}>We&apos;ll keep you updated at every important step.</p>
        </div>
      </div>
    </div>
  );
}

export default function PortalKeyDatesPreview() {
  const target = new Date("2026-12-20");
  const estJune = new Date("2026-06-18");   // -> W/C 15 Jun 2026
  const estDec = new Date("2026-12-23");    // -> W/C 21 Dec 2026

  const frame: React.CSSProperties = { width: "100%", maxWidth: 440 };
  const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#64748b", margin: "0 0 10px" };

  return (
    <div style={{ minHeight: "100vh", background: "#eef1f4", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 36, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a" }}>
      <div style={{ ...frame, maxWidth: 680 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#FF6B4A", margin: "0 0 6px" }}>Critique #297 · preview only</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-.02em" }}>Client portal · &ldquo;Expected exchange&rdquo; card</h1>
        <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.55, margin: 0 }}>
          Your decisions, applied. <b>Not wired into the real portal yet.</b> The same card renders in the agent&rsquo;s Client-portal settings preview, so I change it in one place once you&rsquo;re happy.
        </p>
        <ul style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.7, margin: "12px 0 0", paddingLeft: 18 }}>
          <li>Estimate: <s>around late December</s> &rarr; <b>W/C 15 Jun 2026</b> (no ordinal, short month, to match the other dates).</li>
          <li>12-week target: caption <b>&ldquo;{CAPTION}&rdquo;</b></li>
          <li>Right column always reads <b>Estimated exchange</b> (no more &ldquo;Planned exchange&rdquo;).</li>
        </ul>
      </div>

      <div style={frame}>
        <p style={sectionLabel}>Estimated exchange (June)</p>
        <PreviewCard targetDate={target} exchangeDate={estJune} daysToGo={126} />
      </div>

      <div style={frame}>
        <p style={sectionLabel}>Another estimate (December &rarr; W/C 21 Dec 2026)</p>
        <PreviewCard targetDate={target} exchangeDate={estDec} daysToGo={46} />
      </div>

      <div style={{ ...frame, maxWidth: 680, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
        <p style={{ ...sectionLabel, color: "#b45309", margin: "0 0 8px" }}>One open question for you</p>
        <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, margin: 0 }}>
          When an agent <b>manually sets</b> a specific exchange date (the old &ldquo;Planned&rdquo; case), the card above now softens it to a <b>W/C week</b> like any estimate. If you&rsquo;d rather the client see the <b>exact date</b> the agent pinned (e.g. &ldquo;15 Jun 2026&rdquo;) in that one case, say so and I&rsquo;ll keep it exact when it&rsquo;s a manual override.
        </p>
      </div>
    </div>
  );
}
