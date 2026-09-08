"use client";

// Hub card: provisional survey / lender-valuation bookings a client logged on
// their portal that our side hasn't confirmed yet. Built to match HubListCard
// (full-width flush rows, left accent bar + tint, real photo with house-glyph
// fallback, slide open/close, auto-animated row removal). Unlike the gone-quiet
// / mortgage cards it carries a Confirm flow, not a Dismiss: each row expands to
// an access question (keys from us?) + a date the confirmer can correct, then
// releases the held client emails via confirmProvisionalBookingAction.
//
// Empty list → renders nothing, matching the other lower hub cards.
// See docs/active/booking-reminders/00-plan.md.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { CalendarCheck, HouseSimple, CaretDown } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmProvisionalBookingAction } from "@/app/actions/booking-confirmation";

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
const BG = "var(--agent-coral-bg-tint)";
const ICON_BG = "rgba(var(--agent-coral-base-rgb),0.12)";
const ICON_COLOR = "var(--agent-coral-deep)";

function PropertyThumb({ photoUrl }: { photoUrl: string | null }) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" aria-hidden style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "0.5px solid rgba(15,23,42,0.08)" }} />
    );
  }
  return (
    <span aria-hidden style={{ width: 44, height: 44, borderRadius: 10, background: ICON_BG, color: ICON_COLOR, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `0.5px solid ${ACCENT}` }}>
      <HouseSimple size={20} weight="regular" />
    </span>
  );
}

const INITIAL_VISIBLE = 6;

export function BookingsToConfirmCard({ rows: initialRows }: { rows: BookingConfirmRow[] }) {
  const { toast } = useAgentToast();
  const [rows, setRows] = useState<BookingConfirmRow[]>(initialRows);
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  if (rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - shown.length;

  function confirm(row: BookingConfirmRow, keyCollectionRequired: boolean, eventDate: string | null) {
    setBusyId(row.transactionId);
    startTransition(async () => {
      try {
        const res = await confirmProvisionalBookingAction({
          transactionId: row.transactionId,
          milestoneDefinitionId: row.milestoneDefinitionId,
          keyCollectionRequired,
          eventDate,
        });
        if (res.ok) {
          setRows((prev) => prev.filter((r) => r.transactionId !== row.transactionId));
          toast.success("Booking confirmed", { description: "We've let the client and the seller know." });
        } else {
          toast.error("This booking was already confirmed.");
          setRows((prev) => prev.filter((r) => r.transactionId !== row.transactionId));
        }
      } catch {
        toast.error("Couldn't confirm. Try again.");
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
        style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, background: "transparent", border: "none", borderBottom: collapsed ? "none" : "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}
      >
        <span aria-hidden style={{ width: 34, height: 34, borderRadius: 999, background: ICON_BG, color: ICON_COLOR, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CalendarCheck size={17} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>Surveys &amp; valuations to confirm</span>
            <span style={{ fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "rgba(15,23,42,0.06)", color: "var(--agent-text-secondary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {rows.length}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            A client logged these. Check the date and access, then confirm and we&apos;ll let everyone know.
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
              return (
                <div
                  key={row.transactionId}
                  style={{ borderLeft: `3px solid ${ACCENT}`, background: BG, borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
                >
                  <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px" }}>
                    <PropertyThumb photoUrl={row.photoUrl} />
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <Link href={row.href} className="hover:underline" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.address}
                        </Link>
                        <Pill glass tone="brand" size="md" style={{ flexShrink: 0 }}>
                          {row.pillLabel}
                        </Pill>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.subtext}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : row.transactionId)}
                      disabled={busyId === row.transactionId}
                      className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: "auto" }}
                    >
                      {isOpen ? "Close" : "Confirm"}
                    </button>
                  </div>

                  {isOpen && (
                    <ConfirmPanel
                      row={row}
                      busy={busyId === row.transactionId}
                      onConfirm={(keys, date) => confirm(row, keys, date)}
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

  return (
    <div className="agent-reveal-in" style={{ padding: "0 20px 14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 4 }}>
          Appointment date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="glass-input px-2 py-1.5 text-sm"
        />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", fontSize: 13, color: "var(--agent-text-secondary)" }}>
        <input type="checkbox" checked={keys} onChange={(e) => setKeys(e.target.checked)} />
        {`${noun.charAt(0).toUpperCase()}${noun.slice(1)} collecting keys from us`}
      </label>
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
