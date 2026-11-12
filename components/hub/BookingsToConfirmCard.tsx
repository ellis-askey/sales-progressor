"use client";

// Hub card: provisional survey / lender-valuation bookings a client logged on
// their portal that our side hasn't confirmed yet. Built to match HubListCard
// (full-width flush rows, left accent bar + tint, real photo with house-glyph
// fallback, slide open/close, auto-animated row removal).
//
// Each row is a SPLIT action (like the enquiries button): a primary "Confirm"
// that opens the date/keys panel, plus a ▾ chevron that reveals the other honest
// outcomes so a client's provisional log never forces a misleading email:
//   - Confirm booking      → notify buyer + seller with the date (+ past-date warning)
//   - Desktop valuation     → PM6 only: correct remote wording, no seller access line
//   - Log it, don't email   → record it, no client comms
//   - Not a real booking    → PM9 only: mark not required (+ cascade), one note, no emails
//
// Empty list → renders nothing. See docs/active/booking-reminders/00-plan.md.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { CalendarCheck, CaretDown, DesktopTower, EnvelopeSimpleOpen, Prohibit, Question } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { GlassCard } from "@/components/glass/GlassCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmProvisionalBookingAction, type BookingOutcome } from "@/app/actions/booking-confirmation";
import { DateField } from "@/components/ui/DateField";
import { RowActionMenu, type RowMenuItem } from "@/components/hub/RowActionMenu";

export type BookingConfirmRow = {
  transactionId: string;
  milestoneDefinitionId: string;
  href: string;
  photoUrl: string | null;
  address: string;
  kind: "survey" | "valuation";
  pillLabel: string;
  subtext: string;
  // YYYY-MM-DD to prefill the date input; the confirmer can correct it.
  eventDateISO: string | null;
};

const ACCENT = "var(--agent-coral)";
// De-washed (Ellis, 2026-09-17): rows sat on a full coral wash; the accent
// bar + coral pill carry the identity now.
const ICON_COLOR = "var(--agent-coral-deep)";

// First line + town/postcode (last two comma parts). Inline per the grandfathered
// per-component pattern shared across the hub cards.
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

const INITIAL_VISIBLE = 6;
const todayISO = () => new Date().toISOString().slice(0, 10);

export function BookingsToConfirmCard({ rows: initialRows, defaultCollapsed = false }: {
  rows: BookingConfirmRow[];
  // Hub clutter rule (Ellis, 2026-09-18): triage cards below the top two
  // start collapsed when more than one is on show.
  defaultCollapsed?: boolean;
}) {
  const { toast } = useAgentToast();
  const [rows, setRows] = useState<BookingConfirmRow[]>(initialRows);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);   // confirm panel open
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  if (rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - shown.length;

  const TOASTS: Record<BookingOutcome, { title: string; description: string }> = {
    confirm: { title: "Booking confirmed", description: "We've let the client and the seller know." },
    desktop: { title: "Logged as a desktop valuation", description: "The buyer's been told it's remote; the seller wasn't notified." },
    silent: { title: "Logged", description: "Recorded on the file. No emails sent to clients." },
    not_required: { title: "Marked not required", description: "Cleared from the file. You can undo this any time." },
  };

  function resolve(row: BookingConfirmRow, outcome: BookingOutcome, opts?: { keys?: boolean; date?: string | null }) {
    setBusyId(row.transactionId);
    startTransition(async () => {
      try {
        const res = await confirmProvisionalBookingAction({
          transactionId: row.transactionId,
          milestoneDefinitionId: row.milestoneDefinitionId,
          keyCollectionRequired: opts?.keys ?? false,
          eventDate: opts?.date ?? null,
          outcome,
        });
        setRows((prev) => prev.filter((r) => r.transactionId !== row.transactionId));
        if (res.ok) toast.success(TOASTS[outcome].title, { description: TOASTS[outcome].description });
        else toast.error("This booking was already handled.");
      } catch {
        toast.error("Couldn't do that. Try again.");
      } finally {
        setBusyId((cur) => (cur === row.transactionId ? null : cur));
      }
    });
  }

  // Past-date "Log it" flow: the appointment has already happened, so we only
  // record it — no client emails go out (the server enforces this too). Yes =
  // desktop valuation (no visit date); No / Not sure = log it as-is.
  function logPast(row: BookingConfirmRow, outcome: "desktop" | "silent") {
    setBusyId(row.transactionId);
    startTransition(async () => {
      try {
        const res = await confirmProvisionalBookingAction({
          transactionId: row.transactionId,
          milestoneDefinitionId: row.milestoneDefinitionId,
          keyCollectionRequired: false,
          eventDate: null,
          outcome,
        });
        setRows((prev) => prev.filter((r) => r.transactionId !== row.transactionId));
        if (res.ok) {
          const title = outcome === "desktop" ? "Logged as a desktop valuation" : "Logged on the file";
          toast.success(title, { description: `Clients weren't emailed, as the ${row.kind} has already taken place.` });
        } else {
          toast.error("This booking was already handled.");
        }
      } catch {
        toast.error("Couldn't do that. Try again.");
      } finally {
        setBusyId((cur) => (cur === row.transactionId ? null : cur));
      }
    });
  }

  return (
    <GlassCard glassId="hub-attention" label="Hub · Surveys & valuations to confirm" defaultVariant="v27" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="agent-hover-ctl"
        style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: collapsed ? "none" : "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}
      >
        <span aria-hidden style={{ color: ICON_COLOR, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CalendarCheck size={24} weight="regular" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>
              {(() => {
                const s = rows.filter((r) => r.kind === "survey").length;
                const v = rows.length - s;
                const num = (n: number) => <span style={{ color: "var(--agent-coral-deep)", fontWeight: 700 }}>{n}</span>;
                if (v === 0) return <>{num(s)} survey{s !== 1 ? "s" : ""} to confirm</>;
                if (s === 0) return <>{num(v)} valuation{v !== 1 ? "s" : ""} to confirm</>;
                return <>{num(s)} survey{s !== 1 ? "s" : ""} and {num(v)} valuation{v !== 1 ? "s" : ""} to confirm</>;
              })()}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            Logged by clients. Check the date and access, then confirm and we&apos;ll let everyone know.
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", flexShrink: 0 }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* Collapsible body */}
      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          <div ref={listRef}>
            {shown.map((row, i) => {
              const isOpen = openId === row.transactionId;
              const busy = busyId === row.transactionId;
              // A booking whose date has already passed: confirming would email
              // clients about a visit that's gone, so the primary action becomes a
              // silent "Log it" (see PastLogPanel) instead of "Confirm".
              const isPast = !!row.eventDateISO && row.eventDateISO < todayISO();
              const menuItems: RowMenuItem[] = [
                ...(row.kind === "valuation"
                  ? [{
                      key: "desktop",
                      icon: <DesktopTower size={16} weight="bold" />,
                      title: "Desktop valuation (no visit)",
                      sub: "Remote valuation. Buyer told it's desktop; seller not notified.",
                      onClick: () => resolve(row, "desktop"),
                    }]
                  : []),
                {
                  key: "silent",
                  icon: <EnvelopeSimpleOpen size={16} weight="bold" />,
                  title: "Log it, don't email",
                  sub: "Record it on the file. No emails go to clients.",
                  onClick: () => resolve(row, "silent"),
                },
                ...(row.kind === "survey"
                  ? [{
                      key: "notreal",
                      icon: <Prohibit size={16} weight="bold" />,
                      title: "Not a real booking",
                      sub: "Mark the survey not required. Clears it (reversible). No emails.",
                      danger: true,
                      onClick: () => resolve(row, "not_required"),
                    }]
                  : []),
              ];
              return (
                <div
                  key={row.transactionId}
                  style={{ borderLeft: `3px solid ${ACCENT}`, borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                >
                  <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px" }}>
                    <Link href={row.href} className="hub-thumb-link" aria-label={`Open ${row.address}`}>
                      <PropertyThumb photoUrl={row.photoUrl} />
                    </Link>
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <Link href={row.href} className="hub-addr" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 0 }}>
                          <span className="hub-addr-full">{row.address}</span>
                          {(() => { const a = splitAddress(row.address); return (<>
                            <span className="hub-addr-line">{a.line}</span>
                            {a.location && <span className="hub-addr-loc">{a.location}</span>}
                          </>); })()}
                        </Link>
                      </div>
                      {/* Survey / Valuation as a toned status word on its own line,
                          matching the "Needs assigning" treatment on AttentionCard
                          (critique #295 — the inline pill is gone). */}
                      <p style={{ margin: "2px 0 0", fontSize: 10.5, fontWeight: 750, color: "var(--agent-coral-deep)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.pillLabel}
                      </p>
                      <p className="hub-r-meta-d" style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.subtext}
                      </p>
                    </div>

                    {/* Split action: Confirm + ▾ floating menu (shared) */}
                    <div className="hub-r-tail">
                      <span className="hub-r-meta-m" style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>
                        <span>{row.subtext}</span>
                      </span>
                      <div className="hub-r-actions" style={{ display: "inline-flex", flexShrink: 0 }}>
                        {isPast ? (
                          // Past date: a single "Log it" (no chevron). A survey just
                          // logs; a valuation opens a small popup to ask if it was a
                          // desktop valuation. Both log silently (no client emails).
                          row.kind === "survey" ? (
                            <button
                              type="button"
                              onClick={() => logPast(row, "silent")}
                              disabled={busy}
                              className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                            >
                              {busy ? "Logging…" : "Log it"}
                            </button>
                          ) : (
                            <RowActionMenu
                              ariaLabel="Log this valuation"
                              header="Was this a desktop valuation?"
                              trigger={(open) => (
                                <button
                                  type="button"
                                  aria-expanded={open}
                                  disabled={busy}
                                  className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                                >
                                  {busy ? "Logging…" : "Log it"}
                                </button>
                              )}
                              items={[
                                { key: "desktop", icon: <DesktopTower size={16} weight="bold" />, title: "Yes", sub: "Remote valuation, no visit. Logged on the file, no emails.", onClick: () => logPast(row, "desktop") },
                                { key: "visit", icon: <CalendarCheck size={16} weight="bold" />, title: "No", sub: "A standard visit. Logged on the file, no emails.", onClick: () => logPast(row, "silent") },
                                { key: "notsure", icon: <Question size={16} weight="bold" />, title: "Not sure", sub: "Just log it on the file. No emails.", onClick: () => logPast(row, "silent") },
                              ]}
                            />
                          )
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setOpenId(isOpen ? null : row.transactionId)}
                              disabled={busy}
                              className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                            >
                              {isOpen ? "Close" : "Confirm"}
                            </button>
                            <RowActionMenu joined disabled={busy} items={menuItems} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isOpen && !isPast && (
                    <ConfirmPanel
                      row={row}
                      busy={busy}
                      onConfirm={(keys, date) => resolve(row, "confirm", { keys, date })}
                    />
                  )}
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

export function ConfirmPanel({
  row,
  busy,
  onConfirm,
  blockPast = false,
}: {
  row: BookingConfirmRow;
  busy: boolean;
  onConfirm: (keyCollectionRequired: boolean, eventDate: string | null) => void;
  // Surfaces without the ▾ "Log it / Desktop" menu (the Overview card) can't
  // safely confirm a past date, so they set this to block it and point at the hub.
  blockPast?: boolean;
}) {
  const [keys, setKeys] = useState(false);
  const [date, setDate] = useState<string>(row.eventDateISO ?? "");

  const noun = row.kind === "valuation" ? "valuer" : "surveyor";
  const isPast = !!date && date < todayISO();

  return (
    <div className="agent-reveal-in" style={{ padding: "16px 20px 14px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", columnGap: 40, rowGap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 4 }}>
            Appointment date
          </label>
          <DateField
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="glass-input px-2 py-1.5 text-sm"
            wrapperStyle={{ display: "inline-block" }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", fontSize: 13, color: "var(--agent-text-secondary)", paddingBottom: 6 }}>
          <input type="checkbox" checked={keys} onChange={(e) => setKeys(e.target.checked)} />
          {`${noun.charAt(0).toUpperCase()}${noun.slice(1)} collecting keys from us`}
        </label>
      </div>

      {/* Past-date guard: confirming still works, but warn so we don't announce a
          "will attend / access arranged" visit for a date that's already gone. */}
      {isPast && (
        <p style={{ margin: 0, fontSize: 11.5, color: "#b45309", lineHeight: 1.4 }}>
          {blockPast
            ? "This date has passed. To log a visit that's already taken place without emailing clients, use the Surveys & valuations to confirm card on your hub."
            : <>This date has passed. If it was a remote/desktop valuation or already happened, use the ▾ menu (Desktop valuation / Log it, don&apos;t email) so we don&apos;t email clients about a visit that&apos;s in the past.</>}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onConfirm(keys, date || null)}
          disabled={busy || !date || (blockPast && isPast)}
          className="agent-btn agent-btn-sm agent-btn-color-primary"
          style={{ minWidth: 140 }}
        >
          {busy ? "Confirming…" : "Confirm booking"}
        </button>
      </div>
    </div>
  );
}

