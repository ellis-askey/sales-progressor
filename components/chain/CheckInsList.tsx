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

import { useState, useTransition, useRef, useLayoutEffect, useCallback } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { addChainEntryAction } from "@/app/actions/chain-intel";
import { RowActionsMenu, type RowAction } from "@/components/account/chrome/RowActionsMenu";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import { useChainAddNode } from "@/components/chain/use-chain-add-node";
import { extractFirstName } from "@/lib/contacts/displayName";
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

type CheckInGroup = { chainId: string; chainName: string | null; ourAddress: string | null; rows: CheckInRow[] };

// Bucket the (already globally quietest-first) rows by chain. Because the input
// is globally sorted, the first time we meet a chain is that chain's quietest
// row — so groups come out ordered by their most-overdue node, and each group's
// rows stay quietest-first. (Chains → Check-ins grouping, 2026-10-09.)
function groupRows(rows: CheckInRow[]): CheckInGroup[] {
  const map = new Map<string, CheckInGroup>();
  for (const r of rows) {
    let g = map.get(r.chainId);
    if (!g) { g = { chainId: r.chainId, chainName: r.chainName, ourAddress: r.ourAddress, rows: [] }; map.set(r.chainId, g); }
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
  // "View chain" opens the shared ChainDrawer anchored on our own file in that
  // chain (ourTransactionId — guaranteed access), falling back to the neighbour's.
  const [openChainTxId, setOpenChainTxId] = useState<string | null>(null);
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
              r.linkId === row.linkId ? { ...r, lastUpdateAt: entry.createdAt, lastUpdateBody: entry.body } : r,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: "0 0 2px", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
        Every other property in your chains, grouped by chain and quietest first. Check in on the ones at the top, log what you hear, and the row drops to the bottom of its chain so the cycle keeps turning. Your notes stay private to your side.
      </p>
      {groups.map((group) => (
        <section key={group.chainId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", padding: "0 2px" }}>
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 750, color: "var(--agent-text-primary)" }}>
              {group.chainName ?? "Chain"}
            </h3>
            {group.ourAddress && (
              <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                your sale: {group.ourAddress}
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
            style={{
              padding: "13px 16px",
              borderRadius: 13,
              background: "var(--agent-surface-elevated, #fff)",
              border: "1px solid var(--agent-border-subtle)",
              boxShadow: "0 1px 2px rgba(45,24,16,0.04)",
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
                  {!row.claimed && (
                    <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "var(--agent-text-muted)", background: "rgba(45,24,16,0.06)", padding: "2px 7px", borderRadius: 99, verticalAlign: "middle" }}>
                      Not yet claimed
                    </span>
                  )}
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
                <button
                  onClick={() => {
                    setOpenId(isOpen ? null : row.linkId);
                    setDraft("");
                  }}
                  style={{
                    border: "1px solid var(--agent-border-default)",
                    borderRadius: 9,
                    padding: "8px 14px",
                    fontFamily: "inherit",
                    fontSize: 12.5,
                    fontWeight: 650,
                    color: "var(--agent-coral-deep)",
                    background: isOpen ? "rgba(255,107,74,0.08)" : "var(--agent-surface-elevated, #fff)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isOpen ? "Cancel" : "Log update"}
                </button>
                <RowActionsMenu label="More chain actions" items={menuItems(row)} />
              </div>
            </div>

            {/* Last update line */}
            <p style={{ margin: "10px 0 0", fontSize: 12, color: row.lastUpdateBody ? "var(--agent-text-secondary)" : "var(--agent-text-muted)", lineHeight: 1.5 }}>
              {row.lastUpdateBody ? (
                <>
                  <span style={{ fontWeight: 700, color: tone, background: toneBg, padding: "1px 7px", borderRadius: 99, marginRight: 6 }}>
                    Last update {shortDate(row.lastUpdateAt as string)}
                  </span>
                  {row.lastUpdateBody}
                </>
              ) : (
                <span style={{ fontStyle: "italic" }}>No updates logged yet — check in and note what you hear.</span>
              )}
            </p>

            {/* Inline logger */}
            {isOpen && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  rows={2}
                  placeholder="What did you hear? (e.g. spoke to their agent, searches back, chasing solicitor)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) logUpdate(row);
                  }}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: 13,
                    lineHeight: 1.5,
                    padding: "9px 11px",
                    borderRadius: 10,
                    border: "1px solid var(--agent-border-default)",
                    background: "var(--agent-surface-nested, #fff)",
                    color: "var(--agent-text-primary)",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => logUpdate(row)}
                    disabled={busy === row.linkId || !draft.trim()}
                    style={{
                      border: "none",
                      borderRadius: 9,
                      padding: "8px 16px",
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#fff",
                      background: "var(--agent-coral-deep)",
                      cursor: busy === row.linkId || !draft.trim() ? "not-allowed" : "pointer",
                      opacity: busy === row.linkId || !draft.trim() ? 0.55 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {busy === row.linkId ? "Saving…" : "Log update"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
          })}
        </section>
      ))}
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
    </>
  );
}
