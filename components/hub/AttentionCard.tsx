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

import { useState, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UploadablePropertyThumb } from "@/components/hub/UploadablePropertyThumb";
import { RowActionMenu } from "@/components/hub/RowActionMenu";
import { ConfirmMilestoneDateModal, milestoneNeedsDatePrompt } from "@/components/milestones/ConfirmMilestoneDateModal";
import {
  Warning,
  CaretDown,
  Check,
  CalendarPlus,
  UserPlus,
  ArrowsClockwise,
  Clock,
  CalendarBlank,
} from "@phosphor-icons/react/dist/ssr";
import { reactivateFile, extendHoldAction, pauseClientEmails } from "@/app/actions/automation";
import { assignUserAction, acknowledgeRelistAction, clearChainSetupPendingAction } from "@/app/actions/transactions";
import { advanceChaseTaskAction, completeTaskAction, snoozeTaskAction, chaseNowFromLogAction } from "@/app/actions/tasks";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { withSolicitorRecipients } from "@/lib/services/chase-recipients";
import { chaseParty } from "@/lib/chase/action-holders";
import { GlassCard } from "@/components/glass/GlassCard";
import { assignWaitBadge } from "@/lib/hub/assign-wait";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type {
  ExpiredHoldItem,
  HubAttentionItem,
  HubUnassignedFile,
  HubRelistAck,
  HubChainSetupPending,
} from "@/lib/services/hub";
import { DateField } from "@/components/ui/DateField";

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

// De-washed (Ellis, 2026-09-17): rows no longer sit on a tone-tinted
// background — the left accent bar, icon chip and pill carry the urgency.
// No bg field at all: even an inline background: transparent would beat
// the .agent-hover-row :hover rule and mask the lift.
const TONE = {
  danger: {
    accent: "var(--agent-danger)",
    iconBg: "rgba(var(--agent-danger-rgb),0.10)",
    color: "var(--agent-danger)",
  },
  warning: {
    accent: "var(--agent-warning)",
    iconBg: "rgba(var(--agent-warning-rgb),0.10)",
    color: "var(--agent-warning)",
  },
  coral: {
    accent: "var(--agent-coral)",
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

function TypePill({ label, tone, title }: { label: string; tone: Tone; title?: string }) {
  return (
    <Pill glass tone={tone === "coral" ? "brand" : tone} size="md" title={title} style={{ flexShrink: 0 }}>
      {label}
    </Pill>
  );
}

// Split a UK address into "first line" + "town/postcode" (last two comma
// parts), mirroring the reminders list / transactions list. Kept inline to
// match the grandfathered pattern already used across those surfaces. Only the
// ≤500px attention layout renders the split; wider layouts show the full line.
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

// ── Chase split-button (reminder rows, Ellis 2026-09-18) ───────────────
// [Chase | ⌄] on every reminder row. Chase opens the real chase drawer
// right here on the hub (same composer as the file page / work queue) —
// the whole point of the card is acting without opening every file. The
// chevron covers the non-send resolutions in place: mark as chased,
// confirm the step done (with the date prompt where the milestone needs
// one), or snooze. Every resolution clears the row from the card.
function ChaseSplitButton({ item, onResolved, toastSuccess, toastError }: {
  item: WithPhoto<HubAttentionItem>;
  onResolved: () => void;
  toastSuccess: (msg: string, desc?: string) => void;
  toastError: (msg: string) => void;
}) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  // Chase drawer open with a guaranteed task id (created on demand below).
  const [chaseTaskId, setChaseTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Side-scoped recipients, mirroring the work queue's contactsForSide: PM*
  // reminders chase the buyer's side, VM* the seller's, with the file's real
  // solicitor injected for that side. Falls back to every contact when the
  // side filter leaves nobody (thin early files).
  const isBuyer = !!item.targetMilestoneCode?.startsWith("PM");
  const sideContacts = item.contacts.filter((c) =>
    isBuyer ? ["purchaser", "broker", "solicitor"].includes(c.roleType) : ["vendor", "solicitor"].includes(c.roleType),
  );
  const recipients = withSolicitorRecipients(sideContacts.length > 0 ? sideContacts : item.contacts, {
    vendorSolicitor: item.vendorSolicitor,
    purchaserSolicitor: item.purchaserSolicitor,
    side: isBuyer ? "purchaser" : "vendor",
  });

  // Most actions act on the pending chase task; the engine may not have
  // opened one yet, so create-or-fetch on demand (same pattern as the work
  // queue's chase-early path).
  async function ensureTaskId(): Promise<string> {
    if (item.taskId) return item.taskId;
    const { taskId } = await chaseNowFromLogAction(item.id, pathname);
    return taskId;
  }

  function run(fn: (taskId: string) => Promise<unknown>, okMsg: string, okDesc: string) {
    setBusy(true);
    startTransition(async () => {
      try {
        const taskId = await ensureTaskId();
        await fn(taskId);
        toastSuccess(okMsg, okDesc);
        onResolved();
      } catch {
        toastError("Couldn't do that. Try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  const confirmDone = (eventDate?: string | null) =>
    run(
      (taskId) => completeTaskAction(taskId, pathname, eventDate ?? null),
      "Step confirmed",
      `${item.reminderName} marked done on the file.`,
    );

  // The drawer needs a real chase task at open time; create-or-fetch first.
  function openChase() {
    setBusy(true);
    startTransition(async () => {
      try {
        const taskId = await ensureTaskId();
        setChaseTaskId(taskId);
      } catch {
        toastError("Couldn't open the chase. Try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <>
      <div style={{ display: "inline-flex", marginLeft: "auto", flexShrink: 0 }}>
        <button
          type="button"
          disabled={busy}
          onClick={openChase}
          className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
        >
          Chase
        </button>
        <RowActionMenu
          joined
          disabled={busy}
          items={[
            {
              key: "chased",
              icon: <ArrowsClockwise size={16} weight="bold" />,
              title: "Mark as chased",
              sub: "Advances the next chase date. No email is sent.",
              onClick: () => run((taskId) => advanceChaseTaskAction(taskId, pathname), "Marked as chased", "Next chase date advanced."),
            },
            {
              key: "done",
              icon: <Check size={16} weight="bold" />,
              title: "Confirm step done",
              sub: "Marks the step complete on the file.",
              onClick: () => {
                if (milestoneNeedsDatePrompt(item.targetMilestoneCode)) setDateModalOpen(true);
                else confirmDone(null);
              },
            },
            {
              key: "snooze-tomorrow",
              icon: <Clock size={16} weight="bold" />,
              title: "Snooze until tomorrow",
              sub: "Back on this list tomorrow.",
              onClick: () => run((taskId) => snoozeTaskAction(taskId, { hours: 24 }, pathname), "Snoozed", "Back on the list tomorrow."),
            },
            {
              key: "snooze-week",
              icon: <CalendarBlank size={16} weight="bold" />,
              title: "Snooze for a week",
              sub: "Back on this list in 7 days.",
              onClick: () => run((taskId) => snoozeTaskAction(taskId, { hours: 168 }, pathname), "Snoozed", "Back on the list in a week."),
            },
          ]}
        />
      </div>
      {dateModalOpen && (
        <ConfirmMilestoneDateModal
          open={dateModalOpen}
          milestoneCode={item.targetMilestoneCode}
          milestoneName={item.reminderName}
          loading={busy}
          onConfirm={(eventDate) => { setDateModalOpen(false); confirmDone(eventDate); }}
          onClose={() => setDateModalOpen(false)}
        />
      )}
      {chaseTaskId && (
        <ChaseDrawer
          chaseTaskId={chaseTaskId}
          transactionId={item.transaction.id}
          propertyAddress={item.transaction.propertyAddress}
          propertyPhotoUrl={item.photoUrl}
          milestoneName={item.reminderName}
          chaseCount={item.chaseCount}
          contacts={recipients}
          defaultAddRole={isBuyer ? "purchaser" : "vendor"}
          preferRole={chaseParty(item.targetMilestoneCode) ?? "client"}
          onClose={() => setChaseTaskId(null)}
          onSent={() => {
            // Mirror the work queue's post-send step: advance the next chase
            // date on the task, then clear the row in place.
            const sentTaskId = chaseTaskId;
            setChaseTaskId(null);
            startTransition(async () => {
              try {
                await advanceChaseTaskAction(sentTaskId, pathname);
              } catch {
                // The send itself succeeded; the engine will advance on its
                // next pass, so stay quiet rather than false-alarm.
              }
            });
            toastSuccess("Chase sent", `${item.reminderName} chased. Next chase date advanced.`);
            onResolved();
          }}
        />
      )}
    </>
  );
}

// ── Assign control (ported verbatim from UnassignedFilesView) ─────────

type SPUser = { id: string; name: string };

function AssignInline({ transactionId, onAssigned }: { transactionId: string; onAssigned: () => void }) {
  const { toast } = useAgentToast();
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
      try {
        await assignUserAction(transactionId, selected);
        onAssigned();
      } catch {
        toast.error("Couldn't assign that file. Try again.");
      }
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
  // Empty on first load → start collapsed (nothing to show); populated → open.
  const initialEmpty =
    initialHolds.length === 0 &&
    reminders.length === 0 &&
    initialUnassigned.length === 0 &&
    initialRelists.length === 0 &&
    initialChain.length === 0;
  const { toast } = useAgentToast();
  const { theme, isNight } = usePortalTheme();
  const [collapsed, setCollapsed] = useState(initialEmpty);
  // `showCleared` drives the all-caught-up header copy; it lags `allClear` so
  // the card slides up first, then the text crossfades. `flash` is a one-shot
  // green pulse over the card as it collapses. Both start settled when the
  // page loads already empty (no animation on first paint).
  const [showCleared, setShowCleared] = useState(initialEmpty);
  const [flash, setFlash] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Reminder rows cleared in place via the Chase split-button this session.
  const [resolvedReminderIds, setResolvedReminderIds] = useState<Set<string>>(new Set());
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
      } catch {
        toast.error("Couldn't update that. Try again.");
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
      } catch {
        toast.error("Couldn't update that. Try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  // ── Assemble the ranked row list ────────────────────────────────────
  // Reminders keep their existing cap of 3 (the work-queue link covers
  // the rest); other types were already capped by their services.
  // resolvedReminderIds: rows cleared in place via the Chase split-button
  // (marked chased / confirmed done / snoozed) — the next lower-ranked
  // reminder naturally rises into the freed slot.
  const liveReminders = reminders.filter((r) => !resolvedReminderIds.has(r.id));
  const visibleReminders = liveReminders.slice(0, 3);
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
      liveReminders.length > visibleReminders.length
        ? `${visibleReminders.length} of ${liveReminders.length} reminders`
        : `${visibleReminders.length} ${visibleReminders.length === 1 ? "reminder" : "reminders"}`,
    );
  }
  if (unassigned.length) {
    const overSla = unassigned.filter((f) => assignWaitBadge(f.waitingSince).level !== "ok").length;
    summaryParts.push(overSla > 0 ? `${unassigned.length} to assign (${overSla} over 48h)` : `${unassigned.length} to assign`);
  }
  if (relists.length) summaryParts.push(`${relists.length} new ${relists.length === 1 ? "buyer" : "buyers"}`);
  if (chainSetup.length) summaryParts.push(`${chainSetup.length} chain ${chainSetup.length === 1 ? "setup" : "setups"}`);
  const summary = summaryParts.length > 0 ? summaryParts.join(" · ") : "Reminders, holds and anything waiting on you.";

  const allClear = rows.length === 0;

  // Clearing the last item: flash the card green as it slides up, then fade the
  // header + subtext to the all-caught-up copy. Only fires on the populated →
  // empty transition (wasClearRef seeded from initialEmpty), so a first load
  // that was already empty stays settled — collapsed, cleared copy, no motion.
  const wasClearRef = useRef(initialEmpty);
  useEffect(() => {
    if (allClear && !wasClearRef.current) {
      wasClearRef.current = true;
      setFlash(true);
      setCollapsed(true);
      // Fade the copy once the ~200ms slide has landed; drop the flash after it.
      const fadeT = setTimeout(() => setShowCleared(true), 220);
      const flashT = setTimeout(() => setFlash(false), 750);
      return () => { clearTimeout(fadeT); clearTimeout(flashT); };
    }
    if (!allClear && wasClearRef.current) {
      wasClearRef.current = false;
      setShowCleared(false);
      setFlash(false);
      setCollapsed(false);
    }
  }, [allClear]);

  return (
    // Design Lab: `hub-attention`. Default v27 (Classic frost bar) per
    // Ellis's hub pick set, 2026-08-09.
    <GlassCard
      glassId="hub-attention"
      label="Hub · Needs your attention"
      defaultVariant="v27"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden", position: "relative" }}
    >
      <style>{`
        @keyframes attn-flash-kf {
          0%   { background: rgba(var(--agent-success-rgb), 0); }
          35%  { background: rgba(var(--agent-success-rgb), 0.16); }
          100% { background: rgba(var(--agent-success-rgb), 0); }
        }
        .attn-flash { animation: attn-flash-kf 750ms ease-out both; }
        @keyframes attn-copy-fade-kf { from { opacity: 0; } to { opacity: 1; } }
        .attn-copy-fade { animation: attn-copy-fade-kf 300ms ease both; }
      `}</style>
      {/* Green pulse as the card collapses on the last item being cleared. */}
      {flash && (
        <span aria-hidden className="attn-flash" style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", zIndex: 3 }} />
      )}

      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="agent-hover-ctl"
        style={{
          width: "100%",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: "none",
          borderBottom: collapsed || allClear ? "none" : "0.5px solid var(--agent-border-subtle)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden
          style={{
            color: allClear ? "var(--agent-success)" : "var(--agent-danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {allClear ? <Check size={24} weight="bold" /> : <Warning size={24} weight="bold" />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Keyed so the title crossfades when the state flips. */}
            <span
              key={showCleared ? "title-clear" : "title-active"}
              className="agent-card-title-emphasis attn-copy-fade"
              style={{ margin: 0 }}
            >
              {showCleared ? "You're all caught up" : "Needs your attention"}
            </span>
          </span>
          <span
            key={showCleared ? "sub-clear" : "sub-active"}
            className="attn-copy-fade"
            style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}
          >
            {showCleared ? "Nothing needs your attention right now." : summary}
          </span>
        </span>
        {/* Only when the card is NOT already showing every reminder — if all
            of them are right here, the link has nothing more to show. On
            mobile this header copy hides (.attn-link-header) and the footer
            version inside the collapsible body takes over. */}
        {reminders.length > visibleReminders.length && (
          <Link
            href="/agent/work-queue"
            className="agent-link attn-link-header"
            style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            All reminders
            <LinkArrow />
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
            // Expanded-empty state. The header already says all-clear, so this
            // explains what would appear here rather than repeating the line.
            <div style={{ padding: "20px 20px 24px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--agent-success)", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                New reminders, holds and anything waiting on you will show up here.
              </p>
            </div>
          ) : (
            <div ref={listRef} className="attn-rows">
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
                  onReminderResolved={(logId) => setResolvedReminderIds((prev) => new Set(prev).add(logId))}
                  toastSuccess={(msg, desc) => toast.success(msg, desc ? { description: desc } : undefined)}
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
              {/* Mobile-only footer version of "All reminders" — a small
                  tacked-on row at the bottom of the body, so the header stops
                  bunching at phone widths. Lives inside the collapsible body,
                  so it slides shut with the drawer. Same visibility rule as
                  the header link (only when more reminders exist than shown). */}
              {reminders.length > visibleReminders.length && (
                <Link
                  href="/agent/work-queue"
                  className="agent-link attn-link-footer"
                  style={{
                    padding: "10px 20px",
                    fontSize: 12,
                    fontWeight: 600,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    borderTop: "0.5px solid var(--agent-border-subtle)",
                    textDecoration: "none",
                  }}
                >
                  All reminders
                  <LinkArrow />
                </Link>
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
  onAssigned, onAcknowledge, onDismissChain, onReminderResolved, toastSuccess, toastError,
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
  onReminderResolved: (logId: string) => void;
  toastSuccess: (msg: string, desc?: string) => void;
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
    href = `/agent/transactions/${r.transaction.id}/reminders`;
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
    // Escalate the row colour by how long it's waited to be assigned: coral
    // under 48h, amber (warning) from 48h, red (danger) from 72h.
    const wait = assignWaitBadge(f.waitingSince);
    tone = wait.level === "red" ? "danger" : wait.level === "amber" ? "warning" : "coral";
    pill = { label: "Needs assigning" };
    txId = f.id;
    address = f.propertyAddress;
    secondary = f.agencyName ? `${f.agencyName} · unclaimed ${wait.text}` : `Unclaimed ${wait.text}`;
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

  const [expanded, setExpanded] = useState(false);
  const { line: addrLine, location: addrLoc } = splitAddress(address);
  const isReminder = row.kind === "reminder";

  // The row is a grid. On wide layouts: [thumb | address+pill / status | actions].
  // At ≤500px it reflows (see .attn-row in agent-system.css): photo + address
  // are the tap target to the file; the pill sits under the photo and the status
  // "thing" + actions collapse behind the chevron. `attn-collapsed` only bites
  // inside the ≤500px container query, so wider layouts always show everything.
  const thumbNode =
    row.kind === "unassigned" ? (
      // Needs-assigning rows: the thumb doubles as the photo uploader — hover
      // blurs the picture and shows the camera (2026-09-18) — so it stays inert.
      <div className="attn-thumb">
        <UploadablePropertyThumb transactionId={row.item.id} photoUrl={row.item.photoUrl} />
      </div>
    ) : (
      <Link href={href} className="attn-thumb" aria-label={address} style={{ display: "block", lineHeight: 0, textDecoration: "none" }}>
        <PropertyThumb photoUrl={row.item.photoUrl} />
      </Link>
    );

  // Rendered in two slots (inline-with-address on desktop, under-photo on
  // mobile); only one is visible per breakpoint. A pill is a plain span, so
  // rendering it twice is free.
  const pillNode = <TypePill label={pill.label} tone={tone} title={pill.title} />;

  return (
    <div
      className={`attn-row${isReminder ? " agent-hover-row" : ""}${expanded ? "" : " attn-collapsed"}`}
      style={{
        borderLeft: `3px solid ${t.accent}`,
        borderTop: topBorder ? "0.5px solid var(--agent-border-subtle)" : undefined,
      }}
    >
      {thumbNode}
      <div className="attn-addr">
        {/* Reminder rows link into the Reminders tab; all others into the file. */}
        <Link href={href} className="attn-addr-link hub-addr">
          <span className="attn-addr-full">{address}</span>
          <span className="attn-addr-street">{addrLine}</span>
          {addrLoc && <span className="attn-addr-loc">{addrLoc}</span>}
        </Link>
        <span className="attn-pill-d">{pillNode}</span>
      </div>
      <button
        type="button"
        className="attn-chev"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide details" : "Show details"}
        onClick={() => setExpanded((v) => !v)}
      >
        <CaretDown size={15} weight="bold" style={{ transition: "transform 180ms ease", transform: expanded ? "rotate(180deg)" : "none" }} />
      </button>
      <span className="attn-pill-m">{pillNode}</span>
      <p className="attn-status" title={secondaryTitle}>{secondary}</p>
      <div className="attn-actions">
        {isReminder && (
          <ChaseSplitButton
            item={row.item}
            onResolved={() => onReminderResolved(row.item.id)}
            toastSuccess={toastSuccess}
            toastError={toastError}
          />
        )}
        {row.kind === "hold" && (
          showExtenderFor === txId ? (
            <div data-testid="hub-expired-holds-extender" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <DateField
                value={extenderDate}
                onChange={(e) => setExtenderDate(e.target.value)}
                min={formatDateInput(tomorrowAt9())}
                className="glass-input"
                style={{ padding: "6px 10px", fontSize: 12 }}
                wrapperStyle={{ display: "inline-block" }}
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
