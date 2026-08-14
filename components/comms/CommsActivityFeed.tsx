"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, Scales, Tag, NotePencil, ChatCircle, Paperclip } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UserAvatar } from "@/components/ui/Avatar";

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Split "15 Bushy Avenue, Broxbourne, EN10 6QE" into the street line and the
// town + postcode line so the header reads like the rest of the app.
function splitAddress(addr: string): { line1: string; line2: string } {
  const [first, ...rest] = addr.split(",");
  return { line1: first.trim(), line2: rest.join(",").trim() };
}

function formatPrice(pence: number): string {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

const STATUS_META: Record<string, { tone: "success" | "warning" | "info" | "muted"; label: string }> = {
  active: { tone: "success", label: "Active" },
  on_hold: { tone: "warning", label: "On hold" },
  completed: { tone: "info", label: "Completed" },
  withdrawn: { tone: "muted", label: "Withdrawn" },
};

function exchangeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Exchange overdue";
  if (days === 0) return "Exchange today";
  if (days < 14) return `~${days}d to exchange`;
  return `~${Math.round(days / 7)} wks to exchange`;
}

export type UpdateKind = "milestone" | "price" | "note" | "reply" | "document";
export type UpdateWho = "agent" | "client" | "solicitor";
export type UpdateSide = "vendor" | "purchaser" | null;

type RowBase = { id: string; atIso: string; who: UpdateWho; side: UpdateSide };

export type UpdateRow =
  | (RowBase & { kind: "milestone"; code: string; sentence: string; byName: string | null; byImage: string | null })
  | (RowBase & { kind: "price"; oldPrice: number | null; newPrice: number; reason: string | null; byName: string | null })
  | (RowBase & { kind: "note"; content: string; byName: string | null; byImage: string | null })
  | (RowBase & { kind: "reply"; content: string; method: string | null; byName: string | null })
  | (RowBase & { kind: "document"; filename: string; mimeType: string; docUrl: string | null; byName: string | null });

export type TxGroup = {
  transactionId: string;
  transactionAddress: string;
  photoUrl: string | null;
  expectedExchangeIso: string | null;
  status: string;
  snapshot: { percent: number; stage: string; nextAction: string | null } | null;
  updates: UpdateRow[];
};

export type DayBucket = {
  label: string;
  txGroups: TxGroup[];
  defaultOpen: boolean;
};

// Small tinted glyph used as the leading marker for the non-milestone update
// kinds (milestones keep the confirmer's avatar, which carries more meaning).
function KindBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        width: 26, height: 26, borderRadius: 999,
        background: "rgba(var(--agent-info-rgb), 0.12)", color: "var(--agent-info)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function Leading({ u }: { u: UpdateRow }) {
  if (u.kind === "milestone" || u.kind === "note") {
    // A step confirmed by us / a note we shared: show the person's avatar.
    if (u.who === "agent") {
      return <UserAvatar user={{ name: u.byName ?? "", image: u.byImage }} size={26} className="flex-shrink-0" />;
    }
    if (u.who === "client") {
      // The client's own photo if they've uploaded one (audit #16 phase 2),
      // otherwise the generic silhouette.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={u.byImage || "/client-avatar-fallback.png"} alt="" aria-hidden width={26} height={26} style={{ borderRadius: 999, flexShrink: 0, display: "block", objectFit: "cover" }} />;
    }
    return (
      <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(var(--agent-info-rgb), 0.12)", color: "var(--agent-info)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Scales size={14} weight="regular" />
      </span>
    );
  }
  if (u.kind === "price") return <KindBadge><Tag size={14} weight="regular" /></KindBadge>;
  if (u.kind === "reply") return <KindBadge><ChatCircle size={14} weight="regular" /></KindBadge>;
  return <KindBadge><Paperclip size={14} weight="regular" /></KindBadge>;
}

function UpdateLine({ u, first }: { u: UpdateRow; first: boolean }) {
  const when = relativeDate(u.atIso);
  const muted = "var(--agent-text-muted)";
  const primary = "var(--agent-text-primary)";

  // Main + optional secondary text per kind.
  let main: React.ReactNode;
  let secondary: string | null = null;

  if (u.kind === "milestone") {
    main = u.sentence;
  } else if (u.kind === "price") {
    main = u.oldPrice != null
      ? `Price changed from ${formatPrice(u.oldPrice)} to ${formatPrice(u.newPrice)}`
      : `Price set to ${formatPrice(u.newPrice)}`;
    secondary = u.reason?.trim() || null;
  } else if (u.kind === "note") {
    main = u.content;
  } else if (u.kind === "reply") {
    main = `${u.byName ?? "Someone"} replied${u.method ? ` by ${u.method}` : ""}`;
    secondary = u.content?.trim() || null;
  } else {
    // document
    const label = `${u.byName ?? "Your team"} uploaded ${u.filename}`;
    main = u.docUrl ? (
      <a href={u.docUrl} target="_blank" rel="noopener noreferrer" style={{ color: primary, textDecoration: "underline", textUnderlineOffset: 2 }}>
        {label}
      </a>
    ) : label;
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3" style={{ borderTop: first ? undefined : "0.5px solid var(--agent-border-subtle)" }}>
      <Leading u={u} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium" style={{ color: primary, lineHeight: 1.4 }}>{main}</p>
        {u.kind === "note" && (
          <p className="text-[10.5px]" style={{ color: muted, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Shared with client</p>
        )}
        {secondary && (
          <p className="text-[12px]" style={{ color: muted, marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {secondary}
          </p>
        )}
        <p className="text-[11px]" style={{ color: muted, marginTop: 2 }}>{when}</p>
      </div>
    </div>
  );
}

function TxCard({ tx }: { tx: TxGroup }) {
  const { line1, line2 } = splitAddress(tx.transactionAddress);
  const status = STATUS_META[tx.status];
  const exchange = exchangeLabel(tx.expectedExchangeIso);
  const snap = tx.snapshot;

  return (
    <div className="agent-glass overflow-hidden rounded-[12px]" style={{ border: "0.5px solid var(--agent-border-subtle)" }}>
      {/* Header: photo + address, with a light file snapshot on the right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderBottom: "0.5px solid var(--agent-border-subtle)",
        }}
      >
        <Link
          href={`/agent/transactions/${tx.transactionId}`}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textDecoration: "none" }}
        >
          <PropertyThumb photoUrl={tx.photoUrl} size={56} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {line1}
            </span>
            {line2 && (
              <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {line2}
              </span>
            )}
          </span>
        </Link>
        {/* File snapshot: status + progress, stage · exchange, next step.
            Hidden on the narrowest screens so the address keeps its room. */}
        <div className="hidden sm:flex" style={{ flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0, minWidth: 150 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {status && <Pill glass tone={status.tone} size="sm">{status.label}</Pill>}
            {snap && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{snap.percent}%</span>}
          </div>
          {snap && (
            <div style={{ width: 132, height: 4, borderRadius: 999, background: "var(--agent-hero-track, rgba(15,23,42,0.08))", overflow: "hidden" }}>
              <div style={{ width: `${snap.percent}%`, height: "100%", borderRadius: 999, background: "var(--agent-coral)" }} />
            </div>
          )}
          <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", textAlign: "right" }}>
            {snap?.stage ?? ""}{snap?.stage && exchange ? " · " : ""}{exchange ?? ""}
          </span>
          {snap?.nextAction && (
            <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", textAlign: "right", maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Next: {snap.nextAction.replace(/\.$/, "")}
            </span>
          )}
        </div>
      </div>

      {/* Updates */}
      <div>
        {tx.updates.map((u, i) => <UpdateLine key={`${u.kind}-${u.id}`} u={u} first={i === 0} />)}
      </div>
    </div>
  );
}

export function CommsActivityFeed({ days }: { days: DayBucket[] }) {
  // openDays: true = open, false = closed.
  // "Today" and "Yesterday" default open; all other labels default closed.
  const [openDays, setOpenDays] = useState<Record<string, boolean>>(
    Object.fromEntries(days.map((d) => [d.label, d.defaultOpen]))
  );

  function toggle(label: string) {
    setOpenDays((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div className="space-y-4">
      {days.map((d) => {
        const { label, txGroups } = d;
        const open = openDays[label] ?? d.defaultOpen;
        const updateCount = txGroups.reduce((n, t) => n + t.updates.length, 0);
        const countLabel = `${updateCount} update${updateCount !== 1 ? "s" : ""}`;

        return (
          <div key={label} className="agent-glass" style={{ overflow: "hidden", borderRadius: "var(--agent-radius-xl)" }}>
            <div
              className="agent-acc-hdr"
              role="button"
              tabIndex={0}
              onClick={() => toggle(label)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(label); } }}
            >
              <span className="agent-acc-title">{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="agent-acc-summary">{countLabel}</span>
                <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 200ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
              </div>
            </div>

            <div className={`agent-acc${open ? " open" : ""}`}>
              <div className="agent-acc-in">
                <div className="agent-acc-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {txGroups.map((tx) => <TxCard key={tx.transactionId} tx={tx} />)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
