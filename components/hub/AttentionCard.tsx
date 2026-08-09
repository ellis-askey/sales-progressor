"use client";

// Unified hub attention card (founder-approved plan, 2026-08-08).
// Replaces the five stacked cards — ExpiredHoldsCard, AttentionListView,
// UnassignedFilesView, NewBuyersToAcknowledgeView, ChainSetupPendingView —
// with ONE card, one header, one severity-ranked list.
//
// Row anatomy is identical across all five types:
//   [property photo | fallback icon] [address + why-line] [type pill] [inline actions]
//
// Ranking (most urgent first, mixed types):
//   escalated reminders → expired holds → overdue reminders → due-today
//   reminders → needs-assigning → new-buyer acks → chain setup.
//
// Behaviours ported UNCHANGED from the five originals:
//   - Take off hold → resume-automation chooser modal (resume vs keep
//     emails paused), toasts, row animates out
//   - Extend hold → inline date picker + "Indefinitely" + past-date guard
//     (data-testid="hub-expired-holds-extender" kept for the e2e suite)
//   - Assign → lazy-loaded person picker, save, row animates out
//   - Acknowledge (new buyer) + "Mark as done" (chain setup)
//   - Escalated pill tooltip (who escalated, when, why)
//   - Reminder rows link into the file's Reminders tab
//   - LOCKED COPY on new-buyer rows (voice pass 2026-06-04) verbatim
//
// The card renders an all-clear line when empty (never disappears), and
// collapses via the header chevron. Rows beyond the first 8 sit behind a
// "Show all" expander so nothing is silently dropped.

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import {
  Warning,
  HouseSimple,
  ArrowRight,
  CaretDown,
  Check,
  CalendarPlus,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr";
import { reactivateFile, extendHoldAction, pauseClientEmails } from "@/app/actions/automation";
import { assignUserAction, acknowledgeRelistAction, clearChainSetupPendingAction } from "@/app/actions/transactions";
import { GlassCard } from "@/components/glass/GlassCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type {
  ExpiredHoldItem,
  HubAttentionItem,
  HubUnassignedFile,
  HubRelistAck,
  HubChainSetupPending,
} from "@/lib/services/hub";

// Page-level decoration: every item arrives with its photo path already
// signed to a temporary URL (or null → icon fallback).
type WithPhoto<T> = T & { photoUrl: string | null };

type Props = {
  holds: WithPhoto<ExpiredHoldItem>[];
  reminders: WithPhoto<HubAttentionItem>[];
  unassigned: WithPhoto<HubUnassignedFile>[];
  relists: WithPhoto<HubRelistAck>[];
  chainSetup: WithPhoto<HubChainSetupPending>[];
};

// ── Tones ──────────────────────────────────────────────────────────────

type Tone = "danger" | "warning" | "coral";

const TONE = {
  danger: {
    accent: "var(--agent-danger)",
    bg: "rgba(var(--agent-danger-rgb),0.05)",
    iconBg: "rgba(var(--agent-danger-rgb),0.10)",
    color: "var(--agent-danger)",
  },
  warning: {
    accent: "var(--agent-warning)",
    bg: "rgba(var(--agent-warning-rgb),0.05)",
    iconBg: "rgba(var(--agent-warning-rgb),0.10)",
    color: "var(--agent-warning)",
  },
  coral: {
    accent: "var(--agent-coral)",
    bg: "var(--agent-coral-bg-tint)",
    iconBg: "rgba(var(--agent-coral-base-rgb),0.12)",
    color: "var(--agent-coral-deep)",
  },
} as const satisfies Record<Tone, unknown>;

// ── Small helpers ──────────────────────────────────────────────────────

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function dueBackLabel(d: Date): string {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff < 1) return "Was due back today";
  if (diff < 2) return "Was due back yesterday";
  return `Was due back ${diff} days ago`;
}

function fmtShortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Property thumbnail — photo when the file has one, tinted house glyph
// otherwise. Tint keys to the row's tone so the fallback still carries
// the severity colour-code.
function PropertyThumb({ photoUrl, tone }: { photoUrl: string | null; tone: Tone }) {
  const t = TONE[tone];
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          objectFit: "cover",
          flexShrink: 0,
          border: "0.5px solid rgba(15,23,42,0.08)",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: t.iconBg,
        color: t.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: `0.5px solid ${t.accent}`,
      }}
    >
      <HouseSimple size={20} weight="regular" />
    </span>
  );
}

function TypePill({ label, tone, title }: { label: string; tone: Tone; title?: string }) {
  const t = TONE[tone];
  return (
    <span
      title={title}
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: t.color,
        background: t.iconBg,
        padding: "3px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// ── Assign control (ported verbatim from UnassignedFilesView) ─────────

type SPUser = { id: string; name: string };

function AssignInline({ transactionId, onAssigned }: { transactionId: string; onAssigned: () => void }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<SPUser[]>([]);
  const [selected, setSelected] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDropdown() {
    if (users.length === 0) {
      fetch("/api/agency/users")
        .then((r) => r.json())
        .then(setUsers)
        .catch(() => {});
    }
    setOpen(true);
  }

  function save() {
    if (!selected) return;
    startTransition(async () => {
      await assignUserAction(transactionId, selected);
      onAssigned();
    });
  }

  if (!open) {
    return (
      <button
        onClick={openDropdown}
        className="agent-btn agent-btn-sm agent-btn-primary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
      >
        <UserPlus size={13} weight="bold" />
        Assign
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          fontSize: 11, padding: "3px 6px", borderRadius: 6,
          border: "0.5px solid var(--agent-border-default)",
          background: "var(--agent-surface-glass)",
          color: "var(--agent-text-primary)", maxWidth: 140,
        }}
      >
        <option value="">Select…</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={!selected || isPending}
        className="agent-btn agent-btn-xs agent-btn-primary"
      >
        {isPending ? "…" : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="agent-link" style={{ fontSize: 11 }}>
        Cancel
      </button>
    </div>
  );
}

// ── The card ───────────────────────────────────────────────────────────

const INITIAL_VISIBLE = 8;

export function AttentionCard({ holds: initialHolds, reminders, unassigned: initialUnassigned, relists: initialRelists, chainSetup: initialChain }: Props) {
  const { toast } = useAgentToast();
  const { theme, isNight } = usePortalTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [, startTransition] = useTransition();
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  // Per-type local state so actioned rows animate out without a reload.
  const [holds, setHolds] = useState(initialHolds);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [relists, setRelists] = useState(initialRelists);
  const [chainSetup, setChainSetup] = useState(initialChain);

  // Hold actions (ported from ExpiredHoldsCard) ------------------------
  const [resumeFor, setResumeFor] = useState<{ id: string; address: string } | null>(null);
  const [showExtenderFor, setShowExtenderFor] = useState<string | null>(null);
  const [extenderDate, setExtenderDate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function doResume(transactionId: string, keepEmailsPaused: boolean) {
    setResumeFor(null);
    startTransition(async () => {
      const result = await reactivateFile(transactionId);
      if (result.ok) {
        if (keepEmailsPaused) {
          pauseClientEmails(transactionId).catch(() => {});
        }
        toast.success(keepEmailsPaused ? "Off hold: emails stay paused" : "Off hold: automation resumed");
        setHolds((prev) => prev.filter((h) => h.transactionId !== transactionId));
      } else {
        toast.error(result.error ?? "Couldn't reactivate. Try again.");
      }
    });
  }

  function handleExtend(transactionId: string, plannedEndAt: Date | null) {
    startTransition(async () => {
      const result = await extendHoldAction(transactionId, plannedEndAt);
      if (result.ok) {
        toast.success("Hold extended");
        setShowExtenderFor(null);
        setExtenderDate("");
        setHolds((prev) => prev.filter((h) => h.transactionId !== transactionId));
      } else {
        toast.error(result.error ?? "Couldn't extend. Try again.");
      }
    });
  }

  // Relist + chain actions --------------------------------------------
  function acknowledge(roundId: string) {
    setBusyId(roundId);
    startTransition(async () => {
      try {
        await acknowledgeRelistAction(roundId);
        setRelists((prev) => prev.filter((r) => r.roundId !== roundId));
      } finally {
        setBusyId(null);
      }
    });
  }

  function dismissChain(transactionId: string) {
    setBusyId(transactionId);
    startTransition(async () => {
      try {
        await clearChainSetupPendingAction(transactionId);
        setChainSetup((prev) => prev.filter((f) => f.transactionId !== transactionId));
      } finally {
        setBusyId(null);
      }
    });
  }

  // ── Assemble the ranked row list ────────────────────────────────────
  // Reminders keep their existing cap of 3 (the work-queue link covers
  // the rest); other types were already capped by their services.
  const visibleReminders = reminders.slice(0, 3);
  const escalated = visibleReminders.filter((r) => r.urgency === "escalated");
  const overdue = visibleReminders.filter((r) => r.urgency === "overdue");
  const dueToday = visibleReminders.filter((r) => r.urgency === "due_today");

  type Row =
    | { kind: "reminder"; key: string; item: WithPhoto<HubAttentionItem> }
    | { kind: "hold"; key: string; item: WithPhoto<ExpiredHoldItem> }
    | { kind: "unassigned"; key: string; item: WithPhoto<HubUnassignedFile> }
    | { kind: "relist"; key: string; item: WithPhoto<HubRelistAck> }
    | { kind: "chain"; key: string; item: WithPhoto<HubChainSetupPending> };

  const rows: Row[] = [
    ...escalated.map((item): Row => ({ kind: "reminder", key: `rem-${item.id}`, item })),
    ...holds.map((item): Row => ({ kind: "hold", key: `hold-${item.transactionId}`, item })),
    ...overdue.map((item): Row => ({ kind: "reminder", key: `rem-${item.id}`, item })),
    ...dueToday.map((item): Row => ({ kind: "reminder", key: `rem-${item.id}`, item })),
    ...unassigned.slice(0, 5).map((item): Row => ({ kind: "unassigned", key: `asg-${item.id}`, item })),
    ...relists.slice(0, 5).map((item): Row => ({ kind: "relist", key: `rel-${item.roundId}`, item })),
    ...chainSetup.slice(0, 5).map((item): Row => ({ kind: "chain", key: `chn-${item.transactionId}`, item })),
  ];

  const shownRows = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - shownRows.length;

  // Plain-English summary of what's inside, e.g.
  // "1 file on hold · 3 reminders · 2 to assign"
  const summaryParts: string[] = [];
  if (holds.length) summaryParts.push(`${holds.length} ${holds.length === 1 ? "file" : "files"} on hold`);
  // Reminders are capped at 3 rows here; when there are more, say so
  // honestly — the "All reminders" link carries the rest.
  if (visibleReminders.length) {
    summaryParts.push(
      reminders.length > visibleReminders.length
        ? `${visibleReminders.length} of ${reminders.length} reminders`
        : `${visibleReminders.length} ${visibleReminders.length === 1 ? "reminder" : "reminders"}`,
    );
  }
  if (unassigned.length) summaryParts.push(`${unassigned.length} to assign`);
  if (relists.length) summaryParts.push(`${relists.length} new ${relists.length === 1 ? "buyer" : "buyers"}`);
  if (chainSetup.length) summaryParts.push(`${chainSetup.length} chain ${chainSetup.length === 1 ? "setup" : "setups"}`);
  const summary = summaryParts.length > 0 ? summaryParts.join(" · ") : "Reminders, holds and anything waiting on you.";

  const allClear = rows.length === 0;

  return (
    // Design Lab: `hub-attention`. Default v27 (Classic frost bar) per
    // Ellis's hub pick set, 2026-08-09.
    <GlassCard
      glassId="hub-attention"
      label="Hub · Needs your attention"
      defaultVariant="v27"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{
          width: "100%",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: "none",
          borderBottom: collapsed || allClear ? "none" : "0.5px solid var(--agent-border-subtle)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: allClear ? "var(--agent-success-bg)" : "rgba(var(--agent-danger-rgb),0.10)",
            color: allClear ? "var(--agent-success)" : "var(--agent-danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {allClear ? <Check size={16} weight="bold" /> : <Warning size={17} weight="bold" />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>
              Needs your attention
            </span>
            {rows.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: "rgba(var(--agent-danger-rgb),0.10)",
                  color: "var(--agent-danger)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {rows.length}
              </span>
            )}
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            {summary}
          </span>
        </span>
        {reminders.length > 0 && (
          <Link
            href="/agent/work-queue"
            className="agent-link"
            style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            All reminders
            <ArrowRight size={12} />
          </Link>
        )}
        <span
          aria-hidden
          style={{
            color: "var(--agent-text-muted)",
            display: "flex",
            alignItems: "center",
            transition: "transform 180ms ease",
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
            flexShrink: 0,
          }}
        >
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* ── Collapsible body ── */}
      {/* Wrapped in .agent-acc (grid-rows 0fr↔1fr) so the card slides open and
          closed instead of snapping. Content stays mounted; the .open class is
          the only thing that toggles. */}
      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          {allClear ? (
            <div style={{ padding: "20px 20px 24px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-success)", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                Nothing needs your attention right now.
              </p>
            </div>
          ) : (
            <div ref={listRef}>
              {shownRows.map((row, i) => (
                <AttentionRow
                  key={row.key}
                  row={row}
                  topBorder={i > 0}
                  busyId={busyId}
                  showExtenderFor={showExtenderFor}
                  extenderDate={extenderDate}
                  setExtenderDate={setExtenderDate}
                  onOpenExtender={(id) => { setShowExtenderFor(id); setExtenderDate(""); }}
                  onCloseExtender={() => { setShowExtenderFor(null); setExtenderDate(""); }}
                  onExtend={handleExtend}
                  onOpenResume={(id, address) => setResumeFor({ id, address })}
                  onAssigned={(id) => setUnassigned((prev) => prev.filter((f) => f.id !== id))}
                  onAcknowledge={acknowledge}
                  onDismissChain={dismissChain}
                  toastError={(msg) => toast.error(msg)}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="agent-link"
                  style={{
                    width: "100%",
                    padding: "10px 20px",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "center",
                    background: "transparent",
                    border: "none",
                    borderTop: "0.5px solid var(--agent-border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  Show all ({rows.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Take-off-hold resume modal (ported from ExpiredHoldsCard) ── */}
      {resumeFor && createPortal(
        <div
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className="nv2-night"
          style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div className="fixed inset-0 agent-backdrop-overlay" onClick={() => setResumeFor(null)} style={{ zIndex: 0 }} />
          <div
            className="rounded-2xl w-full max-w-md"
            style={{
              position: "relative",
              zIndex: 1,
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
              <h2 style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Take off hold</h2>
              <button type="button" onClick={() => setResumeFor(null)} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">×</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>{resumeFor.address}</strong>
                {", pick one. You can always change later."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ResumeOptionCard
                  title="Resume automation"
                  description="Client chase emails, reminders + escalations restart from where they left off."
                  onClick={() => doResume(resumeFor.id, false)}
                />
                <ResumeOptionCard
                  title="Reactivate, keep emails paused"
                  description="File is active again but no client emails fire. Manual chasing only. Flip back on from the Automation card any time."
                  onClick={() => doResume(resumeFor.id, true)}
                />
              </div>
            </div>
            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setResumeFor(null)}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </GlassCard>
  );
}

// ── Row renderer ───────────────────────────────────────────────────────

function AttentionRow({
  row, topBorder, busyId,
  showExtenderFor, extenderDate, setExtenderDate,
  onOpenExtender, onCloseExtender, onExtend, onOpenResume,
  onAssigned, onAcknowledge, onDismissChain, toastError,
}: {
  row:
    | { kind: "reminder"; key: string; item: WithPhoto<HubAttentionItem> }
    | { kind: "hold"; key: string; item: WithPhoto<ExpiredHoldItem> }
    | { kind: "unassigned"; key: string; item: WithPhoto<HubUnassignedFile> }
    | { kind: "relist"; key: string; item: WithPhoto<HubRelistAck> }
    | { kind: "chain"; key: string; item: WithPhoto<HubChainSetupPending> };
  topBorder: boolean;
  busyId: string | null;
  showExtenderFor: string | null;
  extenderDate: string;
  setExtenderDate: (v: string) => void;
  onOpenExtender: (id: string) => void;
  onCloseExtender: () => void;
  onExtend: (id: string, date: Date | null) => void;
  onOpenResume: (id: string, address: string) => void;
  onAssigned: (id: string) => void;
  onAcknowledge: (roundId: string) => void;
  onDismissChain: (id: string) => void;
  toastError: (msg: string) => void;
}) {
  // Resolve per-type presentation.
  let tone: Tone;
  let pill: { label: string; title?: string };
  let txId: string;
  let address: string;
  let secondary: string;
  let secondaryTitle: string | undefined;
  let href: string;

  if (row.kind === "reminder") {
    const r = row.item;
    tone = r.urgency === "escalated" ? "danger" : r.urgency === "overdue" ? "warning" : "coral";
    pill = {
      label: r.urgency === "escalated" ? "Escalated" : r.urgency === "overdue" ? "Overdue" : "Due today",
      title: r.urgency === "escalated"
        ? (r.escalationReason || r.escalatedAt)
          ? `Escalated${r.escalatedByName ? ` by ${r.escalatedByName}` : ""}${r.escalatedAt ? ` on ${fmtShortDate(r.escalatedAt)}` : ""}${r.escalationReason ? ` - ${r.escalationReason}` : ""}`
          : "Auto-escalated - no response after repeated chases"
        : undefined,
    };
    txId = r.transaction.id;
    address = r.transaction.propertyAddress;
    secondary = r.reminderName;
    href = `/agent/transactions/${r.transaction.id}?tab=reminders`;
  } else if (row.kind === "hold") {
    const h = row.item;
    tone = "danger";
    pill = { label: "On hold" };
    txId = h.transactionId;
    address = h.propertyAddress;
    secondary = h.reason ? `${dueBackLabel(h.plannedEndAt)} · ${h.reason}` : dueBackLabel(h.plannedEndAt);
    secondaryTitle = `Hold started ${fmtShortDate(h.startedAt)}${h.placedByName ? ` · Placed by ${h.placedByName}` : ""}`;
    href = `/agent/transactions/${h.transactionId}`;
  } else if (row.kind === "unassigned") {
    const f = row.item;
    tone = "coral";
    pill = { label: "Needs assigning" };
    txId = f.id;
    address = f.propertyAddress;
    secondary = f.agencyName ?? "Waiting for a progressor";
    href = `/agent/transactions/${f.id}`;
  } else if (row.kind === "relist") {
    const r = row.item;
    tone = "coral";
    pill = { label: "New buyer" };
    txId = r.transactionId;
    address = r.propertyAddress;
    // LOCKED BODY LINE — voice-passed verbatim (terminology sweep
    // 2026-06-04: "round" → "sale", lowercase inside parens)
    secondary = `${r.newBuyerName} is the new buyer (sale ${r.roundNumber}). Relisted ${fmtShortDate(r.relistedAt)}.`;
    href = `/agent/transactions/${r.transactionId}`;
  } else {
    const f = row.item;
    tone = "coral";
    pill = { label: "Chain setup" };
    txId = f.transactionId;
    address = f.propertyAddress;
    secondary = `${f.newBuyerName ? `${f.newBuyerName}'s` : "New buyer's"} onward sale is unconfirmed. Flagged ${fmtShortDate(f.flaggedAt)}.`;
    href = `/agent/transactions/${f.transactionId}`;
  }

  const t = TONE[tone];

  // Whole reminder rows stay pure links (their action lives in the file).
  // All other rows are divs with inline action buttons; the address links.
  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 20px 12px 17px",
    borderLeft: `3px solid ${t.accent}`,
    background: t.bg,
    borderTop: topBorder ? "0.5px solid var(--agent-border-subtle)" : undefined,
  };

  const body = (
    <>
      <PropertyThumb photoUrl={row.item.photoUrl} tone={tone} />
      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {row.kind === "reminder" ? (
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {address}
            </p>
          ) : (
            <Link
              href={href}
              style={{
                fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)",
                textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              className="hover:underline"
            >
              {address}
            </Link>
          )}
          <TypePill label={pill.label} tone={tone} title={pill.title} />
        </div>
        <p
          title={secondaryTitle}
          style={{
            margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {secondary}
        </p>
      </div>
    </>
  );

  if (row.kind === "reminder") {
    return (
      <Link href={href} style={{ ...rowStyle, textDecoration: "none" }} className="agent-hover-row">
        {body}
        <ArrowRight size={14} color="var(--agent-text-muted)" style={{ flexShrink: 0 }} />
      </Link>
    );
  }

  return (
    <div style={rowStyle}>
      {body}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
        {row.kind === "hold" && (
          showExtenderFor === txId ? (
            <div data-testid="hub-expired-holds-extender" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={extenderDate}
                onChange={(e) => setExtenderDate(e.target.value)}
                min={formatDateInput(tomorrowAt9())}
                className="glass-input"
                style={{ padding: "6px 10px", fontSize: 12 }}
                autoFocus
              />
              <button
                onClick={() => {
                  if (!extenderDate) return;
                  // Guard against hand-typed past dates — `min` is only a
                  // picker hint. Server also rejects, this is the fast UX.
                  if (extenderDate < formatDateInput(tomorrowAt9())) {
                    toastError("Pick a future date");
                    return;
                  }
                  onExtend(txId, new Date(extenderDate));
                }}
                disabled={!extenderDate || extenderDate < formatDateInput(tomorrowAt9())}
                className="agent-btn agent-btn-xs agent-btn-primary"
              >
                Set date
              </button>
              <button
                onClick={() => onExtend(txId, null)}
                className="agent-btn agent-btn-xs agent-btn-ghost-bordered"
                title="Hold indefinitely. Won't auto-surface again."
              >
                Indefinitely
              </button>
              <button onClick={onCloseExtender} className="agent-link" style={{ fontSize: 11 }}>Cancel</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onOpenResume(txId, address)}
                className="agent-btn agent-btn-sm agent-btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Check size={13} weight="bold" />
                Take off hold
              </button>
              <button
                onClick={() => onOpenExtender(txId)}
                className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <CalendarPlus size={13} weight="bold" />
                Extend hold
              </button>
            </>
          )
        )}
        {row.kind === "unassigned" && (
          <AssignInline transactionId={txId} onAssigned={() => onAssigned(txId)} />
        )}
        {row.kind === "relist" && (
          <button
            type="button"
            onClick={() => onAcknowledge(row.item.roundId)}
            disabled={busyId === row.item.roundId}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            {busyId === row.item.roundId ? "…" : "Acknowledge"}
          </button>
        )}
        {row.kind === "chain" && (
          <button
            type="button"
            onClick={() => onDismissChain(txId)}
            disabled={busyId === txId}
            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
          >
            {busyId === txId ? "…" : "Mark as done"}
          </button>
        )}
      </div>
    </div>
  );
}

// Tappable option card inside the Resume modal — mirrors the
// AutomationStopModal's ChooserCard pattern so the two-path UX feels
// the same across surfaces.
function ResumeOptionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        background: "var(--agent-surface-glass)",
        border: "0.5px solid rgba(15,23,42,0.10)",
        borderRadius: 12,
        cursor: "pointer",
        transition: "background 150ms, border-color 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--agent-hover-tint, rgba(255,107,74,0.06))";
        e.currentTarget.style.borderColor = "rgba(255,107,74,0.30)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--agent-surface-glass)";
        e.currentTarget.style.borderColor = "rgba(15,23,42,0.10)";
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5, margin: "4px 0 0" }}>{description}</p>
    </button>
  );
}
