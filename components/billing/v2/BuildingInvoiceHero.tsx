"use client";

// components/billing/v2/BuildingInvoiceHero.tsx
//
// The v2 centrepiece. Same data shape as v1 BuildingInvoice but rehoused
// for the near-document environment: no card chrome, hero treatment on
// the period + total, and a felt-liveness signal (pulsing dot + "Updated
// just now / Ns ago" stamp) so the page reads as alive every time the
// director opens it — without polling the server.
//
// Count-up on the total (useCountUp respects reduced-motion via the
// data-rm contract). The live-pulse dot uses the existing
// agent-pulse-dot keyframe; reduced-motion is honoured globally on
// keyframe animations elsewhere in the system (see agent-system.css
// reduced-motion block).
//
// Liveness model: animate-on-mount + timestamp, NOT real polling.
// Exchanges happen a few times a month, so the underlying number is
// almost always static between visits. The count-up gives felt liveness
// every visit; the "Updated Ns ago" stamp keeps it honest. Easy upgrade
// to live polling later if ever needed.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { FilePdf, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Pill } from "@/components/ui/Pill";

type Line = {
  transactionId: string;
  exchangedAt: Date;
  address: string;
  serviceLabel: string;
  serviceSub?: string;
  totalPence: number;
  variant: "normal" | "trial" | "credit";
  /** File deep-link + popover data — present for real transaction rows only. */
  fileHref?: string;
  addedAt?: Date | null;
  photoUrl?: string | null;
};

// Shared column template for the invoice header + rows (mock layout).
const COLS = "88px minmax(0,1fr) minmax(0,210px) 96px";

function fmtFull(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Portal photo blend: fades the image / fallback to transparent at the foot so
// it dissolves into the white beneath, exactly as the client portal hero does.
const PHOTO_MASK = "linear-gradient(180deg, #000 0%, #000 40%, transparent 96%)";

// Clickable address → a small glassy card with the property photo, its added
// and exchange dates, and a "Go to file" deep-link. Rendered in a body portal
// so it sits above every card below. Rows without a fileHref (the synthetic
// credit line) render as plain text.
function AddressCell({
  address,
  fileHref,
  photoUrl,
  addedAt,
  exchangedAt,
}: {
  address: string;
  fileHref?: string;
  photoUrl?: string | null;
  addedAt?: Date | null;
  exchangedAt: Date;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const POP_W = 236;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Fixed-position popover would detach from the address on scroll/resize —
    // close it instead of chasing the anchor.
    const dismiss = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  if (!fileHref) {
    return <span style={{ fontSize: 15, color: "#111827", lineHeight: 1.35 }}>{address}</span>;
  }

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(12, Math.min(r.left, window.innerWidth - POP_W - 12));
      setCoords({ top: r.bottom + 8, left });
    }
    setOpen(true);
  };

  return (
    <span style={{ display: "inline-block", maxWidth: "100%" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="account-addr-btn"
        aria-expanded={open}
        style={{
          fontSize: 15,
          color: "#111827",
          lineHeight: 1.35,
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          transition: "color 140ms",
        }}
      >
        {address}
      </button>

      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="account-addr-pop"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              zIndex: 1000,
              width: POP_W,
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(16px) saturate(160%)",
              WebkitBackdropFilter: "blur(16px) saturate(160%)",
              border: "0.5px solid rgba(255,255,255,0.65)",
              boxShadow: "0 16px 44px rgba(20,14,10,0.20), 0 2px 8px rgba(20,14,10,0.08)",
            }}
          >
            {/* Photo zone — image or the client-portal fallback streetscape,
                both fading into the white content beneath via PHOTO_MASK. */}
            <div style={{ position: "relative", height: 122 }}>
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                    WebkitMaskImage: PHOTO_MASK, maskImage: PHOTO_MASK,
                  }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0,
                    backgroundImage: "var(--portal-hero-fallback, url(/portal-hero-fallback.webp))",
                    backgroundSize: "cover",
                    backgroundPosition: "center 35%",
                    WebkitMaskImage: PHOTO_MASK, maskImage: PHOTO_MASK,
                  }}
                />
              )}
            </div>

            <div style={{ padding: "0 14px 14px", marginTop: -12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#9ca3af", fontWeight: 600 }}>Added</span>
                <span style={{ fontSize: 13, color: "#111827" }}>{addedAt ? fmtFull(addedAt) : "—"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#9ca3af", fontWeight: 600 }}>Exchange</span>
                <span style={{ fontSize: 13, color: "#111827" }}>{fmtFull(exchangedAt)}</span>
              </div>
              <a
                href={fileHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--agent-coral-deep, #E2452A)",
                  textDecoration: "none",
                  marginTop: 2,
                }}
                className="account-addr-gofile"
              >
                Go to file
                <ArrowRight size={13} weight="bold" />
              </a>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

export type BuildingInvoiceHeroProps = {
  periodLabel: string;
  lines: Line[];
  subtotalPence: number;
  creditsAppliedPence: number;
  totalPence: number;
  hidePreviewButton?: boolean;
};

function fmt(p: number): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const s = `£${(abs / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return neg ? `−${s}` : s;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function useLiveTimestamp(): string {
  const [tick, setTick] = useState(0);
  const [mountedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  void tick;
  const elapsed = Math.floor((Date.now() - mountedAt) / 1000);
  if (elapsed < 5) return "Updated just now";
  if (elapsed < 60) return `Updated ${elapsed}s ago`;
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `Updated ${hrs}h ago`;
}

export function BuildingInvoiceHero(props: BuildingInvoiceHeroProps) {
  const displayTotal = useCountUp(props.totalPence, { duration: 900 });
  const liveStamp = useLiveTimestamp();
  const hasLines = props.lines.length > 0;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        padding: "12px 0 0",
      }}
    >
      {/* Eyebrow row — period + building badge + live stamp + preview button */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: 0.7,
              fontWeight: 500,
            }}
          >
            Current invoice
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 600,
                color: "#111827",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {props.periodLabel}
            </h1>
            <Pill tone="warning" glass>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--agent-warning)",
                  animation: "agent-pulse-dot 1.6s ease-in-out infinite",
                }}
              />
              Building
            </Pill>
          </div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: "#9ca3af" }}>{liveStamp}</div>
        </div>
        {hasLines && !props.hidePreviewButton && (
          <a
            href="/api/billing/invoice-pdf/preview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              color: "#374151",
              textDecoration: "none",
              border: "0.5px solid rgba(0,0,0,0.18)",
              borderRadius: 8,
              background: "#fff",
              transition: "background 150ms, border-color 150ms",
            }}
            className="hover:bg-black/[0.03]"
          >
            <FilePdf size={14} weight="regular" />
            Preview PDF
          </a>
        )}
      </div>

      {/* Body — lines or empty state */}
      {!hasLines ? (
        <div
          style={{
            padding: "36px 16px",
            textAlign: "center",
            color: "#6b7280",
            border: "1px dashed rgba(0,0,0,0.10)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
            No exchanges yet this month
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Fees appear here the moment a file exchanges.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 16,
              padding: "0 4px 10px",
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.7,
              color: "#9ca3af",
              borderBottom: "0.5px solid rgba(0,0,0,0.14)",
            }}
          >
            <div>Date</div>
            <div>File</div>
            <div>Service</div>
            <div style={{ textAlign: "right" }}>Fee</div>
          </div>
          {props.lines.map((l) => (
            <div
              key={l.transactionId + l.variant}
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 16,
                padding: "18px 4px",
                borderBottom: "0.5px solid rgba(0,0,0,0.06)",
                alignItems: "start",
              }}
            >
              <div style={{ color: "#9ca3af", fontSize: 13.5 }}>{fmtDate(l.exchangedAt)}</div>
              <AddressCell
                address={l.address}
                fileHref={l.fileHref}
                photoUrl={l.photoUrl}
                addedAt={l.addedAt}
                exchangedAt={l.exchangedAt}
              />
              <div>
                <div style={{ fontSize: 14.5, color: "#111827" }}>{l.serviceLabel}</div>
                {l.serviceSub && (
                  <div style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 2 }}>{l.serviceSub}</div>
                )}
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 16.5,
                  fontWeight: 600,
                  color:
                    l.variant === "credit"
                      ? "#047857"
                      : l.variant === "trial"
                      ? "#9ca3af"
                      : "#111827",
                }}
              >
                {l.variant === "trial" ? "Free" : fmt(l.totalPence)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hero totals */}
      {hasLines && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          <div style={{ minWidth: 280, display: "flex", flexDirection: "column", gap: 6 }}>
            {props.creditsAppliedPence > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  <span>Subtotal</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {/* Sum of gross line fees before credits — computed from
                        totalPence + creditsAppliedPence so the math reads
                        regardless of VAT-on/off (props.subtotalPence is the
                        dormant ex-VAT amount on VAT-on agencies). */}
                    {fmt(props.totalPence + props.creditsAppliedPence)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "#047857",
                  }}
                >
                  <span>Pending credit</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    −{fmt(props.creditsAppliedPence)}
                  </span>
                </div>
              </>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                paddingTop: 10,
                marginTop: 8,
                borderTop: "0.5px solid rgba(0,0,0,0.18)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Total</span>
              <span
                style={{
                  fontSize: 29,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  fontVariantNumeric: "tabular-nums",
                  color: "#111827",
                  lineHeight: 1.05,
                }}
              >
                {fmt(displayTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .account-addr-btn:hover { color: var(--agent-coral-deep, #E2452A) !important; }
        .account-addr-gofile:hover { text-decoration: underline; }
        .account-addr-pop { animation: account-addr-pop-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes account-addr-pop-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) { .account-addr-pop { animation: none; } }
      `}</style>
    </section>
  );
}
