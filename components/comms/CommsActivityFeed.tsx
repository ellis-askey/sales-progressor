"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Tag, ChatCircle, Paperclip, Bell, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { UserAvatar, ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import { SectionDisclosure } from "@/components/ui/SectionDisclosure";
import { FilterRail, FilterDropdowns, type FilterRailGroup } from "@/components/ui/FilterRail";
import { IconChip } from "@/components/ui/IconChip";
import { ActivityRow } from "@/components/ui/ActivityRow";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
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
  if (u.kind === "price") return <IconChip><Tag size={14} weight="regular" /></IconChip>;
  if (u.kind === "reply") return <IconChip><ChatCircle size={14} weight="regular" /></IconChip>;
  if (u.kind === "notification") return <IconChip><Bell size={14} weight="regular" /></IconChip>;
  return <IconChip><Paperclip size={14} weight="regular" /></IconChip>;
}

function UpdateLine({ u, first }: { u: UpdateRow; first: boolean }) {
  const when = relativeDate(u.atIso);

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
    // document — the filename is the canonical link (coral hover + focus ring)
    const label = `${u.byName ?? "Your team"} uploaded ${u.filename}`;
    main = u.docUrl ? (
      <a href={u.docUrl} target="_blank" rel="noopener noreferrer" className="agent-link">{label}</a>
    ) : label;
  }

  const meta =
    u.kind === "note" ? <p className="agent-eyebrow" style={{ margin: "2px 0 0" }}>Shared with client</p>
    : u.kind === "notification" && u.pill ? <p className="agent-eyebrow" style={{ margin: "2px 0 0" }}>{u.pill}</p>
    : null;

  return <ActivityRow leading={<Leading u={u} />} main={main} meta={meta} secondary={secondary} time={when} first={first} />;
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

  const tag = useGlassTag("updates-tx-card", "Updates · file card", { light: "cs-b7c9ec28", dark: "cs-053799eb" });
  return (
    <div className={`agent-glass overflow-hidden rounded-[12px] ${tag.className}`} {...tag.props} style={{ border: "0.5px solid var(--agent-border-subtle)" }}>
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
          <PropertyThumb photoUrl={tx.photoUrl} size={48} />
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
          {snap && <ProgressBar percent={snap.percent} width={132} />}
          <span style={{ fontSize: "var(--agent-text-micro)", color: "var(--agent-text-muted)", textAlign: "right" }}>
            {snap?.stage ?? ""}{snap?.stage && exchange ? " · " : ""}{exchange ?? ""}
          </span>
          {snap?.nextAction && (
            <span style={{ fontSize: "var(--agent-text-micro)", color: "var(--agent-text-muted)", textAlign: "right", maxWidth: 260, lineHeight: 1.35 }}>
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
// Page layout only — the rail chrome lives in the canonical FilterRail now.
const CF_STYLES = `
  .cf-layout { display:grid; grid-template-columns:1fr; gap:16px; }
  @media (min-width:900px){ .cf-layout { grid-template-columns:236px minmax(0,1fr); align-items:start; } .cf-side { position:sticky; top:16px; } .cf-drops-wrap { display:none; } }
  @media (max-width:899px){ .cf-rail-wrap { display:none; } }
  .cf-side-foot { display:flex; align-items:center; gap:12px; padding:10px 4px 2px; }
  .cf-count { font-size:var(--agent-text-caption); color:var(--agent-text-muted); font-variant-numeric:tabular-nums; }
`;

export function CommsActivityFeed({ days }: { days: DayBucket[] }) {
  // openDays holds ONLY days the user has explicitly toggled (true = open,
  // false = closed). Empty until they click, so the fallback below can apply
  // "auto-open while filtering / defaultOpen otherwise" — and a manual toggle
  // always wins over it (previously a filter hard-locked every day open, so
  // clicking a header did nothing).
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  // Free-text address search (partial, case-insensitive, matches anywhere — so
  // "walk" finds "36 Nathaniels Walk"). Combines with the filters via AND.
  const [query, setQuery] = useState("");

  // Filters. Empty set in a group = "all" for that group. Groups combine with AND.
  const [types, setTypes] = useState<Set<UpdateKind>>(new Set());
  const [whos, setWhos] = useState<Set<UpdateWho>>(new Set());
  const [sides, setSides] = useState<Set<"vendor" | "purchaser">>(new Set());
  const [stages, setStages] = useState<Set<DisplayStageKey>>(new Set());

  const router = useRouter();
  const pathname = usePathname();
  // hydrated gates the URL sync until we've read the URL. (The rail's own open
  // state lives inside the canonical FilterRail.)
  const hydrated = useRef(false);
  const railTag = useGlassTag("updates-filter-rail", "Updates · filter rail", { dark: "v05" });

  function toggleIn<T>(setter: Dispatch<SetStateAction<Set<T>>>) {
    return (k: T) => setter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }
  function clearAll() { setTypes(new Set()); setWhos(new Set()); setSides(new Set()); setStages(new Set()); setQuery(""); }
  const q = query.trim().toLowerCase();
  const filterActive = types.size > 0 || whos.size > 0 || sides.size > 0 || stages.size > 0 || q.length > 0;

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

  // One shape drives both the rail and the dropdowns. Sets/keys are cast to
  // strings — the components only ever pass back keys from `options`.
  const railGroups: FilterRailGroup[] = [
    { key: "type",  heading: "Type",  options: TYPE_OPTIONS as { key: string; label: string }[],  selected: types as Set<string>,  onToggle: (k) => toggleIn(setTypes)(k as UpdateKind) },
    { key: "who",   heading: "Who",   options: WHO_OPTIONS as { key: string; label: string }[],   selected: whos as Set<string>,   onToggle: (k) => toggleIn(setWhos)(k as UpdateWho) },
    { key: "side",  heading: "Side",  options: SIDE_OPTIONS as { key: string; label: string }[],  selected: sides as Set<string>,  onToggle: (k) => toggleIn(setSides)(k as "vendor" | "purchaser") },
    { key: "stage", heading: "Stage", options: STAGE_OPTIONS as { key: string; label: string }[], selected: stages as Set<string>, onToggle: (k) => toggleIn(setStages)(k as DisplayStageKey) },
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

  // Apply the search + filters, dropping empty cards and empty days. The search
  // matches the address substring (any part), so a file drops out entirely when
  // its address doesn't contain the query.
  const visibleDays: DayBucket[] = days
    .map((d) => ({
      ...d,
      txGroups: d.txGroups
        .filter((tx) => !q || tx.transactionAddress.toLowerCase().includes(q))
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
        <aside className="cf-side agent-bloom">
          {/* Wide screens: the canonical FilterRail. Small screens: its dropdown fallback. */}
          <div className="cf-rail-wrap">
            <FilterRail groups={railGroups} railClassName={railTag.className} railProps={railTag.props} />
          </div>
          <div className="cf-drops-wrap">
            <FilterDropdowns groups={railGroups} />
          </div>
          <div className="cf-side-foot">
            <span className="cf-count">
              {filterActive ? `Showing ${visibleCount} of ${totalCount}` : `${totalCount} update${totalCount !== 1 ? "s" : ""}`}
            </span>
            {filterActive && (
              <button type="button" onClick={clearAll} className="agent-link">Clear</button>
            )}
          </div>
        </aside>

        <div className="cf-feed space-y-4 agent-bloom-stagger">

      {/* Address search — sits above the day buckets. Partial match, any part.
          Canonical agent-input with a leading magnifier and the canonical clear
          control (agent-icon-btn) on the right while there's a query. */}
      <div style={{ position: "relative" }}>
        <MagnifyingGlass size={16} weight="regular" aria-hidden style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by address"
          className="agent-input"
          aria-label="Search updates by address"
          style={{ paddingLeft: 38, paddingRight: query ? 40 : 14 }}
        />
        {query && (
          <button type="button" className="agent-icon-btn agent-icon-btn-sm" onClick={() => setQuery("")} aria-label="Clear search" style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)" }}>
            <X size={13} weight="bold" />
          </button>
        )}
      </div>

      {filterActive && visibleDays.length === 0 && (
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-lg)", padding: "12px 24px 20px" }}>
          <EmptyState
            icon={<MagnifyingGlass size={24} weight="regular" />}
            title="No matching updates"
            description="Try adjusting your search or filters to find what you're looking for."
            action={<button type="button" onClick={clearAll} className="agent-btn agent-btn-primary agent-btn-sm">Clear filters</button>}
          />
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
          <SectionDisclosure
            key={label}
            label={label}
            right={<span className="agent-acc-summary">{countLabel}</span>}
            open={open}
            onToggle={() => toggle(label, open)}
            glassId="updates-day-bar"
            glassLabel="Updates · day bar"
          >
            {txGroups.map((tx) => <TxCard key={tx.transactionId} tx={tx} />)}
          </SectionDisclosure>
        );
      })}
        </div>
      </div>
    </>
  );
}
