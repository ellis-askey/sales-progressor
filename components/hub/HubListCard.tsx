"use client";

// Shared hub list card — the reusable shell + row the "Gone quiet" and
// "Mortgage offers expiring" cards render through, built to match the
// "Needs your attention" card exactly (full-width flush rows with a left
// accent bar + tone tint, real property photo with house-glyph fallback,
// slide open/close, auto-animated row removal, cap + "Show all"). Rows carry a
// Dismiss (snooze) action so a handled file can be cleared instead of nagging.
//
// Empty list → renders nothing (opt-in by presence), matching the founder's
// call that these cards disappear when there's nothing to show (unlike the
// attention card, which always stays with an "all clear" line).

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Clock, Bank, CaretDown, X } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { dismissHubCardAction } from "@/app/actions/hub-cards";

export type HubRowTone = "danger" | "warning" | "coral" | "muted";

export type HubRowData = {
  transactionId: string;
  href: string;
  photoUrl: string | null;
  address: string;
  // null = no pill. Gone-quiet rows pass null — the card title already says
  // "Gone quiet" and the subtext carries the specifics, so a per-row pill
  // was pure duplication. Mortgage rows keep theirs ("12 days left" etc.).
  pillLabel: string | null;
  pillTone: HubRowTone;
  subtext: string;
  meta: string | null;
  metaTone: "muted" | "warning";
  // Identifies the exact item for the dismiss/snooze store.
  dismissSignature: string;
};

const TONE: Record<HubRowTone, { accent: string; bg: string; iconBg: string; color: string }> = {
  danger: { accent: "var(--agent-danger)", bg: "rgba(var(--agent-danger-rgb),0.05)", iconBg: "rgba(var(--agent-danger-rgb),0.10)", color: "var(--agent-danger)" },
  warning: { accent: "var(--agent-warning)", bg: "rgba(var(--agent-warning-rgb),0.05)", iconBg: "rgba(var(--agent-warning-rgb),0.10)", color: "var(--agent-warning)" },
  coral: { accent: "var(--agent-coral)", bg: "var(--agent-coral-bg-tint)", iconBg: "rgba(var(--agent-coral-base-rgb),0.12)", color: "var(--agent-coral-deep)" },
  muted: { accent: "rgba(100,116,139,0.55)", bg: "rgba(100,116,139,0.04)", iconBg: "rgba(100,116,139,0.12)", color: "#64748B" },
};

const ICONS = { clock: Clock, bank: Bank } as const;

// First line + town/postcode (last two comma parts). Inline per the grandfathered
// per-component pattern shared across the hub cards.
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

// Split a "X · Y" context line into its halves for the mobile stack; a line
// without the separator stays a single part.
function splitOnDot(s: string): string[] {
  const i = s.indexOf(" · ");
  return i === -1 ? [s] : [s.slice(0, i), s.slice(i + 3)];
}

const INITIAL_VISIBLE = 6;

export function HubListCard({
  cardKind,
  iconName,
  headerTone,
  title,
  subtitle,
  rows: initialRows,
  defaultCollapsed = false,
}: {
  cardKind: "gone_quiet" | "mortgage_expiry";
  iconName: keyof typeof ICONS;
  headerTone: HubRowTone;
  title: string;
  subtitle: string;
  rows: HubRowData[];
  // Hub clutter rule (Ellis, 2026-09-18): triage cards below the top two
  // start collapsed when more than one is on show. Header + count stay
  // visible either way.
  defaultCollapsed?: boolean;
}) {
  const { toast } = useAgentToast();
  const [rows, setRows] = useState<HubRowData[]>(initialRows);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  if (rows.length === 0) return null;

  const HeaderIcon = ICONS[iconName];
  const ht = TONE[headerTone];
  const shown = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - shown.length;

  function dismiss(row: HubRowData) {
    setBusyId(row.transactionId);
    startTransition(async () => {
      const res = await dismissHubCardAction({ transactionId: row.transactionId, cardKind, signature: row.dismissSignature });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.transactionId !== row.transactionId));
        toast.success("Dismissed for 2 weeks");
      } else {
        toast.error(res.error ?? "Couldn't dismiss. Try again.");
      }
      setBusyId((cur) => (cur === row.transactionId ? null : cur));
    });
  }

  return (
    <GlassCard glassId="hub-attention" label={`Hub · ${title}`} defaultVariant="v27" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="agent-hover-ctl"
        style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: collapsed ? "none" : "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}
      >
        <span aria-hidden style={{ color: ht.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <HeaderIcon size={24} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>{title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: ht.iconBg, color: ht.color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {rows.length}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>{subtitle}</span>
        </span>
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", flexShrink: 0 }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* Collapsible body — slides via the grid-rows accordion, content stays mounted */}
      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          <div ref={listRef}>
            {shown.map((row, i) => {
              const t = TONE[row.pillTone];
              return (
                <div
                  key={row.transactionId}
                  className="agent-hover-row"
                  // De-washed 2026-09-17: no tinted resting background — the
                  // accent bar + pill carry the tone, and the lift hover lands.
                  style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px", borderLeft: `3px solid ${t.accent}`, borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                >
                  <Link href={row.href} unstable_dynamicOnHover className="hub-thumb-link" aria-label={`Open ${row.address}`}>
                    <PropertyThumb photoUrl={row.photoUrl} />
                  </Link>
                  <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <Link href={row.href} unstable_dynamicOnHover className="hub-addr" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 0 }}>
                        <span className="hub-addr-full">{row.address}</span>
                        {(() => { const a = splitAddress(row.address); return (<>
                          <span className="hub-addr-line">{a.line}</span>
                          {a.location && <span className="hub-addr-loc">{a.location}</span>}
                        </>); })()}
                      </Link>
                      {row.pillLabel && (
                        <Pill glass tone={row.pillTone === "coral" ? "brand" : row.pillTone === "muted" ? "muted" : row.pillTone} size="md" style={{ flexShrink: 0 }}>
                          {row.pillLabel}
                        </Pill>
                      )}
                    </div>
                    <p className="hub-r-meta-d" style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.subtext}
                    </p>
                    {row.meta && (
                      <p className="hub-r-hide-m" style={{ margin: "3px 0 0", fontSize: 11, color: row.metaTone === "warning" ? "var(--agent-warning)" : "var(--agent-text-muted)", fontWeight: row.metaTone === "warning" ? 600 : 400 }}>
                        {row.meta}
                      </p>
                    )}
                  </div>
                  <div className="hub-r-tail" style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="hub-r-meta-m" style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>
                      {splitOnDot(row.subtext).map((part, k) => <span key={k}>{part}</span>)}
                    </span>
                    <button
                      type="button"
                      onClick={() => dismiss(row)}
                      disabled={busyId === row.transactionId}
                      className="agent-btn agent-btn-sm agent-btn-ghost-bordered hub-r-actions"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                      title="Hide this for 2 weeks. It comes back if it still applies."
                    >
                      <X size={12} weight="bold" />
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="agent-link"
                style={{ width: "100%", padding: "10px 20px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "transparent", border: "none", borderTop: "0.5px solid var(--agent-border-subtle)", cursor: "pointer" }}
              >
                Show all ({rows.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
