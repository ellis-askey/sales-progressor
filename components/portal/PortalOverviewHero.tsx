"use client";
// Portal Overview hero — 2026-08-09 rebuild to founder mock:
//   [property photo]  →  [address + pills]  +  [progress ring + current stage]
//                     fades to page-bg at the bottom
//                     soft white frost behind text for legibility
//   [6-tile progress strip]  Instructed / Draft pack / Searches / Enquiries / Exchange / Completion
//   [Expected exchange · X days remaining]  +  [You're in good hands]
//
// Dumb component — the page computes stage state, tile status, and copy;
// this file only lays them out. Don't-mislead logic (Searches only
// "In progress" if PM8 done, Exchange never shows a forecast date,
// Completion is locked until exchange) lives on the page side and lands
// here as pre-computed `text` values on each tile.

import { HouseSimple, Lock, Check, Shield } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";

export type OverviewTile = {
  key: string;
  label: string;
  /** "complete" — green tick; "active" — coral ring + number; "pending" — muted number */
  status: "complete" | "active" | "pending";
  /** Text under the tile — a date, "In progress", "Awaiting", "Pending", or "Locked until exchange". */
  text: string;
  /** true → render a lock icon instead of the number (Completion tile until exchange). */
  locked?: boolean;
};

type Props = {
  address: string;
  addressLine2: string | null;
  photoUrl: string | null;
  status: "draft" | "active" | "on_hold" | "completed" | "withdrawn";
  tenure: "freehold" | "leasehold" | null;
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds" | null;
  /** 0-100. Drives the ring arc. */
  percent: number;
  /** Position of the currently-active step (1..6). Matches the mock's
   *  "3 of 6" when Searches is active, not the count of completed
   *  stages. If everything is complete → 6. */
  currentStepNumber: number;
  /** Simplified 4-label current stage: Onboarding / Conveyancing / Exchange / Completion. */
  currentStage4: string;
  /** Sub-label from the active 6-tile, e.g. "Searches underway". */
  currentStageSubLabel: string;
  /** The 6 progress tiles, ordered instructed → completion. */
  tiles: OverviewTile[];
  /** Exchange date to display in the hero (prefer agent-set target over
   *  algorithmic prediction — done on the page side). Null hides the card. */
  predictedExchangeDate: Date | null;
  /** Days until the hero's exchange date, computed on the page. */
  daysUntilPredicted: number | null;
};

function fmtDateShort(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtDateLong(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function formatTenure(t: string | null): string | null {
  if (t === "freehold") return "Freehold";
  if (t === "leasehold") return "Leasehold";
  return null;
}
function formatPurchaseType(p: string | null): string | null {
  if (p === "mortgage") return "Mortgage";
  if (p === "cash_buyer") return "Cash buyer";
  if (p === "cash_from_proceeds") return "Cash buyer";
  return null;
}
function formatStatus(s: string): { label: string; dotColor: string } {
  if (s === "active") return { label: "Active", dotColor: P.success };
  if (s === "on_hold") return { label: "On hold", dotColor: P.warning };
  if (s === "completed") return { label: "Completed", dotColor: P.accent };
  if (s === "withdrawn") return { label: "Withdrawn", dotColor: P.textMuted };
  return { label: "Draft", dotColor: P.textMuted };
}

// Small circular progress ring for the hero. SVG stroke-dasharray trick.
// 96px outer diameter to match the mock's proportion.
function HeroRing({ percent, stepNumber }: { percent: number; stepNumber: number }) {
  const size = 96;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(15,23,42,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={P.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        color: P.textPrimary,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: P.textPrimary }}>{stepNumber}</span>
        <span style={{ fontSize: 10, color: P.textMuted, marginTop: 2 }}>of 6</span>
      </div>
    </div>
  );
}

// Translucent glass pill — matches the bottom-nav treatment. Not solid
// (that read wrong against the mock). Backdrop-blur gives it a real
// glassy look so it reads on any part of the photo underneath.
function Pill({ children, dotColor, tone = "neutral" }: {
  children: React.ReactNode;
  dotColor?: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: tone === "accent" ? P.primary : P.textPrimary,
        background: "rgba(255, 255, 255, 0.55)",
        border: "0.5px solid rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(12px) saturate(1.5)",
        WebkitBackdropFilter: "blur(12px) saturate(1.5)",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        whiteSpace: "nowrap",
      }}
    >
      {dotColor && (
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: dotColor }} />
      )}
      {children}
    </span>
  );
}

function ProgressTile({ tile, index }: { tile: OverviewTile; index: number }) {
  const isComplete = tile.status === "complete";
  const isActive = tile.status === "active";
  const ringColor = isComplete ? P.success : isActive ? P.primary : "rgba(15,23,42,0.20)";
  const numberColor = isComplete ? P.success : isActive ? P.primary : P.textMuted;
  const labelColor = P.textPrimary;
  const textColor = isActive ? P.primary : P.textMuted;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      flex: "1 0 0",
      minWidth: 0,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 999,
        border: `2px solid ${ringColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: numberColor,
        fontWeight: 700, fontSize: 13,
        flexShrink: 0,
      }}>
        {tile.locked
          ? <Lock size={13} weight="regular" />
          : isComplete
            ? <Check size={14} weight="bold" />
            : index}
      </div>
      <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
        {/* Wrap allowed on both lines — tile widths get tight on mobile
            and truncating "Draft pack" or "Prepping" would erase the
            signal. Two-line wrap looks intentional; ellipsis looks
            broken. */}
        <p style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          color: labelColor,
          lineHeight: 1.25,
          wordBreak: "break-word",
        }}>{tile.label}</p>
        <p style={{
          margin: "2px 0 0",
          fontSize: 10,
          color: textColor,
          fontWeight: isActive ? 600 : 400,
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}>{tile.text}</p>
      </div>
    </div>
  );
}

function ConnectorSegment({ leftComplete }: { leftComplete: boolean }) {
  return (
    <div style={{
      flex: "0 0 auto",
      height: 2,
      width: 12,
      marginTop: 15, // aligns with tile-circle centre
      background: leftComplete ? P.success : "rgba(15,23,42,0.10)",
      borderRadius: 2,
    }} />
  );
}

export function PortalOverviewHero({
  address,
  addressLine2,
  photoUrl,
  status,
  tenure,
  purchaseType,
  percent,
  currentStepNumber,
  currentStage4,
  currentStageSubLabel,
  tiles,
  predictedExchangeDate,
  daysUntilPredicted,
}: Props) {
  const statusMeta = formatStatus(status);
  const tenureLabel = formatTenure(tenure);
  const purchaseTypeLabel = formatPurchaseType(purchaseType);

  return (
    <div className="space-y-4">
      {/* ── Photo hero with overlays ─────────────────────────────────── */}
      {/* Layout: photo fills the container top; a strong gradient at the
          BOTTOM fades the photo into the page background so the content
          (address / pills / ring / current stage) sits on a
          near-white zone at the bottom that reads clearly. No wide
          frost blur — Ellis flagged that as too heavy and mis-placed;
          the mock's readable zone comes from the fade, not the blur.
          Pills are proper translucent glass (see Pill component) so
          they still read cleanly across the transition. */}
      <div
        className="-mx-4"
        style={{
          position: "relative",
          height: 380,
          overflow: "hidden",
          background: P.pageBg,
        }}
      >
        {/* Photo (or coral fallback if none) */}
        {photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl}
            alt=""
            aria-hidden
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              background: P.heroGradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <HouseSimple size={96} weight="thin" />
          </div>
        )}

        {/* Bottom fade — the ONLY overlay on the photo. Fades transparent
            at the top of the content zone to the page background at the
            very bottom, so the photo dissolves into the page and the
            text below sits on a near-white area. Blur intentionally
            omitted (Ellis's 2026-08-09 note: too heavy + wrong shape). */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            height: "60%",
            pointerEvents: "none",
            background: `linear-gradient(180deg, transparent 0%, ${P.pageBg}CC 55%, ${P.pageBg} 100%)`,
          }}
        />

        {/* Content — address + pills bottom-left, ring + current stage
            bottom-right. Sits on the faded zone (near-white). */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "20px 20px 28px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              data-sensitive="true"
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: P.textPrimary,
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
              }}
            >
              {address}
            </h1>
            {addressLine2 && (
              <p
                data-sensitive="true"
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: P.textSecondary,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {addressLine2}
              </p>
            )}

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Pill dotColor={statusMeta.dotColor}>{statusMeta.label}</Pill>
              {tenureLabel && <Pill>{tenureLabel}</Pill>}
              {purchaseTypeLabel && <Pill>{purchaseTypeLabel}</Pill>}
            </div>
          </div>

          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}>
            <HeroRing percent={percent} stepNumber={currentStepNumber} />
            <div style={{ textAlign: "center" }}>
              <p style={{
                margin: 0,
                fontSize: 9,
                fontWeight: 700,
                color: P.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
              }}>
                Current stage
              </p>
              {/* Main label — bold navy. Sub-label — lighter, sentence-
                  case (do NOT lowercase; Ellis flagged that). */}
              <p style={{
                margin: "3px 0 0",
                fontSize: 15,
                fontWeight: 700,
                color: P.textPrimary,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}>
                {currentStage4}
              </p>
              {currentStageSubLabel && (
                <p style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: P.textSecondary,
                  fontWeight: 500,
                  lineHeight: 1.25,
                }}>
                  {currentStageSubLabel}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress Overview (6 tiles) ──────────────────────────────── */}
      <div className="rounded-2xl" style={{ background: P.cardBg, boxShadow: P.shadowSm, padding: "16px 14px" }}>
        <p style={{
          margin: "0 0 14px",
          fontSize: 10,
          fontWeight: 700,
          color: P.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          paddingLeft: 4,
        }}>
          Progress overview
        </p>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 0,
        }}>
          {tiles.map((tile, i) => (
            <div key={tile.key} style={{ display: "contents" }}>
              <ProgressTile tile={tile} index={i + 1} />
              {i < tiles.length - 1 && (
                <ConnectorSegment leftComplete={tile.status === "complete"} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Expected exchange + You're in good hands ────────────────── */}
      {predictedExchangeDate && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: P.cardBg, boxShadow: P.shadowSm }}
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 0,
          }}>
            {/* Left: expected exchange */}
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: P.primaryBg, color: P.primary,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8"  y1="2" x2="8"  y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, color: P.textSecondary, fontWeight: 500 }}>
                  Expected exchange
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: P.textPrimary, lineHeight: 1.2 }}>
                  {fmtDateLong(predictedExchangeDate)}
                </p>
                {typeof daysUntilPredicted === "number" && daysUntilPredicted >= 0 && (
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: P.textMuted }}>
                    {daysUntilPredicted === 0
                      ? "today"
                      : daysUntilPredicted === 1
                        ? "1 day to go"
                        : `${daysUntilPredicted} days to go`}
                  </p>
                )}
              </div>
            </div>
            {/* Right: reassurance */}
            <div style={{
              padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 12,
              background: P.successBg,
              borderLeft: `0.5px solid ${P.border}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(16,185,129,0.15)", color: P.success,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Shield size={18} weight="regular" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#065F46", lineHeight: 1.2 }}>
                  You&apos;re in good hands
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#047857", lineHeight: 1.35 }}>
                  We&apos;ll keep you updated at every important step.
                </p>
              </div>
              {/* Chevron removed 2026-08-09 — nothing to click through to,
                  and Ellis flagged it as misleading. */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
