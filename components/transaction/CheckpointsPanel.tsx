"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import { AnimatedTick } from "@/components/ui/AnimatedTick";
import { DateField } from "@/components/ui/DateField";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Popover, PopoverMenuItem, PopoverDivider } from "@/components/ui/Popover";
import { DotsThreeVertical, Bell, Trash, Plus } from "@phosphor-icons/react";
import type { CheckpointView } from "@/lib/services/checkpoints";
import {
  createCheckpointAction,
  confirmCheckpointAction,
  nudgeCheckpointAction,
  archiveCheckpointAction,
} from "@/app/actions/checkpoints";

type Audience = "none" | "vendor" | "purchaser" | "both";
type Party = "vendor" | "purchaser" | "agent";

const PICKLIST = [
  "Probate granted",
  "Deed of variation received",
  "Indemnity policy in place",
  "Signed transfer deed (TR1) returned",
  "Gifted deposit letter received",
  "Source of funds provided",
  "Buildings insurance arranged",
  "Occupier consent form signed",
];

// Activity-log name-pill pattern (CommsEntry pillStyle): 1px border both states
// (no shift), coral border + text + lift when selected, no faded fill.
function pillStyle(on: boolean): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "5px 12px", borderRadius: 20, cursor: "pointer",
    fontSize: 12, fontWeight: 500,
    background: on ? "var(--agent-surface-elevated)" : "var(--agent-surface-glass)",
    border: on ? "1px solid var(--agent-coral-deep)" : "1px solid var(--agent-border-default)",
    color: on ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
    boxShadow: on ? "0 2px 8px rgba(15,23,42,0.10)" : "none",
    transform: on ? "translateY(-1px)" : "none",
    transition: "border-color 160ms, box-shadow 160ms, transform 160ms, color 160ms, background 160ms",
    whiteSpace: "nowrap",
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// "A", "A & B", "A, B & C" — local copy of the server-side joinNames (that one
// lives in lib/services and can't be imported into a client component).
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function CheckpointsPanel({
  transactionId, vendorNames, purchaserNames, items,
}: {
  transactionId: string;
  // Every principal client per side, full names (critique #294). Empty array =
  // no client of that side on the file yet.
  vendorNames: string[];
  purchaserNames: string[];
  items: CheckpointView[];
}) {
  const hasVendor = vendorNames.length > 0;
  const hasPurchaser = purchaserNames.length > 0;
  const vendorName = hasVendor ? joinNames(vendorNames) : "the seller";
  const purchaserName = hasPurchaser ? joinNames(purchaserNames) : "the buyer";
  const { toast } = useAgentToast();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // composer
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [showTo, setShowTo] = useState<Audience>("none");
  const [blocks, setBlocks] = useState(false);

  function pName(p: string): string {
    return p === "vendor" ? vendorName : p === "purchaser" ? purchaserName : "you";
  }


  function run(id: string | null, fn: () => Promise<{ ok: boolean; error?: string } | { ok: true; delivered: number }>, okMsg?: string) {
    setBusyId(id);
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) toast.error((res as { error?: string }).error ?? "Something went wrong");
        else if (okMsg) toast.success(okMsg);
      } finally {
        setBusyId(null);
      }
    });
  }

  function add() {
    const l = label.trim();
    if (!l) return;
    run(null, () => createCheckpointAction({ transactionId, label: l, showTo, targetDate: target || null, blocksExchange: blocks }), "Checkpoint added");
    setLabel(""); setTarget(""); setShowTo("none"); setBlocks(false); setAdding(false);
  }

  function confirmParty(cp: CheckpointView, party: Party) {
    run(cp.id, () => confirmCheckpointAction({ transactionId, checkpointId: cp.id, party }), "Confirmed");
  }
  function nudge(cp: CheckpointView, side: "vendor" | "purchaser") {
    run(cp.id, async () => {
      const res = await nudgeCheckpointAction({ transactionId, checkpointId: cp.id, side });
      if (res.ok && res.delivered === 0) return { ok: false, error: "Couldn't reach them just now" };
      return res;
    }, `Nudged ${pName(side)}`);
  }
  function remove(cp: CheckpointView) {
    run(cp.id, () => archiveCheckpointAction({ transactionId, checkpointId: cp.id }), "Checkpoint removed");
  }

  // One pill per PERSON, full name (critique #294) — a joint sale shows every
  // seller and every buyer individually. Visibility is still tracked per side,
  // so selecting one person lights everyone on that side (they all see it).
  const audienceOptions: { v: Audience; label: string; key: string }[] = [
    { v: "none", label: "No one", key: "none" },
    ...vendorNames.map((n, i) => ({ v: "vendor" as Audience, label: n, key: `vendor-${i}` })),
    ...purchaserNames.map((n, i) => ({ v: "purchaser" as Audience, label: n, key: `purchaser-${i}` })),
    ...(hasVendor && hasPurchaser ? [{ v: "both" as Audience, label: "Both", key: "both" }] : []),
  ];

  return (
    <GlassCard glassId="overview-checkpoints" label="Overview · Checkpoints" defaultVariant="v05" style={{ borderRadius: 14 }}>
      <div style={{ padding: "14px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: items.length ? 4 : 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>Checkpoints</span>
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--agent-coral-deep)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--agent-text-secondary)"; }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--agent-text-secondary)", padding: "4px 2px" }}
          >
            <Plus size={15} weight="bold" style={{ transition: "transform 320ms cubic-bezier(0.34,1.56,0.64,1)", transform: adding ? "rotate(135deg)" : "none" }} />
            Add
          </button>
        </div>

        {/* rows */}
        {items.length === 0 && !adding && (
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "6px 0 2px" }}>
            Nothing to confirm yet. Add the nuanced things that need chasing before exchange.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((cp) => {
            const anyDone = cp.confirmations.length > 0;
            const rowBusy = busyId === cp.id && pending;
            return (
              <div key={cp.id} style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid var(--agent-border-subtle)" }}>
                {/* status dot */}
                <span style={{ flex: "none", marginTop: 1, width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: cp.isComplete ? "var(--agent-success)" : "var(--agent-surface-elevated)",
                  border: cp.isComplete ? "none" : `2px solid ${anyDone ? "var(--agent-warning)" : "var(--agent-coral-deep)"}` }}>
                  {cp.isComplete ? <AnimatedTick size={12} color="#fff" /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: anyDone ? "var(--agent-warning)" : "var(--agent-coral-deep)" }} />}
                </span>

                {/* body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: cp.isComplete ? "var(--agent-text-muted)" : "var(--agent-text-primary)", textDecoration: cp.isComplete ? "line-through" : "none" }}>{cp.label}</span>
                    {cp.showTo !== "none" && (() => {
                      // One chip per person, full name, side-coloured dot (critique #294).
                      const people: { name: string; side: "vendor" | "purchaser" }[] = [
                        ...(cp.showTo === "vendor" || cp.showTo === "both" ? vendorNames.map((n) => ({ name: n, side: "vendor" as const })) : []),
                        ...(cp.showTo === "purchaser" || cp.showTo === "both" ? purchaserNames.map((n) => ({ name: n, side: "purchaser" as const })) : []),
                      ];
                      return (
                        <>
                          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted)" }}>Shown to</span>
                          {(people.length ? people : [{ name: pName(cp.showTo === "both" ? "vendor" : cp.showTo), side: (cp.showTo === "both" ? "vendor" : cp.showTo) as "vendor" | "purchaser" }]).map((p, i) => (
                            <span key={`${p.side}-${i}`} style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-secondary)", background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)", borderRadius: 999, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.side === "purchaser" ? "#BE185D" : "#4F46E5" }} />
                              {p.name}
                            </span>
                          ))}
                        </>
                      );
                    })()}
                    {cp.targetDate && !cp.isComplete && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-warning)", background: "rgba(201,125,26,0.10)", border: "1px solid rgba(201,125,26,0.30)", borderRadius: 999, padding: "2px 8px" }}>by {fmtDate(cp.targetDate)}</span>
                    )}
                    {cp.blocksExchange && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-danger)", background: "rgba(199,62,62,0.08)", border: "1px solid rgba(199,62,62,0.28)", borderRadius: 999, padding: "2px 8px" }}>Blocks exchange</span>
                    )}
                  </div>
                  {/* meta / per-party status */}
                  <div style={{ fontSize: 12, marginTop: 3, color: "var(--agent-text-muted)" }}>
                    {cp.showTo === "both"
                      ? (["vendor", "purchaser"] as const).map((p, i) => {
                          const done = cp.confirmations.find((c) => c.party === p);
                          return (
                            <span key={p}>
                              {i > 0 && <span style={{ margin: "0 6px", opacity: 0.4 }}>•</span>}
                              <span style={{ color: done ? "var(--agent-success)" : "var(--agent-text-muted)", fontWeight: done ? 600 : 400 }}>
                                {pName(p)} {done ? `✓ ${fmtDate(done.at)}` : "awaiting"}
                              </span>
                            </span>
                          );
                        })
                      : cp.isComplete
                        ? <span style={{ color: "var(--agent-success)", fontWeight: 600 }}>Confirmed by {cp.confirmations[0]?.byName}{cp.confirmations[0] ? ` · ${fmtDate(cp.confirmations[0].at)}` : ""}</span>
                        : cp.showTo === "none" ? "Awaiting your confirmation" : `Awaiting ${pName(cp.showTo)}, or confirm it yourself`}
                  </div>
                </div>

                {/* actions */}
                {!cp.isComplete && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", flex: "none" }}>
                    {cp.requiredParties.filter((p) => !cp.confirmations.some((c) => c.party === p)).map((p) => (
                      <button key={p} className="enq-btn enq-btn-primary2" disabled={rowBusy} style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => confirmParty(cp, p as Party)}>
                        {cp.showTo === "both" ? `Confirm for ${pName(p)}` : "Confirm"}
                      </button>
                    ))}
                    <Popover
                      preset="menu"
                      placement="bottom-end"
                      width={210}
                      trigger={
                        <button
                          type="button"
                          aria-haspopup="menu"
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--agent-coral)"; e.currentTarget.style.color = "var(--agent-coral-deep)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--agent-border-default)"; e.currentTarget.style.color = "var(--agent-text-muted)"; }}
                          style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-muted)", cursor: "pointer", transition: "border-color 140ms, color 140ms", flex: "none" }}
                        >
                          <DotsThreeVertical size={16} weight="bold" />
                        </button>
                      }
                    >
                      {(close) => {
                        const nudgeSides = (["vendor", "purchaser"] as const).filter(
                          (s) => cp.requiredParties.includes(s) && !cp.confirmations.some((c) => c.party === s) && (s === "vendor" ? cp.pushVendor : cp.pushPurchaser),
                        );
                        return (
                          <>
                            {nudgeSides.map((s) => (
                              <PopoverMenuItem key={s} icon={<Bell size={16} />} onClick={() => { close(); nudge(cp, s); }}>
                                Nudge {pName(s)}<small style={{ display: "block", fontWeight: 400, fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>Sends a push notification</small>
                              </PopoverMenuItem>
                            ))}
                            {nudgeSides.length > 0 && <PopoverDivider />}
                            <PopoverMenuItem icon={<Trash size={16} />} tone="danger" onClick={() => { close(); remove(cp); }}>Remove</PopoverMenuItem>
                          </>
                        );
                      }}
                    </Popover>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* composer */}
        {adding && (
          <div style={{ borderTop: "1px solid var(--agent-border-subtle)", marginTop: items.length ? 8 : 4, paddingTop: 14 }}>
            {/* Desktop/tablet: preset pills (click a selected one again to clear
                it). Mobile: one full-width dropdown instead, so they don't wrap.
                Both drive the same `label`, so editing the input below unselects
                either (it's then bespoke). Critique #199. */}
            <div className="ckp-preset-pills" style={{ flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {PICKLIST.map((p) => (
                <button key={p} type="button" style={pillStyle(label === p)} onClick={() => setLabel(label === p ? "" : p)}>{p}</button>
              ))}
            </div>
            <select
              className="agent-input ckp-preset-select"
              value={PICKLIST.includes(label) ? label : ""}
              onChange={(e) => setLabel(e.target.value)}
              style={{ marginBottom: 12 }}
            >
              <option value="">Choose what needs confirming…</option>
              {PICKLIST.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className="agent-input" placeholder="What needs confirming?" value={label} onChange={(e) => setLabel(e.target.value)} style={{ marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 7 }}>Add a date (optional)</div>
                <DateField className="agent-input" wrapperStyle={{ display: "inline-block", maxWidth: 200 }} value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 7 }}>Show it to a client to confirm?</div>
                <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                  {audienceOptions.map((o) => (
                    <button key={o.key} type="button" style={pillStyle(showTo === o.v || (showTo === "both" && (o.v === "vendor" || o.v === "purchaser")))} onClick={() => setShowTo(o.v)}>{o.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setBlocks((b) => !b)} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: "14px 0 4px", fontFamily: "inherit" }}>
              <span style={{ flex: "none", width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", background: blocks ? "var(--agent-coral-deep)" : "var(--agent-surface-elevated)", border: blocks ? "none" : "1.5px solid var(--agent-border-strong)", transition: "background 160ms" }}>
                {blocks && <AnimatedTick size={13} color="#fff" strokeWidth={3.5} />}
              </span>
              <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>Must be done before exchange</span>
            </button>
            <p style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.45, margin: "8px 0 14px" }}>
              You can confirm this yourself any time. Showing a client just lets them confirm it too, so it isn&apos;t forgotten before exchange.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="enq-btn enq-btn-primary2" disabled={pending || !label.trim()} onClick={add}>Add checkpoint</button>
              <button className="enq-btn enq-btn-flip" onClick={() => { setAdding(false); setLabel(""); setTarget(""); setShowTo("none"); setBlocks(false); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
