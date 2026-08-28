"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { S } from "./ui";

// Mirrors the client portal's Progress page: your own side and the other side as
// two swipeable panels with a toggle pill on top (identical interaction to the
// client's PortalMilestoneList — sliding indicator, scroll-snap, settle-to-panel,
// height-matched to the active side). Read-only on both sides here; confirming
// lives in Open Updates. Other side shows label + tick only, no dates (A2).

// Measure before paint on the client; plain effect on the server (no warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type MRow = { code: string; label: string; labelOther: string; isComplete: boolean; isNotRequired: boolean; date: string | null };

const GROUPS: Record<"vendor" | "purchaser", { label: string; codes: string[] }[]> = {
  vendor: [
    { label: "Onboarding", codes: ["VM1", "VM2", "VM3", "VM4"] },
    { label: "Contract preparation", codes: ["VM5", "VM6", "VM7", "VM8", "VM9"] },
    { label: "Enquiries", codes: ["VM10", "VM21"] },
    { label: "Ready to exchange", codes: ["VM16", "VM17", "VM18"] },
    { label: "After exchange", codes: ["VM19", "VM20"] },
  ],
  purchaser: [
    { label: "Onboarding", codes: ["PM1", "PM2", "PM3", "PM4"] },
    { label: "Mortgage", codes: ["PM5", "PM6", "PM11"] },
    { label: "Survey", codes: ["PM9", "PM10"] },
    { label: "Searches & legal", codes: ["PM7", "PM8", "PM12", "PM13"] },
    { label: "Enquiries", codes: ["PM14", "PM20", "PM21"] },
    { label: "Ready to exchange", codes: ["PM22", "PM23", "PM24", "PM25"] },
    { label: "After exchange", codes: ["PM26", "PM27"] },
  ],
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function ProgressMirror({ side, ownRows, otherRows }: { side: "vendor" | "purchaser"; ownRows: MRow[]; otherRows: MRow[] }) {
  const otherSide = side === "vendor" ? "purchaser" : "vendor";
  const ownByCode = new Map(ownRows.map((r) => [r.code, r]));
  const otherByCode = new Map(otherRows.map((r) => [r.code, r]));

  const hasOther = otherRows.length > 0;
  const panelKeys: string[] = ["own", ...(hasOther ? ["other"] : [])];
  const nPanels = panelKeys.length;
  const indexOfKey = (k: string) => Math.max(0, panelKeys.indexOf(k));

  const ownLabel = "Your side";
  const otherLabel = otherSide === "purchaser" ? "The buyer's side" : "The seller's side";
  const labelForKey = (k: string) => (k === "own" ? ownLabel : otherLabel);

  const [activeSide, setActiveSide] = useState<string>("own");
  const swipeRef = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);

  function scrollToSide(s: string) {
    setActiveSide(s);
    const el = swipeRef.current;
    if (el) el.scrollTo({ left: indexOfKey(s) * el.clientWidth, behavior: "smooth" });
  }

  function onSwipeScroll() {
    const el = swipeRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const next = panelKeys[Math.min(Math.max(idx, 0), nPanels - 1)] ?? "own";
    setActiveSide((prev) => (prev === next ? prev : next));
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const e2 = swipeRef.current;
      if (!e2) return;
      const target = indexOfKey(next) * e2.clientWidth;
      if (Math.abs(e2.scrollLeft - target) > 2) e2.scrollTo({ left: target, behavior: "smooth" });
    }, 140);
  }

  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  // Height-match the row to the active panel (a shorter side shouldn't inherit
  // the taller one's height). Re-measures on swipe + on content change.
  useIsoLayoutEffect(() => {
    const el = panelRefs.current[activeSide];
    if (!el) return;
    const measure = () => setPanelHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSide, nPanels]);

  const frostCard: React.CSSProperties = {
    background: S.cardFrostBg,
    backdropFilter: S.cardFrostBlur,
    WebkitBackdropFilter: S.cardFrostBlur,
    border: `1px solid ${S.cardFrostBorder}`,
    borderRadius: S.radiusMd,
    boxShadow: S.shadowCard,
  };

  return (
    <>
      {nPanels > 1 && (
        <div style={{ position: "relative", display: "flex", padding: 4, borderRadius: 999, background: "rgba(15,39,64,0.06)", marginBottom: 12 }}>
          <div
            aria-hidden
            style={{
              position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${nPanels})`,
              borderRadius: 999, background: "#ffffff", boxShadow: "0 1px 2px rgba(15,39,64,0.14)",
              transform: `translateX(${indexOfKey(activeSide) * 100}%)`,
              transition: "transform 440ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
          {panelKeys.map((key) => {
            const on = activeSide === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => scrollToSide(key)}
                style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, border: 0, background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 10px", color: on ? S.ink : S.muted, transition: "color 200ms ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {labelForKey(key)}
              </button>
            );
          })}
        </div>
      )}

      {/* Bleed to the shell's 14px inset so each panel fills the width — no peek
          of the other side; cards realign via paddingInline. */}
      <div
        ref={swipeRef}
        onScroll={onSwipeScroll}
        className="scrollbar-hide"
        style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", marginInline: -14, paddingBlock: 4, boxSizing: "content-box", height: panelHeight, transition: "height 320ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Own side */}
        <div ref={(el) => { panelRefs.current.own = el; }} style={{ flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "start", scrollSnapStop: "always", paddingInline: 14 }}>
          <div style={{ ...frostCard, padding: "6px 4px" }}>
            {GROUPS[side].map((g) => {
              const rows = g.codes.map((c) => ownByCode.get(c)).filter((r): r is MRow => !!r && !r.isNotRequired);
              if (!rows.length) return null;
              return <Group key={g.label} label={g.label} rows={rows} viewOnly={false} />;
            })}
          </div>
        </div>

        {/* Other side — view only */}
        {hasOther && (
          <div ref={(el) => { panelRefs.current.other = el; }} style={{ flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "start", scrollSnapStop: "always", paddingInline: 14 }}>
            <div style={{ ...frostCard, padding: "16px 18px 6px", borderLeft: `3px solid ${S.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: S.muted }}>{otherLabel}</p>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: S.muted, background: "rgba(15,39,64,0.05)", borderRadius: 999, padding: "1px 8px" }}>View only</span>
              </div>
              {GROUPS[otherSide].map((g) => {
                const rows = g.codes.map((c) => otherByCode.get(c)).filter((r): r is MRow => !!r && !r.isNotRequired);
                if (!rows.length) return null;
                return <Group key={g.label} label={g.label} rows={rows} viewOnly />;
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Group({ label, rows, viewOnly }: { label: string; rows: MRow[]; viewOnly: boolean }) {
  const doneCount = rows.filter((r) => r.isComplete).length;
  const allDone = doneCount === rows.length;
  const [open, setOpen] = useState(!allDone);

  return (
    <div style={{ borderTop: viewOnly ? `1px solid ${S.line}` : "none" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: S.ink }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: allDone ? S.successRing : S.muted, background: allDone ? S.successBg : "rgba(15,39,64,0.05)", borderRadius: 999, padding: "2px 9px" }}>
          {allDone ? "Done" : `${doneCount}/${rows.length}`}
        </span>
        <CaretDown size={14} weight="bold" color={S.muted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />
      </button>
      {open && (
        <div style={{ padding: "0 14px 8px" }}>
          {rows.map((r) => (
            <Row key={r.code} row={r} viewOnly={viewOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ row, viewOnly }: { row: MRow; viewOnly: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "9px 0" }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          marginTop: 1,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: row.isComplete ? S.successRing : "transparent",
          border: row.isComplete ? "none" : `2px solid rgba(15,39,64,0.2)`,
          color: "#fff",
        }}
      >
        {row.isComplete ? <Check size={12} weight="bold" /> : null}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: row.isComplete ? S.muted : S.ink, lineHeight: 1.4, textDecoration: row.isComplete ? "line-through" : "none" }}>
          {viewOnly ? row.labelOther : row.label}
        </p>
        {!viewOnly && row.isComplete && row.date && (
          <p style={{ margin: "2px 0 0", fontSize: 12, color: S.muted }}>Confirmed {fmtDate(row.date)}</p>
        )}
      </div>
    </div>
  );
}
