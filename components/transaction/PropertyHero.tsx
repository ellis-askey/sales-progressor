"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { TransactionStatus, Tenure, PurchaseType, ServiceType } from "@prisma/client";
import { HouseSimple, CurrencyGbp, UserCircle, CalendarBlank, Clock, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { StatusControl } from "./StatusControl";
import { SwitchServiceTypeModal } from "./SwitchServiceTypeModal";
import { HeroSaleFields } from "./HeroSaleFields";
import { HeroExchangeCell } from "./HeroExchangeCell";
import { HeroAddressEdit } from "./HeroAddressEdit";
import { usePropertyPhoto, AddPhotoCircle } from "./HeroPhotoUpload";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";

type Props = {
  address: string;
  agencyName: string;
  status: TransactionStatus;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  purchasePrice: number | null;
  exchangeDate: Date | null;
  percent: number;
  onTrack: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
  serviceType?: ServiceType | null;
  backHref?: string;
  flagSlot?: React.ReactNode;
  // Phase 1 commit 8 — slot for the round chip (alongside status +
  // service-type badges in the hero's badge row). Rendered as-is so
  // PropertyHero stays unaware of round semantics.
  roundChipSlot?: React.ReactNode;
  // Enquiries "whose court" chip (enquiries rework). Rendered as-is in the
  // meta row so the hero stays unaware of enquiry semantics; the section
  // returns null when there's no live enquiries activity.
  enquiryChipSlot?: React.ReactNode;
  assignedUserName?: string | null;
  assignedUserImage?: string | null;
  createdAt?: Date | string | null;
  transactionId?: string;
  hideServiceTypeBadge?: boolean;
  /** Pass-through to StatusControl so the withdraw success toast can tail
   *  " chain notified" only when the transaction is actually chain-linked. */
  inChain?: boolean;
  /** When true, the service-type pill becomes an interactive control that
   *  reveals a swap icon on hover and opens a confirm-and-switch modal.
   *  Set from the page-level `hasAdminPowers(session)` check. */
  isAdminViewer?: boolean;
  // 2026-08-08 hero redesign — signed URL for the property photo
  // (PropertyTransaction.photoStoragePath, signed server-side on read).
  // Null when no photo uploaded; the hero renders a coral gradient +
  // house glyph fallback in the same slot.
  photoUrl?: string | null;
  // Manual predicted-exchange override. The hero's "Expected exchange"
  // stat prefers this over exchangeDate, matching the old stats strip.
  overridePredictedDate?: Date | string | null;
  // Role-gated header controls (AI summary, portal-emails toggle) built
  // at the page level and floated in the hero's top-right corner.
  topRightSlot?: React.ReactNode;
  // True once the file has exchanged. Locks inline purchase-type / tenure
  // edits (the NR cascade could reverse completed post-exchange steps);
  // price stays editable.
  exchanged?: boolean;
  // Share of freehold — surfaced as a third option in the hero's tenure picker.
  isShareOfFreehold?: boolean;
};

const DARK_STATUS: Record<TransactionStatus, { bg: string; dot: string; label: string }> = {
  draft:     { bg: "bg-slate-500/15 text-slate-300 ring-slate-400/30",       dot: "bg-slate-400",   label: "Draft" },
  active:    { bg: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400", label: "Active" },
  on_hold:   { bg: "bg-amber-500/15 text-amber-300 ring-amber-400/30",       dot: "bg-amber-400",   label: "On hold" },
  completed: { bg: "bg-blue-500/15 text-blue-300 ring-blue-400/30",          dot: "bg-blue-400",    label: "Completed" },
  withdrawn: { bg: "bg-gray-500/15 text-gray-400 ring-gray-400/30",          dot: "bg-gray-400",    label: "Withdrawn" },
};

const STATUS_PILL: Record<TransactionStatus, string> = {
  draft:     "",
  active:    "agent-pill-active",
  on_hold:   "agent-pill-hold",
  completed: "agent-pill-completed",
  withdrawn: "agent-pill-withdrawn",
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  draft: "Draft", active: "Active", on_hold: "On hold", completed: "Completed", withdrawn: "Withdrawn",
};

const TRACK_BAR: Record<string, string> = {
  on_track:  "bg-emerald-500",
  at_risk:   "bg-amber-400",
  off_track: "bg-red-500",
  unknown:   "bg-blue-400",
  on_hold:   "bg-slate-300", // neutral grey  file is frozen, no track signal
};

const TRACK_PILL: Record<string, { label: string; color: string; bg: string }> = {
  on_track:  { label: "On track",   color: "#047857", bg: "rgba(16, 185, 129, 0.14)" },
  at_risk:   { label: "At risk",    color: "#b45309", bg: "rgba(245, 158, 11, 0.14)" },
  off_track: { label: "Off track",  color: "#b91c1c", bg: "rgba(220, 38, 38, 0.14)"  },
  unknown:   { label: "Just started", color: "#1d4ed8", bg: "rgba(59, 130, 246, 0.12)" },
  on_hold:   { label: "On hold",    color: "#475569", bg: "rgba(100, 116, 139, 0.14)" },
};

function formatPrice(pence: number | null): string | null {
  if (!pence) return null;
  return "£" + (pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatTenure(t: Tenure): string {
  return t === "leasehold" ? "Leasehold" : "Freehold";
}

function formatPurchaseType(p: PurchaseType): string {
  return { mortgage: "Mortgage", cash_buyer: "Cash buyer", cash_from_proceeds: "Cash from Proceeds" }[p] ?? p;
}

function formatElapsed(from: Date): string {
  const now = new Date();
  const days = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86400000));
  const weeks = Math.floor(days / 7);
  const remDays = days - weeks * 7;
  if (weeks === 0) {
    if (days === 0) return "Landed today";
    return days === 1 ? "1 day elapsed" : `${days} days elapsed`;
  }
  const weekLabel = weeks === 1 ? "1 week" : `${weeks} weeks`;
  if (remDays === 0) return `${weekLabel} elapsed`;
  const dayLabel = remDays === 1 ? "1 day" : `${remDays} days`;
  return `${weekLabel} ${dayLabel} elapsed`;
}

// Inline progress bar for the hero — replaces the old ring (2026-08-08
// redesign). Animated fill on mount (900ms, matches the ring's sweep),
// honours prefers-reduced-motion.
function HeroProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const prefersRM = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(prefersRM);
    if (prefersRM) {
      setWidth(clamped);
      return;
    }
    const t = setTimeout(() => setWidth(clamped), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: "100%" }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--agent-text-muted)", textAlign: "right" }}>
        <span style={{
          fontWeight: 700,
          color: "var(--agent-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}>{clamped}%</span>{" "}
        complete
      </p>
      <div style={{ height: 5, borderRadius: 999, background: "var(--agent-hero-track)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          borderRadius: 999,
          background: "var(--agent-coral)",
          width: `${Math.max(width, clamped > 0 ? 2 : 0)}%`,
          transition: reduced ? "none" : "width 900ms cubic-bezier(0.4, 0, 0.2, 1)",
        }} />
      </div>
    </div>
  );
}

// Stat cell for the hero's merged stat row (absorbs the old Zone-2
// TransactionStatsStrip — sale price / purchase type / tenure / expected
// exchange now live inside the hero).
function HeroStatCell({
  Icon, label, value, sensitive,
}: {
  Icon: typeof CurrencyGbp;
  label: string;
  value: string;
  sensitive?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
      <span style={{
        width: 32,
        height: 32,
        color: "var(--agent-coral-deep)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={20} weight="regular" />
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          data-sensitive={sensitive ? "true" : undefined}
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--agent-text-primary)",
            letterSpacing: "-0.01em",
            lineHeight: 1.25,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >{value}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>
          {label}
        </span>
      </span>
    </div>
  );
}

export function PropertyHero({
  address, agencyName, status, tenure, purchaseType, purchasePrice, exchangeDate, percent, onTrack, serviceType, backHref = "/dashboard", flagSlot, roundChipSlot, enquiryChipSlot, assignedUserName, assignedUserImage = null, createdAt, transactionId, hideServiceTypeBadge = false, inChain = false, isAdminViewer = false, photoUrl = null, overridePredictedDate = null, topRightSlot, exchanged = false, isShareOfFreehold = false,
}: Props) {
  const [line1, ...rest] = address.split(",");
  const line2 = rest.join(",").trim();
  const barColor = TRACK_BAR[onTrack];
  const days = exchangeDate ? daysUntil(new Date(exchangeDate)) : null;
  const price = formatPrice(purchasePrice);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  // Property-photo controller — called unconditionally (rules of hooks). Only
  // the agent hero below renders its controls; the dark progressor hero and
  // the no-transaction help preview ignore it.
  const photo = usePropertyPhoto(transactionId ?? "", photoUrl);
  const canSwitchService = isAdminViewer && !!transactionId && !!serviceType && !hideServiceTypeBadge;
  const isAgent = backHref === "/agent/transactions" || backHref === "/agent/dashboard";

  if (isAgent) {
    // ─────────────────────────────────────────────────────────────────
    // Agent path (light warm cream + coral).
    // 2026-08-08 hero redesign (founder mock): property photo fills the
    // left of an elevated card and fades into the surface; content
    // column on the right carries status + progress bar, big address,
    // a 4-cell stat row (absorbs the old Zone-2 stats strip: price /
    // purchase type / tenure / expected exchange), then a meta row
    // (managing agent, file age + added date, service-type pill, round
    // chip). Role-gated header controls float top-right via
    // topRightSlot. No photo → coral gradient + house glyph fallback
    // in the same slot.
    // ─────────────────────────────────────────────────────────────────
    const elapsedText = createdAt ? formatElapsed(new Date(createdAt)) : null;
    const exchangeStat = overridePredictedDate ?? exchangeDate;
    const initials = assignedUserName
      ? assignedUserName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
      : null;

    // Service-type pill — same behaviour as before the redesign: static
    // label for most users; admins get the hover-swap control that opens
    // the confirm-and-switch modal.
    const servicePill = !hideServiceTypeBadge && serviceType && (() => {
      const isSelf = serviceType === "self_managed";
      const label = isSelf ? "Self-managed" : "With progressor";
      const baseStyle: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 600,
        // "With progressor" was light coral on a faint coral tint — near-
        // invisible on the light hero. Deeper coral + stronger tint + a
        // hairline border give it real contrast.
        color: isSelf ? "var(--agent-text-secondary)" : "var(--agent-coral-deep)",
        background: isSelf ? "var(--agent-surface-overlay)" : "rgba(var(--agent-coral-rgb), 0.16)",
        border: isSelf ? "1px solid transparent" : "1px solid rgba(var(--agent-coral-rgb), 0.30)",
        borderRadius: 999,
        padding: "4px 10px",
        whiteSpace: "nowrap",
      };
      if (!canSwitchService) {
        return <span style={baseStyle}>{label}</span>;
      }
      return (
        <button
          type="button"
          onClick={() => setSwitchModalOpen(true)}
          title={isSelf ? "Switch to outsourced" : "Switch to self-progress"}
          className="v2-swap-btn"
          style={{
            ...baseStyle,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            fontFamily: "inherit",
          }}
        >
          {label}
          {/* Arrow collapses to 0-width at rest via .v2-swap-arrow (CSS in
              agent-system.css). Expands + rotates on hover so the pill
              sizes to just the label unless the user hovers. */}
          <span className="v2-swap-arrow" aria-hidden>⇄</span>
        </button>
      );
    })();

    // Property photo (2026-08-21, animated). Empty state: a narrow left zone
    // holding the hollow add-circle, so the content sits further left. Adding a
    // photo widens the zone 168px -> 380px (flex-basis transition) — the
    // content column reflows rightward as one motion — while the photo fills
    // the zone (width 100%) and fades in; the circle fades out. The photo width
    // tracks the zone so the soft right-edge fade always lands at the visible
    // edge (a fixed 380px width used to be clipped by the fluid zone, cutting
    // the fade short and making the photo look hard-edged at 100% zoom).
    // Removing runs the exact reverse. displayUrl lags hasPhoto so the photo
    // can wipe out before its <img> unmounts.
    const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
    const photoColumnDesktop = transactionId ? (
      <div className="hidden md:block" style={{
        position: "relative",
        flexGrow: 0,
        flexShrink: 1,
        flexBasis: photo.hasPhoto ? 380 : 168,
        minWidth: photo.hasPhoto ? 240 : 168,
        alignSelf: "stretch",
        overflow: "hidden",
        transition: `flex-basis 560ms ${EASE}, min-width 560ms ${EASE}`,
      }}>
        {photo.displayUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.displayUrl} alt="" style={{
            position: "absolute", left: 0, top: 0, height: "100%", width: "100%",
            objectFit: "cover",
            opacity: photo.hasPhoto ? 1 : 0,
            maskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to right, #000 55%, transparent 100%)",
            transition: `opacity 560ms ${EASE}`,
            pointerEvents: "none",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: photo.hasPhoto ? 0 : 1,
          pointerEvents: photo.hasPhoto ? "none" : "auto",
          transition: "opacity 300ms ease",
        }}>
          <AddPhotoCircle onClick={photo.triggerUpload} busy={photo.busy} size={120} />
        </div>
      </div>
    ) : null;

    const photoLayerMobile = transactionId ? (
      <div className="md:hidden" style={{
        position: "relative", overflow: "hidden",
        height: photo.hasPhoto ? 148 : 132,
        transition: `height 460ms ${EASE}`,
      }}>
        {photo.displayUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.displayUrl} alt="" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            opacity: photo.hasPhoto ? 1 : 0,
            maskImage: "linear-gradient(to bottom, #000 50%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 50%, transparent 100%)",
            transition: `opacity 460ms ${EASE}`,
            pointerEvents: "none",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: photo.hasPhoto ? 0 : 1,
          pointerEvents: photo.hasPhoto ? "none" : "auto",
          transition: "opacity 300ms ease",
        }}>
          <AddPhotoCircle onClick={photo.triggerUpload} busy={photo.busy} size={100} />
        </div>
      </div>
    ) : null;

    return (
      // Design Lab: `property-hero`. Default v27 (Classic frost bar,
      // Bespoke family) per Ellis's final pick set, 2026-08-08 evening
      // pass. Ellis's DB pick still overrides this.
      <GlassCard glassId="property-hero" label="Property hero" defaultVariant="v27" className="animate-enter" style={{
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
      }}>
        {/* Mobile photo strip (or the add-photo circle when empty) — stacks
            above the content. */}
        {photoLayerMobile}

        {/* Desktop card body: flex row — photo column (full-bleed photo or
            the add circle) on the left, content column takes the rest. */}
        <div className="md:flex" style={{ position: "relative" }}>
          {photoColumnDesktop}

          {/* Content column: takes all remaining space; minWidth: 0 lets
              its children (h1, stat labels) shrink honourably rather than
              refusing to fit and blowing out the flex layout. */}
          <div style={{
            flex: "1 1 auto",
            minWidth: 0,
            position: "relative",
            zIndex: 1,
            padding: "18px 22px 20px",
          }}>
          {/* Status + progress row. Top padding on desktop clears the
              floating top-right controls. */}
          <div className="md:pt-8" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}>
            {transactionId
              ? <StatusControl transactionId={transactionId} currentStatus={status} inChain={inChain} />
              : <span className={`agent-pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
            }
            <div style={{ flex: "1 1 180px", maxWidth: 280, minWidth: 150 }}>
              <HeroProgressBar percent={percent} />
            </div>
          </div>

          {/* Address — inline-editable when we have a transaction id */}
          {transactionId ? (
            <HeroAddressEdit transactionId={transactionId} address={address} />
          ) : (
            <>
              <h1
                data-sensitive="true"
                style={{
                  fontSize: "clamp(26px, 3.2vw, 40px)",
                  fontWeight: 700,
                  color: "var(--agent-text-primary)",
                  margin: "14px 0 0",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.12,
                }}
              >
                {line1}
              </h1>
              {line2 && (
                <p
                  data-sensitive="true"
                  style={{
                    margin: "6px 0 0",
                    fontSize: 15,
                    color: "var(--agent-text-muted)",
                    lineHeight: 1.35,
                  }}
                >
                  {line2}
                </p>
              )}
            </>
          )}

          {/* Stat row — absorbs the old Zone-2 stats strip.
              Desktop: flex-wrap with auto-sized cells. Each cell takes
              exactly the width its content needs (icon + label + value);
              cells wrap to a second row if the container gets too narrow.
              This replaces the equal-grid approach — no cell can dominate
              and truncate its neighbours; long values like
              "Cash from Proceeds" or "21 Oct 2026" render in full.
              Mobile: 2-col grid keeps the compact symmetrical layout. */}
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-4 md:flex md:flex-wrap md:gap-x-6"
            style={{ marginTop: 20 }}
          >
            {transactionId ? (
              <HeroSaleFields
                transactionId={transactionId}
                purchasePrice={purchasePrice ?? null}
                purchaseType={purchaseType ?? null}
                tenure={tenure ?? null}
                isShareOfFreehold={isShareOfFreehold}
                exchanged={exchanged}
              />
            ) : (
              <>
                <HeroStatCell Icon={CurrencyGbp} label="Sale price" value={price ?? "–"} sensitive />
                <HeroStatCell Icon={UserCircle} label="Purchase type" value={purchaseType ? formatPurchaseType(purchaseType) : "–"} />
                <HeroStatCell Icon={HouseSimple} label="Tenure" value={tenure ? formatTenure(tenure) : "–"} />
              </>
            )}
            {transactionId ? (
              <HeroExchangeCell
                transactionId={transactionId}
                predictedDate={exchangeDate ?? null}
                overrideDate={overridePredictedDate ? new Date(overridePredictedDate) : null}
              />
            ) : (
              <HeroStatCell
                Icon={CalendarBlank}
                label="Expected exchange"
                value={exchangeStat
                  ? new Date(exchangeStat).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "–"}
              />
            )}
          </div>

          {/* Meta row — managing agent, file age, service pill, round
              chip. Divided from the stats by a hairline. */}
          <div style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "0.5px solid var(--agent-border-default)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}>
            {/* "Managing this file" row.
                - With a name: coral avatar + name + subtitle.
                - Without: muted "?" chip + "Not assigned yet" as the
                  primary line, with "Managing this file" underneath as
                  the subtitle so the layout stays consistent.
                Selection logic lives in the page (service-type-aware) —
                the hero just renders whatever it's given. */}
            {assignedUserName ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span aria-hidden style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "rgba(var(--agent-coral-rgb), 0.14)",
                  color: "var(--agent-coral-deep)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  overflow: "hidden",
                }}>
                  {assignedUserImage
                    ? <img src={assignedUserImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : initials}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>
                    {assignedUserName}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>
                    Managing this file
                  </span>
                </span>
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span aria-hidden style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "var(--agent-surface-overlay)",
                  color: "var(--agent-text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 500,
                  flexShrink: 0,
                  fontStyle: "italic",
                }}>?</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)", lineHeight: 1.25 }}>
                    Not assigned yet
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>
                    Managing this file
                  </span>
                </span>
              </span>
            )}
            {elapsedText && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span aria-hidden style={{
                  width: 32,
                  height: 32,
                  color: "var(--agent-text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}><Clock size={19} /></span>
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>
                    {elapsedText.replace(" elapsed", "")}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>
                    {createdAt ? `Added ${formatDate(createdAt)}` : "File age"}
                  </span>
                </span>
              </span>
            )}
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {enquiryChipSlot}
              {servicePill}
              {roundChipSlot}
            </span>
          </div>

          {flagSlot}
          </div>
        </div>

        {/* Back link — floats over the photo corner. Glass pill so it
            stays readable over any photo; darker treatment when a real
            photo is behind it. Positioned absolute against the outer
            card (which is position: relative), so its position is
            unaffected by the flex-row split above. */}
        <Link
          href={backHref}
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            zIndex: 2,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: 999,
            color: photo.hasPhoto ? "#fff" : "var(--agent-text-secondary)",
            background: photo.hasPhoto ? "rgba(15,23,42,0.38)" : "var(--agent-surface-overlay)",
            backdropFilter: photo.hasPhoto ? "blur(8px)" : undefined,
            WebkitBackdropFilter: photo.hasPhoto ? "blur(8px)" : undefined,
            transition: "color 400ms ease, background 400ms ease",
          }}
        >
          <ArrowLeft size={13} weight="bold" />
          Back to files
        </Link>

        {/* Hidden file input — shared by the desktop + mobile add circles. */}
        {transactionId && (
          <input
            ref={photo.inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={photo.onFile}
            style={{ display: "none" }}
          />
        )}

        {/* Remove-photo pill — bottom-left of the card, over the photo. Fades
            in (delayed, after the zone widens) when a photo is set; fades out
            quickly when removing. */}
        {transactionId && (
          <button
            type="button"
            onClick={photo.remove}
            disabled={photo.busy || !photo.hasPhoto}
            aria-hidden={!photo.hasPhoto}
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              zIndex: 2,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              cursor: photo.busy ? "wait" : "pointer",
              color: "#fff",
              background: "rgba(15,23,42,0.42)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontFamily: "inherit",
              opacity: photo.hasPhoto ? 1 : 0,
              pointerEvents: photo.hasPhoto ? "auto" : "none",
              transition: photo.hasPhoto ? "opacity 360ms ease 240ms" : "opacity 220ms ease",
            }}
          >
            <Trash size={13} weight="regular" />
            Remove photo
          </button>
        )}

        {/* Role-gated header controls (AI summary + portal emails) —
            top-right, on a soft glass strip so they read over photo or
            surface alike. Hidden when the page passes nothing. */}
        {topRightSlot && (
          <div className="agent-hero-topright" style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            {topRightSlot}
          </div>
        )}

        {/* Single-instance service-type switch modal. */}
        {canSwitchService && transactionId && serviceType && (
          <SwitchServiceTypeModal
            open={switchModalOpen}
            transactionId={transactionId}
            current={serviceType}
            onClose={() => setSwitchModalOpen(false)}
          />
        )}
      </GlassCard>
    );
  }

  // Dark (progressor) version — unchanged
  const statusStyle = DARK_STATUS[status];
  return (
    <div className="glass-panel-dark relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.045,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "80px 60px",
        }}
      />
      <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 65%)" }} />
      <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)" }} />

      <div className="relative px-8 pt-6 pb-8 animate-enter">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Dashboard
            </Link>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-xs text-slate-500 font-medium">{agencyName}</span>
          </div>
          <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${statusStyle.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label}
          </span>
        </div>

        <div className="mb-5">
          <h1 data-sensitive="true" className="text-[2.125rem] font-bold text-white leading-tight tracking-tight">{line1}</h1>
          {line2 && <p data-sensitive="true" className="text-sm text-slate-400 mt-1 font-medium">{line2}</p>}
        </div>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            {price && <p data-sensitive="true" className="text-xl font-bold text-white tracking-tight mb-2.5">{price}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {tenure && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/12 text-slate-200 ring-1 ring-white/25">
                  {formatTenure(tenure)}
                </span>
              )}
              {purchaseType && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/12 text-slate-200 ring-1 ring-white/25">
                  {formatPurchaseType(purchaseType)}
                </span>
              )}
              {!hideServiceTypeBadge && serviceType === "outsourced" && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30">
                  Outsourced to us
                </span>
              )}
              {!hideServiceTypeBadge && serviceType === "self_managed" && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                  Self-managed
                </span>
              )}
            </div>
          </div>

          <div className="flex items-end gap-6">
            {days !== null && (
              <div className="text-right">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Exchange</p>
                <p className={`text-base font-bold tabular-nums ${
                  days < 0 ? "text-red-400" : days <= 14 ? "text-amber-400" : "text-slate-100"
                }`}>
                  {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                </p>
              </div>
            )}
            <div className="min-w-[140px]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Progress</p>
                <p className="text-sm font-bold text-white tabular-nums">{percent}%</p>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

