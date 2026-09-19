"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { CaretDown, Tag, ChatCircle, Paperclip, Bell } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UserAvatar, ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import { DISPLAY_STAGES, type DisplayStageKey } from "@/lib/milestones/display-stages";

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
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
  if (days < 14) return `about ${days} day${days === 1 ? "" : "s"} to exchange`;
  const weeks = Math.round(days / 7);
  return `about ${weeks} week${weeks === 1 ? "" : "s"} to exchange`;
}

export type UpdateKind = "milestone" | "price" | "note" | "reply" | "document" | "notification";
export type UpdateWho = "agent" | "client" | "helper" | "solicitor";
export type UpdateSide = "vendor" | "purchaser" | null;

type RowBase = { id: string; atIso: string; who: UpdateWho; side: UpdateSide };

export type UpdateRow =
  | (RowBase & { kind: "milestone"; code: string; stageKey: DisplayStageKey | null; sentence: string; byName: string | null; byImage: string | null })
  | (RowBase & { kind: "price"; oldPrice: number | null; newPrice: number; reason: string | null; byName: string | null })
  | (RowBase & { kind: "note"; content: string; byName: string | null; byImage: string | null })
  | (RowBase & { kind: "reply"; content: string })
  | (RowBase & { kind: "document"; filename: string; mimeType: string; docUrl: string | null; byName: string | null })
  | (RowBase & { kind: "notification"; sentence: string; pill: string | null });

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
function KindBadge({ children }: { children: ReactNode }) {
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
    // The client/helper/solicitor's own photo if uploaded (audit #16 phase 2),
    // otherwise the branded, side-tinted fallback: seller blue, buyer green,
    // solicitor a grey id-card. A helper is a person on the side.
    const role: ActorRole =
      u.who === "solicitor" ? "solicitor"
      : u.side === "vendor" ? "seller"
      : u.side === "purchaser" ? "buyer"
      : "other";
    return <ActorAvatar name={u.byName ?? ""} role={role} image={u.byImage} size={26} className="flex-shrink-0" />;
  }
  if (u.kind === "price") return <KindBadge><Tag size={14} weight="regular" /></KindBadge>;
  if (u.kind === "reply") return <KindBadge><ChatCircle size={14} weight="regular" /></KindBadge>;
  if (u.kind === "notification") return <KindBadge><Bell size={14} weight="regular" /></KindBadge>;
  return <KindBadge><Paperclip size={14} weight="regular" /></KindBadge>;
}

function UpdateLine({ u, first }: { u: UpdateRow; first: boolean }) {
  const when = relativeDate(u.atIso);
  const muted = "var(--agent-text-muted)";
  const primary = "var(--agent-text-primary)";

  // Main + optional secondary text per kind.
  let main: ReactNode;
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
    main = "A solicitor replied to our chase";
    secondary = u.content?.trim() || null;
  } else if (u.kind === "notification") {
    main = u.sentence;
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
        {u.kind === "notification" && u.pill && (
          <p className="text-[10.5px]" style={{ color: muted, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{u.pill}</p>
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
  const snap = tx.snapshot;
  // The exchange forecast is only meaningful before exchange. Once a file has
  // exchanged (post-exchange stage) or is completed / withdrawn, drop it — a
  // completed sale showing "Exchange overdue" reads as broken.
  const exchanged = tx.status === "completed" || tx.status === "withdrawn" || snap?.stage === "Post-exchange";
  const exchange = exchanged ? null : exchangeLabel(tx.expectedExchangeIso);

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
            <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", textAlign: "right", maxWidth: 260, lineHeight: 1.35 }}>
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

// ─── Filters ──────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { key: UpdateKind; label: string }[] = [
  { key: "milestone", label: "Steps" },
  { key: "price", label: "Price" },
  { key: "note", label: "Notes" },
  { key: "reply", label: "Replies" },
  { key: "document", label: "Docs" },
  { key: "notification", label: "Alerts" },
];
const WHO_OPTIONS: { key: UpdateWho; label: string }[] = [
  { key: "agent", label: "Us" },
  { key: "client", label: "Client" },
  { key: "solicitor", label: "Solicitor" },
];
const SIDE_OPTIONS: { key: "vendor" | "purchaser"; label: string }[] = [
  { key: "purchaser", label: "Buyer's" },
  { key: "vendor", label: "Seller's" },
];
const STAGE_OPTIONS: { key: DisplayStageKey; label: string }[] = DISPLAY_STAGES.map((s) => ({ key: s.key, label: s.name }));

// Filter chrome: a left rail (collapsible sections + animated checks) on wide
// screens, grouped dropdowns on small. Reuses the app's agent-acc accordion for
// the rail sections; the checkbox strokes its tick in; menu rows use the lift
// hover; the dropdown buttons match the inputs elsewhere (hairline border,
// coral on hover, deeper coral when open, colour-only — the count badge is the
// only "selected" signal). See /agent/comms.
const CF_STYLES = `
  .cf-layout { display:grid; grid-template-columns:1fr; gap:16px; }
  @media (min-width:900px){ .cf-layout { grid-template-columns:236px minmax(0,1fr); align-items:start; } .cf-side { position:sticky; top:16px; } .cf-drops-wrap { display:none; } }
  @media (max-width:899px){ .cf-rail-wrap { display:none; } }
  .cf-rail { background:var(--agent-surface-glass); border:1px solid var(--agent-border-subtle); border-radius:14px; padding:5px; }
  .cf-sec { border-bottom:1px solid var(--agent-border-subtle); }
  .cf-sec:last-child { border-bottom:none; }
  .cf-sec-hdr { display:flex; align-items:center; justify-content:space-between; padding:11px 10px; cursor:pointer; font-size:12px; font-weight:700; color:var(--agent-text-primary); border-radius:8px; transition:background-color .14s ease; user-select:none; }
  .cf-sec-hdr:hover { background-color:var(--agent-hover-tint); }
  .cf-sec .cf-caret { color:var(--agent-text-muted); transition:transform .22s cubic-bezier(.4,0,.2,1); }
  .cf-sec.open .cf-caret { transform:rotate(180deg); }
  .cf-badge { font-size:10px; font-weight:700; color:#fff; background:var(--agent-coral); border-radius:999px; min-width:16px; height:16px; padding:0 5px; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }
  .cf-row { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:7px 9px; border:none; background:none; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; color:var(--agent-text-primary); cursor:pointer; transition:background-color .14s ease, box-shadow .14s ease; }
  .cf-row:hover { background-color:var(--agent-hover-tint); box-shadow:var(--agent-hover-lift); }
  .cf-chk { width:17px; height:17px; border-radius:5px; border:1.5px solid var(--agent-border-strong); flex-shrink:0; position:relative; transition:background-color .18s ease, border-color .18s ease, transform .18s cubic-bezier(.34,1.56,.64,1); }
  .cf-chk svg { position:absolute; inset:0; width:100%; height:100%; display:block; }
  .cf-chk svg path { fill:none; stroke:#fff; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:18; stroke-dashoffset:18; transition:stroke-dashoffset .24s ease .04s; }
  .cf-row[data-on="true"] .cf-chk { background:var(--agent-coral); border-color:var(--agent-coral); transform:scale(1.06); }
  .cf-row[data-on="true"] .cf-chk svg path { stroke-dashoffset:0; }
  .cf-drops { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .cf-dd { position:relative; }
  .cf-dd-btn { display:inline-flex; align-items:center; gap:7px; font-family:inherit; font-size:13px; font-weight:600; color:var(--agent-text-primary); background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:10px; padding:8px 12px; cursor:pointer; transition:border-color .14s ease; }
  .cf-dd-btn:hover { border-color:var(--agent-coral); }
  .cf-dd-btn[data-open="true"] { border-color:var(--agent-coral-deep); }
  .cf-dd-btn .cf-caret { font-size:9px; color:var(--agent-text-muted); transition:transform .22s cubic-bezier(.4,0,.2,1); }
  .cf-dd-btn[data-open="true"] .cf-caret { transform:rotate(180deg); }
  .cf-menu { position:absolute; top:calc(100% + 7px); left:0; z-index:40; min-width:196px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:13px; box-shadow:0 12px 32px rgba(30,45,74,0.16); padding:7px; opacity:0; visibility:hidden; pointer-events:none; transform:translateY(-6px) scale(.98); transform-origin:top left; transition:opacity .16s ease, transform .18s cubic-bezier(.22,1,.36,1), visibility 0s .18s; }
  .cf-menu[data-open="true"] { opacity:1; visibility:visible; pointer-events:auto; transform:none; transition:opacity .16s ease, transform .2s cubic-bezier(.22,1,.36,1); }
  .cf-side-foot { display:flex; align-items:center; gap:12px; padding:10px 4px 2px; }
  .cf-count { font-size:11.5px; color:var(--agent-text-muted); font-variant-numeric:tabular-nums; }
`;

function CheckRows({ options, selected, onToggle }: { options: { key: string; label: string }[]; selected: Set<string>; onToggle: (k: string) => void }) {
  return (
    <>
      {options.map((o) => (
        <button key={o.key} type="button" role="menuitemcheckbox" aria-checked={selected.has(o.key)} className="cf-row" data-on={selected.has(o.key)} onClick={() => onToggle(o.key)}>
          <span className="cf-chk" aria-hidden><svg viewBox="0 0 18 18"><path d="M4.5 9.2l2.7 2.7L13.7 5.6" /></svg></span>
          {o.label}
        </button>
      ))}
    </>
  );
}

function RailSection({ heading, options, selected, onToggle, open, onToggleOpen }: { heading: string; options: { key: string; label: string }[]; selected: Set<string>; onToggle: (k: string) => void; open: boolean; onToggleOpen: () => void }) {
  return (
    <div className={`cf-sec${open ? " open" : ""}`}>
      <div className="cf-sec-hdr" role="button" tabIndex={0} aria-expanded={open} onClick={onToggleOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleOpen(); } }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{heading}{selected.size > 0 && <span className="cf-badge">{selected.size}</span>}</span>
        <CaretDown className="cf-caret" style={{ width: 13, height: 13 }} />
      </div>
      <div className={`agent-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div style={{ padding: "2px 4px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            <CheckRows options={options} selected={selected} onToggle={onToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterDropdown({ heading, options, selected, onToggle, open, onOpenChange }: { heading: string; options: { key: string; label: string }[]; selected: Set<string>; onToggle: (k: string) => void; open: boolean; onOpenChange: (next: boolean) => void }) {
  return (
    <div className="cf-dd">
      <button type="button" className="cf-dd-btn" data-open={open} aria-haspopup="menu" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        {heading}{selected.size > 0 && <span className="cf-badge">{selected.size}</span>}<span className="cf-caret">▼</span>
      </button>
      <div className="cf-menu" data-open={open} role="menu">
        <CheckRows options={options} selected={selected} onToggle={onToggle} />
      </div>
    </div>
  );
}

export function CommsActivityFeed({ days }: { days: DayBucket[] }) {
  // openDays holds ONLY days the user has explicitly toggled (true = open,
  // false = closed). Empty until they click, so the fallback below can apply
  // "auto-open while filtering / defaultOpen otherwise" — and a manual toggle
  // always wins over it (previously a filter hard-locked every day open, so
  // clicking a header did nothing).
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  // Filters. Empty set in a group = "all" for that group. Groups combine with AND.
  const [types, setTypes] = useState<Set<UpdateKind>>(new Set());
  const [whos, setWhos] = useState<Set<UpdateWho>>(new Set());
  const [sides, setSides] = useState<Set<"vendor" | "purchaser">>(new Set());
  const [stages, setStages] = useState<Set<DisplayStageKey>>(new Set());

  const router = useRouter();
  const pathname = usePathname();
  // Rail sections: Type open by default, the rest collapsed. Dropdowns: one open
  // at a time (mobile). hydrated gates the URL sync until we've read the URL.
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({ type: true });
  const [openDd, setOpenDd] = useState<string | null>(null);
  const dropsRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  function toggleIn<T>(setter: Dispatch<SetStateAction<Set<T>>>) {
    return (k: T) => setter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }
  function clearAll() { setTypes(new Set()); setWhos(new Set()); setSides(new Set()); setStages(new Set()); }
  const filterActive = types.size > 0 || whos.size > 0 || sides.size > 0 || stages.size > 0;

  // Hydrate filters from the URL once on mount (?type=&who=&side=&stage=), then
  // keep the URL in sync so a filtered view is shareable and survives refresh.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const rd = (name: string, valid: readonly string[]) =>
      new Set((sp.get(name)?.split(",") ?? []).filter((v) => valid.includes(v)));
    setTypes(rd("type", TYPE_OPTIONS.map((o) => o.key)) as Set<UpdateKind>);
    setWhos(rd("who", WHO_OPTIONS.map((o) => o.key)) as Set<UpdateWho>);
    setSides(rd("side", SIDE_OPTIONS.map((o) => o.key)) as Set<"vendor" | "purchaser">);
    setStages(rd("stage", STAGE_OPTIONS.map((o) => o.key)) as Set<DisplayStageKey>);
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hydrated.current) return; // don't clobber the URL before we've read it
    const p = new URLSearchParams();
    if (types.size) p.set("type", [...types].join(","));
    if (whos.size) p.set("who", [...whos].join(","));
    if (sides.size) p.set("side", [...sides].join(","));
    if (stages.size) p.set("stage", [...stages].join(","));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, whos, sides, stages]);
  useEffect(() => {
    if (!openDd) return;
    const h = (e: MouseEvent) => { if (dropsRef.current && !dropsRef.current.contains(e.target as Node)) setOpenDd(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openDd]);

  // One shape drives both the rail and the dropdowns. Sets/keys are cast to
  // strings — the components only ever pass back keys from `options`.
  const groups: { key: string; heading: string; options: { key: string; label: string }[]; sel: Set<string>; toggle: (k: string) => void }[] = [
    { key: "type",  heading: "Type",  options: TYPE_OPTIONS as { key: string; label: string }[],  sel: types as Set<string>,  toggle: (k) => toggleIn(setTypes)(k as UpdateKind) },
    { key: "who",   heading: "Who",   options: WHO_OPTIONS as { key: string; label: string }[],   sel: whos as Set<string>,   toggle: (k) => toggleIn(setWhos)(k as UpdateWho) },
    { key: "side",  heading: "Side",  options: SIDE_OPTIONS as { key: string; label: string }[],  sel: sides as Set<string>,  toggle: (k) => toggleIn(setSides)(k as "vendor" | "purchaser") },
    { key: "stage", heading: "Stage", options: STAGE_OPTIONS as { key: string; label: string }[], sel: stages as Set<string>, toggle: (k) => toggleIn(setStages)(k as DisplayStageKey) },
  ];

  function passes(u: UpdateRow): boolean {
    if (types.size && !types.has(u.kind)) return false;
    if (whos.size && !whos.has(u.who)) return false;
    // Side only narrows rows that have a side; not-side-specific rows (price,
    // note, reply) always pass rather than vanish.
    if (sides.size && u.side && !sides.has(u.side)) return false;
    // Stage only narrows step confirmations; every other kind passes.
    if (stages.size && u.kind === "milestone" && (!u.stageKey || !stages.has(u.stageKey))) return false;
    return true;
  }

  const totalCount = days.reduce((n, d) => n + d.txGroups.reduce((m, t) => m + t.updates.length, 0), 0);

  // Apply the filter, dropping empty cards and empty days.
  const visibleDays: DayBucket[] = days
    .map((d) => ({
      ...d,
      txGroups: d.txGroups
        .map((tx) => ({ ...tx, updates: tx.updates.filter(passes) }))
        .filter((tx) => tx.updates.length > 0),
    }))
    .filter((d) => d.txGroups.length > 0);
  const visibleCount = visibleDays.reduce((n, d) => n + d.txGroups.reduce((m, t) => m + t.updates.length, 0), 0);

  // Toggle from what's ACTUALLY shown (currentlyOpen), not prev[label] — the
  // latter is undefined until first click, which would mis-flip a day that's
  // open via the filter/default fallback.
  function toggle(label: string, currentlyOpen: boolean) {
    setOpenDays((prev) => ({ ...prev, [label]: !currentlyOpen }));
  }

  return (
    <>
      <style>{CF_STYLES}</style>
      <div className="cf-layout">
        <aside className="cf-side">
          {/* Wide screens: a left rail with collapsible sections. */}
          <div className="cf-rail-wrap">
            <div className="cf-rail">
              {groups.map((g) => (
                <RailSection
                  key={g.key}
                  heading={g.heading}
                  options={g.options}
                  selected={g.sel}
                  onToggle={g.toggle}
                  open={!!openSec[g.key]}
                  onToggleOpen={() => setOpenSec((p) => ({ ...p, [g.key]: !p[g.key] }))}
                />
              ))}
            </div>
          </div>
          {/* Small screens: grouped dropdowns. */}
          <div className="cf-drops-wrap">
            <div className="cf-drops" ref={dropsRef}>
              {groups.map((g) => (
                <FilterDropdown
                  key={g.key}
                  heading={g.heading}
                  options={g.options}
                  selected={g.sel}
                  onToggle={g.toggle}
                  open={openDd === g.key}
                  onOpenChange={(next) => setOpenDd(next ? g.key : null)}
                />
              ))}
            </div>
          </div>
          <div className="cf-side-foot">
            <span className="cf-count">
              {filterActive ? `Showing ${visibleCount} of ${totalCount}` : `${totalCount} update${totalCount !== 1 ? "s" : ""}`}
            </span>
            {filterActive && (
              <button type="button" onClick={clearAll} className="agent-link agent-link-muted">Clear</button>
            )}
          </div>
        </aside>

        <div className="cf-feed space-y-4">

      {filterActive && visibleDays.length === 0 && (
        <div className="agent-glass-strong agent-empty-card" style={{ padding: "32px 24px", textAlign: "center" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--agent-text-muted)" }}>No updates match these filters.</p>
          <button type="button" onClick={clearAll} className="agent-link agent-link-muted">Clear filters</button>
        </div>
      )}

      {visibleDays.map((d) => {
        const { label, txGroups } = d;
        // A manual toggle (openDays[label]) always wins. Otherwise: open every
        // matching day while a filter is on (so results show without expanding),
        // else fall back to the day's default (Today/Yesterday open).
        const open = openDays[label] ?? (filterActive ? true : d.defaultOpen);
        const updateCount = txGroups.reduce((n, t) => n + t.updates.length, 0);
        const countLabel = `${updateCount} update${updateCount !== 1 ? "s" : ""}`;

        return (
          <div key={label} className="agent-glass" style={{ overflow: "hidden", borderRadius: "var(--agent-radius-xl)" }}>
            <div
              className="agent-acc-hdr"
              role="button"
              tabIndex={0}
              onClick={() => toggle(label, open)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(label, open); } }}
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
      </div>
    </>
  );
}
