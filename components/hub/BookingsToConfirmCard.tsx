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
import { CalendarCheck, CaretDown, DesktopTower, EnvelopeSimpleOpen, Prohibit } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
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
          <CalendarCheck size={24} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>Surveys &amp; valuations to confirm</span>
            <span style={{ fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "rgba(var(--agent-coral-rgb),0.12)", color: "var(--agent-coral-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {rows.length}
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
                        <Pill glass tone="brand" size="md" style={{ flexShrink: 0 }}>
                          {row.pillLabel}
                        </Pill>
                      </div>
                      <p className="hub-r-meta-d" style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.subtext}
                      </p>
                    </div>

                    {/* Split action: Confirm + ▾ floating menu (shared) */}
                    <div className="hub-r-tail" style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="hub-r-meta-m" style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>
                        <span>{row.subtext}</span>
                      </span>
                      <div className="hub-r-actions" style={{ display: "inline-flex", flexShrink: 0 }}>
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
                      </div>
                    </div>
                  </div>

                  {isOpen && (
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

function ConfirmPanel({
  row,
  busy,
  onConfirm,
}: {
  row: BookingConfirmRow;
  busy: boolean;
  onConfirm: (keyCollectionRequired: boolean, eventDate: string | null) => void;
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
          This date has passed. If it was a remote/desktop valuation or already happened, use the ▾ menu (Desktop valuation / Log it, don&apos;t email) so we don&apos;t email clients about a visit that&apos;s in the past.
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onConfirm(keys, date || null)}
          disabled={busy || !date}
          className="agent-btn agent-btn-sm agent-btn-color-primary"
          style={{ minWidth: 140 }}
        >
          {busy ? "Confirming…" : "Confirm booking"}
        </button>
      </div>
    </div>
  );
}
