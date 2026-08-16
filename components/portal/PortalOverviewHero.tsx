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

import Link from "next/link";
import { Lock, Check, Shield, CaretRight, Calendar } from "@phosphor-icons/react/dist/ssr";
import { P, PortalPill, type PortalPillTone } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";

export type OverviewTile = {
  key: string;
  label: string;
  /** "complete" — green tick; "active" — coral ring + number; "pending" — muted number */
  status: "complete" | "active" | "pending";
  /** Pill text — "Completed" / "In progress" / "Underway" / "Nearing" / "Pending" / "TBC" / etc. */
  text: string;
  /** Client-facing plain-English sentence under the label on the mobile
   *  timeline. State-appropriate: future tense for pending, present for
   *  active, past for complete. Not shown on the desktop horizontal strip. */
  description?: string;
  /** ISO-ish date to render as the small label next to the pill on
   *  complete rows. e.g. "25 Jun". Undefined for non-complete rows. */
  completedDate?: string;
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
  /** Where the "View full timeline" button (top-right of the Progress
   *  overview card) links to. Usually `/portal/${token}/progress`. */
  progressHref: string;
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
function formatStatus(s: string): { label: string; tone: PortalPillTone } {
  if (s === "active") return { label: "Active", tone: "green" };
  if (s === "on_hold") return { label: "On hold", tone: "amber" };
  if (s === "completed") return { label: "Completed", tone: "blue" };
  if (s === "withdrawn") return { label: "Withdrawn", tone: "grey" };
  return { label: "Draft", tone: "grey" };
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
      {/* Just the outer ring — the middle stays fully transparent so the
          property photo shows through it (founder, 2026-08-16). */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(15,23,42,0.28)"
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
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: P.textPrimary, textShadow: "0 1px 4px rgba(255,255,255,0.75)" }}>{stepNumber}</span>
        <span style={{ fontSize: 10, color: P.textSecondary, marginTop: 2, fontWeight: 500, textShadow: "0 1px 3px rgba(255,255,255,0.75)" }}>of 6</span>
      </div>
    </div>
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

// Vertical timeline row — mobile alternative to the horizontal
// ProgressTile. Renders one stage per row:
//   [circle in left rail]  [label]                       [pill]
//                          [description]                 [date, complete only]
// Rail width 52px gives the circle clearance from the label (Ellis's
// 2026-08-09 note that 40px felt cramped). Active row gets a soft coral
// tint background band spanning the row so the "you are here" reads
// immediately.
function TimelineRow({
  tile, index, isFirst, isLast, prevComplete,
}: {
  tile: OverviewTile;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** true when the tile ABOVE this one is complete — colours the top
   *  half of the rail green so completed steps chain visibly. */
  prevComplete: boolean;
}) {
  const isComplete = tile.status === "complete";
  const isActive   = tile.status === "active";
  const ringColor  = isComplete ? P.success : isActive ? P.primary : "rgba(15,23,42,0.25)";
  const iconColor  = isComplete ? P.success : isActive ? P.primary : P.textMuted;
  const labelColor = isActive ? P.primary : isComplete ? P.textPrimary : P.textSecondary;

  // Pill tone per state. Active is coral; complete is green; locked / pending
  // are grey. Rendered via the shared PortalPill (PILL-P3).
  const pillTone: PortalPillTone = isComplete ? "green" : isActive ? "coral" : "grey";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        minHeight: 64,
        // Coral tint band for the active row — subtle, so it doesn't
        // fight the pill. Full-bleed left/right via negative margin.
        background: isActive ? "rgba(255,107,74,0.05)" : "transparent",
        marginLeft: isActive ? -14 : 0,
        marginRight: isActive ? -14 : 0,
        paddingLeft: isActive ? 14 : 0,
        paddingRight: isActive ? 14 : 0,
        borderRadius: isActive ? 12 : 0,
      }}
    >
      {/* Left rail — line above / circle / line below. Rail width 52px
          gives the label breathing room. */}
      <div style={{ width: 52, position: "relative", flexShrink: 0 }}>
        {!isFirst && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: "50%",
              width: 2,
              marginLeft: -1,
              background: prevComplete ? P.success : "rgba(15,23,42,0.15)",
            }}
          />
        )}
        {!isLast && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              bottom: 0,
              width: 2,
              marginLeft: -1,
              background: isComplete ? P.success : "rgba(15,23,42,0.15)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 32,
            height: 32,
            borderRadius: 999,
            border: `2px solid ${ringColor}`,
            background: P.cardBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColor,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {tile.locked
            ? <Lock size={13} weight="regular" />
            : isComplete
              ? <Check size={14} weight="bold" />
              : index}
        </div>
      </div>

      {/* Right: label + description on the left, pill (+ optional date)
          on the far right, vertically centred. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "12px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: isActive ? 700 : 600,
              color: labelColor,
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
            }}
          >
            {tile.label}
          </p>
          {tile.description && (
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                color: P.textMuted,
                lineHeight: 1.35,
              }}
            >
              {tile.description}
            </p>
          )}
        </div>

        {/* Right: date label (complete rows only) above a pill. Stacked
            when both present so nothing overlaps on narrow widths. */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 3,
          flexShrink: 0,
        }}>
          {isComplete && tile.completedDate && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: P.textMuted,
              fontWeight: 500,
            }}>
              <Calendar size={11} weight="regular" />
              {tile.completedDate}
            </span>
          )}
          <PortalPill tone={pillTone}>{tile.text}</PortalPill>
        </div>
      </div>
    </div>
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
  progressHref,
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
      {/* -mt-5 cancels the pt-5 on <main> so the photo sits flush
          against the header, per Ellis's 2026-08-09 note. Only the
          Overview page uses this hero, so other pages keep their
          normal top spacing. */}
      <div
        className="-mx-4 -mt-5"
        style={{
          position: "relative",
          height: 380,
          overflow: "hidden",
          // Match the ambient-wash base (#f6f8fc) exactly so the photo's bottom
          // fade dissolves into the page with no visible seam (was P.pageBg,
          // #F8F9FB, which left a faint line where the hero ended).
          background: "#f6f8fc",
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
          /* No property photo: a soft line-art streetscape on the coral
             gradient that already dissolves to white at the foot, so it
             fades beautifully into the page (reinforced by the bottom-fade
             overlay below). */
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              backgroundImage: "url(/portal-hero-fallback.png)",
              backgroundSize: "cover",
              backgroundPosition: "center 35%",
            }}
          />
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
            height: "62%",
            pointerEvents: "none",
            background: "linear-gradient(180deg, transparent 0%, #f6f8fcCC 52%, #f6f8fc 100%)",
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
                  display: "flex", alignItems: "flex-start", gap: 6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {addressLine2}
              </p>
            )}

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              <PortalPill tone={statusMeta.tone} size="md">{statusMeta.label}</PortalPill>
              {tenureLabel && <PortalPill size="md">{tenureLabel}</PortalPill>}
              {purchaseTypeLabel && <PortalPill size="md">{purchaseTypeLabel}</PortalPill>}
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

      {/* ── Progress Overview ─────────────────────────────────────────
             Two layouts driven by the same tile data, swapped at the
             md breakpoint (768px):
             - Desktop: horizontal 6-tile strip with connectors between
             - Mobile:  vertical timeline (circles down a left rail,
                        label + status on the right). The horizontal
                        strip crams 6 tiles + labels + statuses into
                        <360px on phones — labels wrap to 3 lines and
                        it still looks broken. Vertical is the standard
                        mobile idiom for step-by-step progression
                        (DoorDash / GitHub / etc.). */}
      <PortalGlassCard glassId="progress-overview" label="Progress overview" style={{ padding: "16px 14px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          margin: "0 0 14px",
          paddingLeft: 4,
        }}>
          <p style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 700,
            color: P.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.10em",
          }}>
            Progress overview
          </p>
          {/* Shortcut to the milestone-by-milestone Progress tab. Same
              destination the bottom-nav "Progress" tab hits — this is
              just a contextual entry point from inside the summary. */}
          <Link
            href={progressHref}
            className="portal-chev"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              color: P.accent,
              background: P.accentBg,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            View full timeline
            <span className="portal-chev-i" style={{ display: "inline-flex" }}>
              <CaretRight size={11} weight="bold" />
            </span>
          </Link>
        </div>

        {/* Desktop — horizontal 6-tile strip (unchanged from before). */}
        <div className="hidden md:flex" style={{
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

        {/* Mobile — vertical timeline. */}
        <div className="md:hidden">
          {tiles.map((tile, i) => (
            <TimelineRow
              key={tile.key}
              tile={tile}
              index={i + 1}
              isFirst={i === 0}
              isLast={i === tiles.length - 1}
              prevComplete={i > 0 && tiles[i - 1].status === "complete"}
            />
          ))}
        </div>
      </PortalGlassCard>

      {/* ── Expected exchange + You're in good hands ────────────────── */}
      {predictedExchangeDate && (
        <PortalGlassCard glassId="expected-exchange" label="Expected exchange" style={{ overflow: "hidden" }}>
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
                  12-week target
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
        </PortalGlassCard>
      )}
    </div>
  );
}
