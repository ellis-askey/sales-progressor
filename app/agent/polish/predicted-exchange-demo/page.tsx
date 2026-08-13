"use client";

// Polish-pass demo for the predicted-exchange band shipped in 2ccf10e
// (visibility pass #2). Shows the three surfaces the band now renders on:
//
//   - Agent sidebar (TransactionSidebar.tsx) — "Expected exchange" row with
//     softened band + hedge sub-line
//   - Portal home (app/portal/[token]/page.tsx) — band inside the hero
//     gradient with gentler client-facing copy
//   - Chain LinkCard (components/chain/LinkCard.tsx) — short band line
//     under the per-link progress bar
//
// All three surfaces in their normal / early-estimate / override states.
// LinkCard renders the real component with mock data. Sidebar + portal
// blocks recreate the band-rendering JSX inline (faithful copy of the
// production markup — same classes, same colours) so we can show all
// states side-by-side without mocking the entire surrounding component.

import { LinkCard } from "@/components/chain/LinkCard";
import { formatPredictedBand } from "@/lib/utils/format-predicted-band";
import type { ChainLinkV2 } from "@/lib/services/chains";

// ─── Test dates ──────────────────────────────────────────────────────────────

const D_EARLY = new Date(2026, 5, 7);   // 7 June → "Around early June"
const D_MID = new Date(2026, 5, 15);    // 15 June → "Around mid June"
const D_LATE = new Date(2026, 5, 27);   // 27 June → "Around late June"
const D_OVERRIDE = new Date(2026, 5, 14); // 14 June → precise

// ─── Agent sidebar block (faithful copy of TransactionSidebar lines 296–313) ─

function SidebarBandBlock({
  label,
  predictedDate,
  isEarlyEstimate,
  overridden,
}: {
  label: string;
  predictedDate: Date | null;
  isEarlyEstimate: boolean;
  overridden: boolean;
}) {
  return (
    <div style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}>
      <p style={{
        margin: 0,
        padding: "9px 16px",
        background: "rgba(30, 45, 74, 0.04)",
        borderBottom: "0.5px solid var(--agent-border-default)",
        fontSize: 10,
        fontFamily: "monospace",
        color: "rgba(30, 45, 74, 0.6)",
        fontWeight: 600,
      }}>
        {label}
      </p>
      <div style={{ padding: "12px 16px", background: "var(--agent-surface-elevated)" }}>
        <div className="flex justify-between items-start">
          <p className="text-xs text-slate-900/40">Expected exchange</p>
          <div className="text-right">
            <p className={`text-xs font-semibold ${overridden ? "text-blue-600" : "text-slate-900/90"}`}>
              {predictedDate
                ? overridden
                  ? predictedDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : formatPredictedBand(predictedDate)
                : "—"}
              {overridden && (
                <span className="ml-1 text-xs text-blue-500">(overridden)</span>
              )}
            </p>
            {isEarlyEstimate ? (
              <p className="text-[10px] text-slate-900/30 mt-0.5">
                Too early to predict — using your 12-week target
              </p>
            ) : predictedDate && !overridden ? (
              <p className="text-[10px] text-slate-900/30 mt-0.5">
                Based on similar files — could shift by a week or two
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Portal hero block (faithful copy of portal/[token]/page.tsx hero strip) ─

function PortalHeroBlock({
  label,
  address,
  price,
  predictedDate,
  isEarlyEstimate,
  exchanged,
}: {
  label: string;
  address: string;
  price?: string;
  predictedDate: Date | null;
  isEarlyEstimate: boolean;
  exchanged: boolean;
}) {
  // Approximation of the portal P.heroGradient (warm coral → amber)
  const heroGradient =
    "linear-gradient(135deg, #FF6B4A 0%, #FF8A65 48%, #FFB347 100%)";

  return (
    <div style={{ borderBottom: "0.5px solid var(--agent-border-default)" }}>
      <p style={{
        margin: 0,
        padding: "9px 16px",
        background: "rgba(30, 45, 74, 0.04)",
        borderBottom: "0.5px solid var(--agent-border-default)",
        fontSize: 10,
        fontFamily: "monospace",
        color: "rgba(30, 45, 74, 0.6)",
        fontWeight: 600,
      }}>
        {label}
      </p>
      <div style={{ padding: 16, background: "#FDF9F5" }}>
        <div
          className="rounded-b-3xl px-5 pt-6 pb-7"
          style={{ background: heroGradient, boxShadow: "0 4px 20px rgba(255, 107, 74, 0.25)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span
                className="inline-block text-[11px] font-bold uppercase tracking-[0.10em] mb-3 px-3 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.90)" }}
              >
                Your purchase of
              </span>
              <h2 className="text-[22px] font-semibold text-white leading-snug">
                {address}
              </h2>
              {price && (
                <p className="text-[15px] font-semibold mt-2" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {price}
                </p>
              )}
              {!exchanged && predictedDate && (
                <div className="mt-3">
                  <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.92)" }}>
                    {isEarlyEstimate
                      ? "Expected exchange: we'll show an estimate as the file progresses"
                      : `Expected exchange: ${formatPredictedBand(predictedDate)}`}
                  </p>
                  {!isEarlyEstimate && (
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                      Based on files like yours. It can move a little either way.
                    </p>
                  )}
                </div>
              )}
              {exchanged && (
                <p className="text-[12px] mt-3 italic" style={{ color: "rgba(255,255,255,0.65)" }}>
                  (Expected-exchange band hidden in exchanged state — the dedicated banners take over.)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chain LinkCard mocks ────────────────────────────────────────────────────

function mockChainLink(overrides: Partial<ChainLinkV2> & { id: string; position: number }): ChainLinkV2 {
  return {
    claimedByUserId: null,
    createdByUserId: "user_mock",
    transactionId: "txn_mock",
    claimedAt: new Date(),
    stubPropertyAddress: null,
    stubAgencyName: null,
    stubAgentEmail: null,
    stubAgentName: null,
    stubAgentPhone: null,
    stubNotes: null,
    inviteStatus: "CLAIMED",
    inviteSentAt: null,
    inviteBouncedAt: null,
    inviteDeclinedAt: null,
    inviteResendCount: 0,
    withdrawalStatus: null,
    withdrawalRespondedAt: null,
    transaction: {
      id: "txn_mock",
      propertyAddress: "47 Oak Road, Bristol, BS6 7TH",
      status: "active",
      agencyId: "agency_mock",
      purchasePrice: 42500000,
      photoUrl: null,
    },
    progressPercent: 42,
    predictedExchangeDate: null,
    isEarlyEstimate: false,
    stuckMilestoneLabel: null,
    claimedBy: { id: "user_mock", name: "Sarah Hartwell", firmName: "Hartwell & Partners" },
    createdBy: null,
    ...overrides,
  };
}

const CHAIN_SCENARIOS: { label: string; link: ChainLinkV2 }[] = [
  {
    label: "5. Chain LinkCard — normal forecast (band line visible)",
    link: mockChainLink({
      id: "link_normal",
      position: 0,
      progressPercent: 42,
      predictedExchangeDate: D_MID,
      isEarlyEstimate: false,
    }),
  },
  {
    label: "6. Chain LinkCard — early-estimate file (band line hidden)",
    link: mockChainLink({
      id: "link_early",
      position: 1,
      progressPercent: 8,
      predictedExchangeDate: new Date(2026, 7, 1),
      isEarlyEstimate: true,
      transaction: {
        id: "txn_early",
        propertyAddress: "12 Pine Lane, Bristol, BS5 0AB",
        status: "active",
        agencyId: "agency_mock",
        purchasePrice: null,
        photoUrl: null,
      },
    }),
  },
  {
    label: "7. Chain LinkCard — unclaimed stub (band line not applicable, no transaction)",
    link: mockChainLink({
      id: "link_stub",
      position: 2,
      transactionId: null,
      claimedByUserId: null,
      claimedAt: null,
      claimedBy: null,
      transaction: null,
      progressPercent: null,
      predictedExchangeDate: null,
      isEarlyEstimate: false,
      stubPropertyAddress: "22 Birchwood Lane, Harpenden, AL5 1DP",
      stubAgencyName: "Foster & Co",
      inviteStatus: "INVITED",
      inviteSentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    }),
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PredictedExchangeDemoPage() {
  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 920, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Predicted-exchange band — visibility pass #2
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          Seven scenarios across three surfaces. Sidebar + portal hero blocks are faithful copies of the production JSX (same classes, same colours). LinkCard renders the real component with mock <code>ChainLinkV2</code> data.
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          Live commit: <code>2ccf10e</code> · helper: <code>lib/utils/format-predicted-band.ts</code> · band: <code>Around early/mid/late {"{Month}"}</code> (day 1–10 / 11–20 / 21+) with year suffix only if not current.
        </p>
      </header>

      {/* ─── Agent sidebar block ─── */}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", margin: "20px 0 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Agent sidebar — TransactionSidebar.tsx
      </h2>
      <div style={{
        border: "0.5px solid var(--agent-border-default)",
        borderRadius: 12,
        background: "var(--agent-surface-elevated)",
        overflow: "hidden",
      }}>
        <SidebarBandBlock
          label="1. Normal forecast — softened band + hedge sub-line"
          predictedDate={D_MID}
          isEarlyEstimate={false}
          overridden={false}
        />
        <SidebarBandBlock
          label="2. Early-estimate state — hedge swaps to '12-week target' line"
          predictedDate={D_LATE}
          isEarlyEstimate={true}
          overridden={false}
        />
        <SidebarBandBlock
          label="3. Override set — precise date + (overridden) badge, no hedge"
          predictedDate={D_OVERRIDE}
          isEarlyEstimate={false}
          overridden={true}
        />
        <SidebarBandBlock
          label="4. No prediction available (e.g. withdrawn) — em-dash, no line"
          predictedDate={null}
          isEarlyEstimate={false}
          overridden={false}
        />
      </div>

      {/* ─── Portal hero block ─── */}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", margin: "28px 0 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Portal home — app/portal/[token]/page.tsx (hero gradient strip)
      </h2>
      <div style={{
        border: "0.5px solid var(--agent-border-default)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <PortalHeroBlock
          label="5. Normal forecast — gentler client-facing sub-line"
          address="14 Hartwell Avenue, Harpenden"
          price="£525,000"
          predictedDate={D_MID}
          isEarlyEstimate={false}
          exchanged={false}
        />
        <PortalHeroBlock
          label="6. Early-estimate state — placeholder sentence, no sub-line"
          address="14 Hartwell Avenue, Harpenden"
          price="£525,000"
          predictedDate={D_LATE}
          isEarlyEstimate={true}
          exchanged={false}
        />
        <PortalHeroBlock
          label="7. Exchanged state — band hidden (banners take over)"
          address="14 Hartwell Avenue, Harpenden"
          price="£525,000"
          predictedDate={D_MID}
          isEarlyEstimate={false}
          exchanged={true}
        />
      </div>

      {/* ─── Chain LinkCard ─── */}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", margin: "28px 0 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Chain drawer — components/chain/LinkCard.tsx
      </h2>
      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "0 0 8px" }}>
        Real <code>LinkCard</code> component with mock <code>ChainLinkV2</code> data. Notice the short <code>Exchange ~mid Jun</code> form (drops the &ldquo;Around&rdquo; prefix to fit the card).
      </p>
      <div style={{
        border: "0.5px solid var(--agent-border-default)",
        borderRadius: 12,
        background: "var(--agent-surface-elevated)",
        overflow: "hidden",
      }}>
        {CHAIN_SCENARIOS.map((s, i) => (
          <div key={i} style={{ borderBottom: i < CHAIN_SCENARIOS.length - 1 ? "0.5px solid var(--agent-border-default)" : "none" }}>
            <p style={{
              margin: 0,
              padding: "9px 16px",
              background: "rgba(30, 45, 74, 0.04)",
              borderBottom: "0.5px solid var(--agent-border-default)",
              fontSize: 10,
              fontFamily: "monospace",
              color: "rgba(30, 45, 74, 0.6)",
              fontWeight: 600,
            }}>
              {s.label}
            </p>
            <div style={{ padding: 12 }}>
              <LinkCard
                link={s.link}
                totalLinks={3}
                currentUserId="user_viewer"
                isYourFile={false}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ─── Notes ─── */}
      <div style={{ marginTop: 24, padding: 16, background: "rgba(30, 45, 74, 0.04)", borderRadius: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>What you&apos;re looking at:</strong> Three surfaces, seven scenarios. Sidebar + portal blocks are inline copies of the production JSX (same classes, same colours, same hedge logic) so you can compare all states side-by-side. The chain LinkCard is the actual component — pass it different <code>predictedExchangeDate</code> / <code>isEarlyEstimate</code> / <code>transaction</code> values and it renders the band line accordingly.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Voice differences:</strong> Agent sub-line (&ldquo;Based on similar files — could shift by a week or two&rdquo;) is brisk + technical-honest. Portal sub-line (&ldquo;Based on files like yours. It can move a little either way.&rdquo;) is warmer + client-facing. Both honestly hedge the median-based variance without smuggling false precision back in.
        </p>
      </div>
    </div>
  );
}
