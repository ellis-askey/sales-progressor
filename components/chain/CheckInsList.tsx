"use client";

// Chains → "Check-ins" tab.
//
// Every node in the agent's chains that isn't their own file — other agents'
// claimed sales AND unclaimed stubs alike — as a revolving "who do I check in
// on next" list. Sorted least-recently-updated first (the service sorts on OUR
// own last chase-log entry; a node we've never logged floats to the top). Each
// row carries the property photo (same signed URL / fallback as the chain
// drawer), and a "Last update {date}: {our last note}" line.
//
// Logging an update is private to us (tagged to our side, never shown to the
// neighbour — Option A, 2026-10-08). After a successful log the row re-sorts to
// the bottom and FLIP-animates there: nothing disappears, the cycle just turns.

import { useState, useTransition, useRef, useLayoutEffect, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { addChainEntryAction, toggleChainStepAction } from "@/app/actions/chain-intel";
import { CHECK_IN_STEPS } from "@/lib/chain/check-in-steps";
import { RowActionsMenu, type RowAction } from "@/components/account/chrome/RowActionsMenu";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import { useChainAddNode } from "@/components/chain/use-chain-add-node";
import { extractFirstName } from "@/lib/contacts/displayName";
import { ContactAvatar } from "@/components/ui/Avatar";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import type { CheckInRow } from "@/lib/services/chains";

// "24th Oct" — day-with-ordinal + short month, matching the founder's example.
function shortDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${day}${suffix} ${month}`;
}

// Age in days of our last update (older / none = quieter, sorts higher).
function ageDays(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// Horizontal scroller with a soft edge-fade that appears only when there's more
// to scroll in that direction — left once you've scrolled off the start, right
// while more remains (critique #283, mirrors the property-file timeline's fade,
// but on both ends and scroll-aware so a fully-visible row isn't faded).
function EdgeFadeRow({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<{ l: boolean; r: boolean }>({ l: false, r: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const l = el.scrollLeft > 2;
      const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setFade((p) => (p.l === l && p.r === r ? p : { l, r }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);
  const F = 28;
  const mask = fade.l && fade.r
    ? `linear-gradient(to right, transparent 0, #000 ${F}px, #000 calc(100% - ${F}px), transparent 100%)`
    : fade.l ? `linear-gradient(to right, transparent 0, #000 ${F}px)`
    : fade.r ? `linear-gradient(to right, #000 calc(100% - ${F}px), transparent 100%)`
    : undefined;
  return (
    <div ref={ref} className={className} style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
      {children}
    </div>
  );
}

// Least-recently-updated first; a never-logged node (null) floats to the top.
function sortRows(rows: CheckInRow[]): CheckInRow[] {
  return [...rows].sort((a, b) => {
    const ka = a.lastUpdateAt, kb = b.lastUpdateAt;
    if (!ka && !kb) return 0;
    if (!ka) return -1;
    if (!kb) return 1;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

type CheckInGroup = { chainId: string; chainName: string | null; ourAddresses: string[]; rows: CheckInRow[] };

// Group-header line for our own side of the chain. One sale shows its full
// address; two or more show first lines only (full addresses would run long),
// capped at two with a +N for the rest.
function ourSalesLabel(addresses: string[]): string | null {
  if (addresses.length === 0) return null;
  if (addresses.length === 1) return `Your sale is ${addresses[0]}`;
  const firstLines = addresses.map((a) => a.split(",")[0].trim());
  const shown = firstLines.slice(0, 2).join(" and ");
  const extra = firstLines.length - 2;
  return `Your sales are ${shown}${extra > 0 ? ` +${extra}` : ""}`;
}

// Bucket the (already globally quietest-first) rows by chain. Because the input
// is globally sorted, the first time we meet a chain is that chain's quietest
// row — so groups come out ordered by their most-overdue node, and each group's
// rows stay quietest-first. (Chains → Check-ins grouping, 2026-10-09.)
function groupRows(rows: CheckInRow[]): CheckInGroup[] {
  const map = new Map<string, CheckInGroup>();
  for (const r of rows) {
    let g = map.get(r.chainId);
    if (!g) { g = { chainId: r.chainId, chainName: r.chainName, ourAddresses: r.ourAddresses, rows: [] }; map.set(r.chainId, g); }
    g.rows.push(r);
  }
  return [...map.values()];
}

export function CheckInsList({ rows: initialRows, currentUserId, currentUserRole }: { rows: CheckInRow[]; currentUserId: string; currentUserRole?: string | null }) {
  const { toast } = useAgentToast();
  const [rows, setRows] = useState<CheckInRow[]>(() => sortRows(initialRows));
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const rowTag = useGlassTag("chains-checkin-row", "Chains · check-in row");
  // "View chain" opens the shared ChainDrawer anchored on our own file in that
  // chain (ourTransactionId — guaranteed access), falling back to the neighbour's.
  const [openChainTxId, setOpenChainTxId] = useState<string | null>(null);
  const [historyRow, setHistoryRow] = useState<CheckInRow | null>(null);
  const { addNode, openAddNode, closeAddNode, onNodeSaved, refreshKey } = useChainAddNode();
  const [, startTransition] = useTransition();

  // FLIP: remember each row's top before a re-sort, then slide it from the old
  // position to the new one so the just-logged row glides to the bottom.
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<string, number>>(new Map());
  const setNode = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const prefersReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    for (const [id, el] of nodeRefs.current) {
      const prevTop = prevRects.current.get(id);
      const newTop = el.getBoundingClientRect().top;
      if (prevTop != null && !prefersReduced) {
        const delta = prevTop - newTop;
        if (delta) {
          el.style.transition = "none";
          el.style.transform = `translateY(${delta}px)`;
          // next frame: release to animate into place
          requestAnimationFrame(() => {
            el.style.transition = "transform 420ms cubic-bezier(0.22,1,0.36,1)";
            el.style.transform = "";
          });
        }
      }
    }
    prevRects.current.clear();
  }, [rows]);

  function capturePositions() {
    prevRects.current.clear();
    for (const [id, el] of nodeRefs.current) prevRects.current.set(id, el.getBoundingClientRect().top);
  }

  // "Confirm progress" pill toggles (#235). Optimistic: flip locally, then
  // reconcile with the server's step list. Marking also logs a dated entry, so
  // the row's "Last update" line and history update in place. Deliberately NO
  // re-sort here — an agent often taps several pills in one sitting, and the
  // row jumping to the bottom of its chain mid-tap would pull the pills out
  // from under their cursor. The next page load applies the normal ordering.
  const [stepBusy, setStepBusy] = useState<Set<string>>(new Set());
  // Which rows have their milestone line expanded. Closed by default — the
  // summary bar's mini dots carry the read; opening is only for confirming.
  const [stepsOpen, setStepsOpen] = useState<Set<string>>(new Set());
  function toggleStepsOpen(linkId: string) {
    setStepsOpen((cur) => {
      const next = new Set(cur);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  }
  function toggleStep(row: CheckInRow, stepKey: string) {
    const busyKey = `${row.linkId}:${stepKey}`;
    if (stepBusy.has(busyKey)) return;
    const wasDone = row.steps.includes(stepKey);
    const next = !wasDone;
    setStepBusy((s) => new Set(s).add(busyKey));
    setRows((cur) =>
      cur.map((r) =>
        r.linkId === row.linkId
          ? { ...r, steps: next ? [...r.steps, stepKey] : r.steps.filter((k) => k !== stepKey) }
          : r,
      ),
    );
    startTransition(async () => {
      try {
        const res = await toggleChainStepAction(row.linkId, stepKey, next, row.ourTransactionId ?? undefined);
        setRows((cur) =>
          cur.map((r) =>
            r.linkId === row.linkId
              ? {
                  ...r,
                  steps: res.steps,
                  ...(res.entry
                    ? { lastUpdateAt: res.entry.at, lastUpdateBody: res.entry.body, history: [{ at: res.entry.at, body: res.entry.body }, ...r.history] }
                    : {}),
                }
              : r,
          ),
        );
      } catch (e) {
        // Revert the optimistic flip.
        setRows((cur) =>
          cur.map((r) =>
            r.linkId === row.linkId
              ? { ...r, steps: wasDone ? [...r.steps, stepKey] : r.steps.filter((k) => k !== stepKey) }
              : r,
          ),
        );
        toast.error(e instanceof Error ? e.message : "Couldn't update that step.");
      } finally {
        setStepBusy((s) => {
          const n = new Set(s);
          n.delete(busyKey);
          return n;
        });
      }
    });
  }

  function logUpdate(row: CheckInRow) {
    const text = draft.trim();
    if (!text) return;
    setBusy(row.linkId);
    startTransition(async () => {
      try {
        const entry = await addChainEntryAction(row.linkId, text, row.ourTransactionId ?? undefined);
        capturePositions();
        setRows((cur) =>
          sortRows(
            cur.map((r) =>
              r.linkId === row.linkId
                ? { ...r, lastUpdateAt: entry.createdAt, lastUpdateBody: entry.body, history: [{ at: entry.createdAt, body: entry.body }, ...r.history] }
                : r,
            ),
          ),
        );
        setOpenId(null);
        setDraft("");
        toast.success(`Update logged${row.firmName ? ` · ${row.firmName}` : ""}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't log that update.");
      } finally {
        setBusy(null);
      }
    });
  }

  // Secondary chain actions for a row's ⋯ menu. "View chain" opens the drawer on
  // our own file in that chain (guaranteed access), falling back to the neighbour's.
  function menuItems(row: CheckInRow): RowAction[] {
    const items: RowAction[] = [];
    const chainTxId = row.ourTransactionId ?? row.transactionId;
    if (chainTxId) items.push({ label: "View chain", onClick: () => setOpenChainTxId(chainTxId) });
    const who = row.agentName ? extractFirstName(row.agentName) : "agent";
    if (row.agentPhone) items.push({ label: `Call ${who}`, onClick: () => { window.location.href = `tel:${row.agentPhone}`; } });
    if (row.agentEmail) items.push({ label: `Email ${who}`, onClick: () => { window.location.href = `mailto:${row.agentEmail}`; } });
    if (row.history.length > 0) items.push({ label: "Update history", onClick: () => setHistoryRow(row) });
    return items;
  }

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
        No other properties in your chains yet. Once you&apos;re linked into a chain, everyone else&apos;s sales appear here to check in on.
      </p>
    );
  }

  const groups = groupRows(rows);

  return (
    <>
    <style>{`
      /* Confirm progress v2 (#235): summary bar + collapsible milestone line. */
      .ciq-bar {
        display: flex; align-items: center; gap: 10px; width: 100%;
        border: 0; border-top: 1px solid var(--agent-border-subtle);
        background: transparent; font-family: inherit; cursor: pointer;
        padding: 10px 16px; border-radius: 0 0 13px 13px;
        transition: background 130ms ease;
      }
      .ciq-bar:hover { background: var(--agent-hover-shade, rgba(45,24,16,0.025)); }
      .ciq-bar:focus-visible { outline: none; box-shadow: inset 0 0 0 1.5px rgba(var(--agent-coral-rgb), 0.5); }
      .ciq-bar.ciq-open { border-radius: 0; }
      .ciq-dots { display: inline-flex; align-items: center; gap: 3.5px; flex: 0 0 auto; }
      .ciq-md { width: 7px; height: 7px; border-radius: 99px; border: 1.5px solid var(--agent-border-default); background: var(--agent-surface-elevated, #fff); transition: background 130ms ease, border-color 130ms ease; }
      .ciq-md.on { background: var(--agent-coral-deep); border-color: var(--agent-coral-deep); }
      .ciq-md.gap { margin-left: 4px; }
      .ciq-allin .ciq-md.on { background: var(--agent-success); border-color: var(--agent-success); }
      .ciq-barlabel { font-size: 11.5px; font-weight: 700; color: var(--agent-text-secondary); white-space: nowrap; }
      .ciq-ready { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--agent-success); white-space: nowrap; }
      .ciq-rdot { width: 6px; height: 6px; border-radius: 99px; background: var(--agent-success); }
      .ciq-hint { font-size: 11px; font-weight: 650; color: var(--agent-text-muted); white-space: nowrap; }
      .ciq-chev { flex: 0 0 auto; color: var(--agent-text-muted); display: grid; place-items: center; }
      .ciq-chev svg { transition: transform 200ms ease; display: block; }
      .ciq-chev.open svg { transform: rotate(180deg); }
      @media (max-width: 640px) {
        /* Hide the bold "Chain:" heading — just "Your sale is …" stays. */
        .ciq-chainname { display: none; }
        /* Drop the "Tap what you hear" hint and send the "Confirm progress · N of
           8" label over to the right, beside the chevron, so the row isn't
           cramped on a phone. */
        .ciq-hint { display: none; }
        .ciq-barlabel, .ciq-ready { order: 2; }
        .ciq-chev { order: 3; }
      }
      .ciq-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 240ms cubic-bezier(0.22,1,0.36,1); }
      .ciq-body > div { overflow: hidden; min-height: 0; }
      .ciq-body.open { grid-template-rows: 1fr; }
      .ciq-track { display: flex; padding: 6px 16px 16px; opacity: 0; transition: opacity 180ms ease 60ms; overflow-x: auto; }
      .ciq-body.open .ciq-track { opacity: 1; }
      .ciq-step {
        flex: 1 1 0; min-width: 64px; position: relative;
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        border: 0; background: none; font-family: inherit; cursor: pointer; padding: 0;
      }
      .ciq-step::before, .ciq-step::after { content: ""; position: absolute; top: 13px; height: 2px; background: var(--agent-border-subtle); width: 50%; }
      .ciq-step::before { left: 0; } .ciq-step::after { right: 0; }
      .ciq-step:first-child::before, .ciq-step:last-child::after { display: none; }
      .ciq-step:disabled { cursor: default; opacity: 0.6; }
      .ciq-node {
        position: relative; z-index: 1; width: 27px; height: 27px; border-radius: 50%;
        background: var(--agent-surface-elevated, #fff); border: 1.5px solid var(--agent-border-default);
        display: grid; place-items: center; font-size: 12px; color: transparent;
        transition: border-color 130ms ease, background 130ms ease, transform 130ms ease;
      }
      .ciq-step:hover:not(:disabled) .ciq-node { border-color: rgba(var(--agent-coral-rgb), 0.55); transform: scale(1.07); }
      .ciq-step:focus-visible { outline: none; }
      .ciq-step:focus-visible .ciq-node { box-shadow: var(--agent-focus-ring); }
      .ciq-step.done .ciq-node {
        background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep));
        border-color: transparent; color: #fff;
        box-shadow: 0 2px 7px rgba(var(--agent-coral-rgb), 0.32);
        animation: ciq-pop 200ms ease;
      }
      .ciq-lbl { font-size: 10px; font-weight: 650; color: var(--agent-text-muted); line-height: 1.25; text-align: center; max-width: 76px; }
      .ciq-step.done .ciq-lbl { color: var(--agent-coral-darker); font-weight: 700; }
      .ciq-step.fin .ciq-lbl { font-weight: 750; color: var(--agent-text-secondary); }
      .ciq-step.fin .ciq-node { border-style: double; border-width: 3px; }
      .ciq-step.fin.done .ciq-node { border-style: solid; border-width: 1.5px; }
      @keyframes ciq-pop { 0% { transform: scale(0.9); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
      @keyframes ciq-logger-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
      .ciq-logger { animation: ciq-logger-in 200ms cubic-bezier(0.22,1,0.36,1); }
      @media (prefers-reduced-motion: reduce) { .ciq-logger { animation: none; } }
      @media (prefers-reduced-motion: reduce) {
        .ciq-bar, .ciq-md, .ciq-chev svg, .ciq-body, .ciq-track, .ciq-node { transition: none; }
        .ciq-step.done .ciq-node { animation: none; }
      }
    `}</style>
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: "0 0 2px", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
        Other properties in your chains, grouped by chain with the least recently updated first. Check in, log an update and the property moves to the bottom of its chain. Your notes stay private.
      </p>
      {groups.map((group) => {
        const salesLabel = ourSalesLabel(group.ourAddresses);
        return (
        <section key={group.chainId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", padding: "0 2px" }}>
            <h3 className="ciq-chainname" style={{ margin: 0, fontSize: 13.5, fontWeight: 750, color: "var(--agent-text-primary)" }}>
              {group.chainName ?? "Chain"}{salesLabel ? ":" : ""}
            </h3>
            {salesLabel && (
              <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                {salesLabel}
              </span>
            )}
          </div>
          {group.rows.map((row) => {
        const age = ageDays(row.lastUpdateAt);
        const tone = age >= 14 ? "var(--agent-danger)" : age >= 7 ? "var(--agent-warning)" : "var(--agent-text-secondary)";
        const toneBg = age >= 14 ? "rgba(var(--agent-danger-rgb),0.1)" : age >= 7 ? "rgba(var(--agent-warning-rgb),0.12)" : "rgba(45,24,16,0.05)";
        const who = row.agentName ?? "Agent not shared";
        const pct = row.progressPercent;
        const isOpen = openId === row.linkId;
        return (
          <div
            key={row.linkId}
            ref={(el) => setNode(row.linkId, el)}
            className={rowTag.className}
            {...rowTag.props}
            style={{
              padding: "13px 16px",
              borderRadius: 13,
              ...(rowTag.picked ? {} : {
                background: "var(--agent-surface-elevated, #fff)",
                border: "1px solid var(--agent-border-subtle)",
                boxShadow: "0 1px 2px rgba(45,24,16,0.04)",
              }),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {/* Property photo — same signed URL / fallback as the chain drawer. */}
              <div
                style={{
                  flex: "0 0 auto",
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--agent-border-subtle)",
                }}
              >
                {row.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.photoUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="property-photo-fallback" style={{ width: "100%", height: "100%" }} aria-hidden />
                )}
              </div>

              {/* Property + who */}
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 650, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.address}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {who}
                  {row.firmName ? <span> · {row.firmName}</span> : null}
                </p>
              </div>

              {/* Progress (claimed nodes only) */}
              {pct != null && (
                <div style={{ flex: "0 0 96px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "block", flex: 1, height: 6, borderRadius: 4, background: "var(--agent-border-subtle)", overflow: "hidden" }}>
                    <i style={{ display: "block", height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--agent-coral), var(--agent-coral-deep))" }} />
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--agent-text-secondary)", minWidth: 30, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {pct}%
                  </span>
                </div>
              )}

              {/* Action — primary Log update, plus the ⋯ overflow for secondary
                  chain actions (View chain, and later Contact / History). */}
              <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4 }}>
                {!isOpen && (
                  <button
                    onClick={() => { setOpenId(row.linkId); setDraft(""); }}
                    style={{
                      border: "1px solid var(--agent-border-default)",
                      borderRadius: 9,
                      padding: "8px 14px",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      fontWeight: 650,
                      color: "var(--agent-coral-deep)",
                      background: "var(--agent-surface-elevated, #fff)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Log update
                  </button>
                )}
                <RowActionsMenu label="More chain actions" items={menuItems(row)} />
              </div>
            </div>

            {/* Last update line (critique #286): confirmer photo + name in the
                sentence, small/grey, with the date right-aligned — pinned bottom-
                right when the sentence wraps, like the activity log. */}
            {row.lastUpdateBody ? (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>
                  <ContactAvatar contact={{ name: row.lastUpdateAuthorName ?? "Your team", roleType: "agent" }} size={22} image={row.lastUpdateAuthorImage} />
                </span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 10, alignItems: "flex-end", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>{row.lastUpdateBody}</span>
                  <span style={{ fontSize: 11, color: "var(--agent-text-faint, #b8b0a4)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {shortDate(row.lastUpdateAt as string)}
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic", lineHeight: 1.5 }}>
                No updates logged yet — check in and note what you hear.
              </p>
            )}

            {/* Inline logger — fades/slides in rather than popping (critique #280) */}
            {isOpen && (
              <div className="ciq-logger" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  className="agent-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  rows={2}
                  placeholder="What did you hear? (e.g. spoke to their agent, searches back, chasing solicitor)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) logUpdate(row);
                  }}
                  style={{ width: "100%", resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
                />
                {/* Proper Cancel (ghost) + primary Log update (critique #279) */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => { setOpenId(null); setDraft(""); }}
                    disabled={busy === row.linkId}
                    className="agent-btn agent-btn-ghost-bordered agent-btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => logUpdate(row)}
                    disabled={busy === row.linkId || !draft.trim()}
                    className="agent-btn agent-btn-color-primary agent-btn-sm"
                  >
                    {busy === row.linkId ? "Saving…" : "Log update"}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm progress (#235): summary bar + collapsible milestone
                line. The bar's mini dots mirror the circles one-to-one, so a
                closed card still shows the read; opening is only for tapping.
                Negative margins bleed the bar to the card's edges. */}
            {(() => {
              const allIn = row.steps.length === CHECK_IN_STEPS.length;
              const open = stepsOpen.has(row.linkId);
              return (
                <div style={{ margin: "12px -16px -13px" }}>
                  <button
                    type="button"
                    className={`ciq-bar${open ? " ciq-open" : ""}${allIn ? " ciq-allin" : ""}`}
                    aria-expanded={open}
                    onClick={() => toggleStepsOpen(row.linkId)}
                  >
                    <span className="ciq-dots" aria-hidden>
                      {CHECK_IN_STEPS.map((step, si) => (
                        <span
                          key={step.key}
                          className={`ciq-md${row.steps.includes(step.key) ? " on" : ""}${step.finale && !CHECK_IN_STEPS[si - 1]?.finale ? " gap" : ""}`}
                        />
                      ))}
                    </span>
                    {allIn ? (
                      <span className="ciq-ready"><span className="ciq-rdot" aria-hidden />Ready to exchange</span>
                    ) : (
                      <span className="ciq-barlabel">
                        Confirm progress · <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.steps.length} of {CHECK_IN_STEPS.length}</span>
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <span className="ciq-hint">Tap what you hear</span>
                    <span className={`ciq-chev${open ? " open" : ""}`} aria-hidden>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                  </button>
                  <div className={`ciq-body${open ? " open" : ""}`}>
                    <div>
                      <EdgeFadeRow className="ciq-track">
                        {CHECK_IN_STEPS.map((step) => {
                          const done = row.steps.includes(step.key);
                          return (
                            <button
                              key={step.key}
                              type="button"
                              onClick={() => toggleStep(row, step.key)}
                              disabled={stepBusy.has(`${row.linkId}:${step.key}`)}
                              aria-pressed={done}
                              className={`ciq-step${done ? " done" : ""}${step.finale ? " fin" : ""}`}
                            >
                              <span className="ciq-node" aria-hidden>✓</span>
                              <span className="ciq-lbl">{step.shortLabel ?? step.label}</span>
                            </button>
                          );
                        })}
                      </EdgeFadeRow>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
          })}
        </section>
        );
      })}
    </div>

    {openChainTxId && (
      <ChainDrawer
        transactionId={openChainTxId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onClose={() => setOpenChainTxId(null)}
        onOpenAddNode={openAddNode}
        refreshKey={refreshKey}
      />
    )}
    {addNode && openChainTxId && (
      <AddNodeDrawer
        chainId={addNode.chainId}
        transactionId={openChainTxId}
        direction={addNode.direction}
        editingLink={addNode.editingLink}
        forkFromLinkId={addNode.forkFromLinkId}
        aboveOfLinkId={addNode.aboveOfLinkId}
        insertBetween={addNode.insertBetween}
        focusField={addNode.focusField}
        onClose={closeAddNode}
        onSaved={onNodeSaved}
      />
    )}
    {historyRow && createPortal(
      <HistoryModal row={historyRow} onClose={() => setHistoryRow(null)} />,
      document.body,
    )}
    </>
  );
}

// Private update-history popover for a check-in node: our team's own notes on
// that node, newest first. Never shows the neighbour's notes (the service only
// hands us our-side entries).
function HistoryModal({ row, onClose }: { row: CheckInRow; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(20,12,8,0.42)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, maxHeight: "80vh", overflowY: "auto", background: "var(--agent-surface-elevated, #fff)", border: "1px solid var(--agent-border-subtle)", borderRadius: 16, boxShadow: "0 20px 50px rgba(20,12,8,0.25)", padding: 18 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 750, color: "var(--agent-text-primary)" }}>Your updates</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.address}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", color: "var(--agent-text-muted)", padding: 4, fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: "10px 0 14px", fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          Private to your side. Never shown to the other agent.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {row.history.map((h, i) => (
            <div key={`${h.at}-${i}`} style={{ paddingBottom: 11, borderBottom: i < row.history.length - 1 ? "1px solid var(--agent-border-subtle)" : "none" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--agent-text-secondary)" }}>{shortDate(h.at)}</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--agent-text-primary)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{h.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
