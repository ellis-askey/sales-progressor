"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MagnifyingGlass,
  ArrowsDownUp,
  CaretDown,
  Phone,
  EnvelopeSimple,
  ArrowSquareOut,
  Check,
} from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";

// Directory of professional partners (conveyancers + mortgage brokers) with
// client-side search, sort and an active-files view filter. The server page
// (app/agent/partners/page.tsx) fetches and scopes the data, attaches per-firm
// intelligence, and hands plain serialisable objects to this component.

type ContactWithFiles = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  activeFiles: { id: string; propertyAddress: string; role?: "vendor" | "purchaser"; isReferral: boolean }[];
};

export type FirmIntel = {
  avgDaysToExchange: number | null;
  income: { receivedPence: number; pendingPence: number; pendingCount: number } | null;
};

export type DirectoryFirm = {
  id: string;
  name: string;
  website?: string | null;
  totalActiveFiles: number;
  referralActiveFiles: number;
  contacts: ContactWithFiles[];
  intel: FirmIntel;
};

type SortKey = "name" | "active" | "exchange";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "active", label: "Most active" },
  { key: "exchange", label: "Fastest exchange" },
];

const CORAL = "var(--agent-coral-deep)";
const CORAL_RGB = "var(--agent-coral-rgb)";

function formatGBP(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function matchesQuery(firm: DirectoryFirm, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (firm.name.toLowerCase().includes(needle)) return true;
  return firm.contacts.some((c) => c.name.toLowerCase().includes(needle));
}

function sortFirms(firms: DirectoryFirm[], key: SortKey): DirectoryFirm[] {
  const copy = [...firms];
  if (key === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (key === "active") {
    copy.sort((a, b) => b.totalActiveFiles - a.totalActiveFiles || a.name.localeCompare(b.name));
  } else {
    copy.sort((a, b) => {
      const av = a.intel.avgDaysToExchange;
      const bv = b.intel.avgDaysToExchange;
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return av - bv || a.name.localeCompare(b.name);
    });
  }
  return copy;
}

export function PartnersDirectory({
  solicitorFirms,
  brokerFirms,
  showIncome,
}: {
  solicitorFirms: DirectoryFirm[];
  brokerFirms: DirectoryFirm[];
  showIncome: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [activeOnly, setActiveOnly] = useState(false);

  // Measured sliding thumb for the view toggle — matches the active segment
  // exactly regardless of the two labels' differing widths.
  const allTabRef = useRef<HTMLButtonElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = activeOnly ? activeTabRef.current : allTabRef.current;
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeOnly]);

  useEffect(() => {
    function measure() {
      const el = activeOnly ? activeTabRef.current : allTabRef.current;
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeOnly]);

  const applyView = useMemo(
    () => (firms: DirectoryFirm[]) =>
      sortFirms(
        firms.filter((f) => matchesQuery(f, query) && (!activeOnly || f.totalActiveFiles > 0)),
        sort,
      ),
    [query, sort, activeOnly],
  );

  const visibleSolicitors = useMemo(() => applyView(solicitorFirms), [applyView, solicitorFirms]);
  const visibleBrokers = useMemo(() => applyView(brokerFirms), [applyView, brokerFirms]);

  const noMatches =
    (query.trim().length > 0 || activeOnly) && visibleSolicitors.length === 0 && visibleBrokers.length === 0;

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Name";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ position: "relative", flex: "1 1 320px", minWidth: 0 }}>
          <MagnifyingGlass size={16} weight="bold" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search firms, contacts or addresses…"
            aria-label="Search partners"
            className="pf-input"
            style={{ paddingLeft: 38 }}
          />
        </label>

        <div className="pf-seg">
          <span className="pf-seg-thumb" aria-hidden style={{ left: thumb.left, width: thumb.width, opacity: thumb.width ? 1 : 0 }} />
          <button ref={allTabRef} type="button" onClick={() => setActiveOnly(false)} aria-pressed={!activeOnly} className={`pf-seg-tab${!activeOnly ? " is-active" : ""}`}>
            All firms
          </button>
          <button ref={activeTabRef} type="button" onClick={() => setActiveOnly(true)} aria-pressed={activeOnly} className={`pf-seg-tab${activeOnly ? " is-active" : ""}`}>
            With active files
          </button>
        </div>

        <Popover
          placement="bottom-end"
          trigger={(open) => (
            <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 7 }} aria-haspopup="menu" aria-expanded={open}>
              <ArrowsDownUp size={14} weight="bold" /> Sort: {sortLabel}
              <CaretDown size={12} weight="bold" style={{ transition: "transform .18s ease", transform: open ? "rotate(180deg)" : "none" }} />
            </button>
          )}
        >
          {(close) =>
            SORTS.map((s) => (
              <PopoverMenuItem
                key={s.key}
                icon={s.key === sort ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                onClick={() => { setSort(s.key); close(); }}
              >
                {s.label}
              </PopoverMenuItem>
            ))
          }
        </Popover>
      </div>

      {noMatches ? (
        <div className="agent-glass-strong" style={{ padding: "36px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            {query.trim() ? <>No partners match &ldquo;{query}&rdquo;</> : "No firms with active files"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
            Try a firm name, a contact&apos;s name, or clear the filter.
          </p>
        </div>
      ) : (
        <>
          {visibleSolicitors.length > 0 && (
            <DirectorySection
              label="Conveyancers"
              subtitle="Solicitor firms and contacts associated with your sales."
              firms={visibleSolicitors}
              kind="solicitor"
              showIncome={showIncome}
            />
          )}
          {visibleBrokers.length > 0 && (
            <DirectorySection
              label="Mortgage brokers"
              subtitle="Mortgage brokers and contacts associated with your sales."
              firms={visibleBrokers}
              kind="broker"
              showIncome={showIncome}
            />
          )}
        </>
      )}

      <style>{`
        .pf-input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:13.5px;border-radius:10px;outline:none;font-family:inherit;color:var(--agent-text-primary);background:var(--agent-surface-elevated);border:1px solid var(--agent-border-default);transition:border-color 140ms ease}
        .pf-input::placeholder{color:var(--agent-text-muted)}
        .pf-input:hover{border-color:var(--agent-coral-deep)}
        .pf-input:focus{border-color:#C0381C}
        .conv-row-head:hover{background:rgba(var(--agent-coral-rgb),0.045)}
        .pf-seg{position:relative;display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:var(--agent-surface-glass);border:1px solid var(--agent-border-subtle)}
        .pf-seg-thumb{position:absolute;top:4px;bottom:4px;border-radius:9px;background:var(--agent-coral-deep);box-shadow:0 2px 8px rgba(var(--agent-coral-rgb),0.30);pointer-events:none;z-index:0;transition:left .24s cubic-bezier(0.4,0,0.2,1),width .24s cubic-bezier(0.4,0,0.2,1),opacity .18s ease}
        .pf-seg-tab{position:relative;z-index:1;padding:7px 14px;border-radius:9px;border:none;cursor:pointer;background:transparent;font-size:13px;font-weight:600;color:var(--agent-text-muted);white-space:nowrap;transition:color .18s ease,background .18s ease}
        .pf-seg-tab:hover:not(.is-active){background:rgba(100,116,139,0.12);color:var(--agent-text-secondary)}
        .pf-seg-tab.is-active{color:#fff}
      `}</style>
    </div>
  );
}

function DirectorySection({
  label,
  subtitle,
  firms,
  kind,
  showIncome,
}: {
  label: string;
  subtitle: string;
  firms: DirectoryFirm[];
  kind: "solicitor" | "broker";
  showIncome: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>{label}</h2>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-muted)" }}>{firms.length} firm{firms.length === 1 ? "" : "s"}</span>
      </div>
      <p style={{ margin: "4px 0 16px", fontSize: 13.5, color: "var(--agent-text-secondary)" }}>{subtitle}</p>

      <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.6fr) minmax(0,0.8fr)", gap: 16, padding: "12px 20px", fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-muted)", borderBottom: "1px solid var(--agent-border-subtle)" }}>
          <span>Firm &amp; contact</span>
          <span>Associated sales</span>
          <span style={{ textAlign: "right" }}>Active files</span>
        </div>
        {firms.map((firm, i) => (
          <FirmRow key={firm.id} firm={firm} kind={kind} showIncome={showIncome} last={i === firms.length - 1} />
        ))}
      </div>
    </div>
  );
}

function IntelPill({ label, tone = "muted" }: { label: string; tone?: "muted" | "success" | "warn" }) {
  const color = tone === "success" ? "var(--agent-success)" : tone === "warn" ? "#b45309" : "var(--agent-text-muted)";
  const bg = tone === "success" ? "var(--agent-success-bg)" : tone === "warn" ? "rgba(180,83,9,0.08)" : "var(--agent-surface-glass)";
  const border = tone === "success" ? "var(--agent-success-border)" : tone === "warn" ? "rgba(180,83,9,0.18)" : "var(--agent-border-default)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, fontVariantNumeric: "tabular-nums" }}>
      {label}
    </span>
  );
}

function FirmRow({ firm, kind, showIncome, last }: { firm: DirectoryFirm; kind: "solicitor" | "broker"; showIncome: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);

  const allFiles = firm.contacts.flatMap((c) => c.activeFiles.map((f) => ({ ...f, contactName: c.name })));
  const contactLine = firm.contacts.length === 0
    ? "No contacts recorded"
    : firm.contacts.length === 1
      ? firm.contacts[0].name
      : `${firm.contacts.length} contacts`;

  const hasAvg = firm.intel.avgDaysToExchange != null;
  const income = firm.intel.income;
  const hasIncome = showIncome && income != null && (income.receivedPence > 0 || income.pendingPence > 0);

  const single = allFiles.length === 1;
  const showSalesList = allFiles.length > 1;

  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--agent-border-subtle)", background: open ? "var(--agent-surface-glass)" : "transparent", transition: "background 140ms ease" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        className="conv-row-head"
        style={{ width: "100%", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.6fr) minmax(0,0.8fr)", gap: 16, alignItems: "center", padding: "14px 20px", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firm.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contactLine}</p>
        </div>
        <div style={{ minWidth: 0, fontSize: 13.5, color: "var(--agent-text-secondary)" }}>
          {allFiles.length === 0 ? (
            <span style={{ color: "var(--agent-text-muted)" }}>No active files</span>
          ) : single ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {allFiles[0].propertyAddress}
                {allFiles[0].role ? <span style={{ color: "var(--agent-text-muted)", textTransform: "capitalize" }}> · {allFiles[0].role}</span> : null}
              </span>
              <Link
                href={`/agent/transactions/${allFiles[0].id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", color: CORAL, flexShrink: 0 }}
                aria-label="Open sale"
              >
                <ArrowSquareOut size={14} weight="bold" />
              </Link>
            </span>
          ) : (
            <span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{allFiles.length} sales</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{firm.totalActiveFiles} active</span>
          <CaretDown size={15} weight="bold" style={{ color: open ? CORAL : "var(--agent-text-muted)", transition: "transform .22s ease, color .18s ease", transform: open ? "rotate(180deg)" : "none" }} />
        </div>
      </div>

      <div className={`agent-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">
        <div style={{ display: "grid", gridTemplateColumns: showSalesList ? "minmax(0,1fr) minmax(0,1.9fr)" : "1fr", gap: 28, padding: "2px 20px 18px" }}>
          <div>
            <p style={{ margin: "0 0 9px", fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>Contact details</p>
            {firm.contacts.length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>No contacts recorded</p>
            )}
            {firm.contacts.map((c) => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                {firm.contacts.length > 1 && (
                  <p style={{ margin: "0 0 3px", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{c.name}</p>
                )}
                {c.email && (
                  <p style={{ margin: "0 0 5px", display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                    <EnvelopeSimple size={15} style={{ color: "var(--agent-text-muted)" }} />
                    <a href={`mailto:${c.email}`} style={{ color: "inherit", textDecoration: "none" }}>{c.email}</a>
                  </p>
                )}
                {c.phone && (
                  <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                    <Phone size={15} style={{ color: "var(--agent-text-muted)" }} />
                    <a href={`tel:${c.phone}`} style={{ color: "inherit", textDecoration: "none" }}>{c.phone}</a>
                  </p>
                )}
                {!c.email && !c.phone && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>No contact details</p>
                )}
              </div>
            ))}
            {(hasAvg || hasIncome) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {hasAvg && <IntelPill label={`${firm.intel.avgDaysToExchange} days avg to exchange`} />}
                {hasIncome && income!.receivedPence > 0 && <IntelPill label={`${formatGBP(income!.receivedPence)} in`} tone="success" />}
                {hasIncome && income!.pendingPence > 0 && <IntelPill label={`${formatGBP(income!.pendingPence)} due`} tone="warn" />}
              </div>
            )}
            <Link href={`/agent/partners/${kind}/${firm.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 12.5, fontWeight: 600, color: CORAL, textDecoration: "none" }}>
              View firm <ArrowSquareOut size={13} weight="bold" />
            </Link>
          </div>
          {showSalesList && (
            <div style={{ borderLeft: "1px solid var(--agent-border-subtle)", paddingLeft: 28 }}>
              <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>Associated sales ({allFiles.length})</p>
              {allFiles.map((f) => (
                <div key={`${f.id}-${f.role ?? "purchaser"}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "7px 0", borderTop: "1px solid var(--agent-border-subtle)" }}>
                  <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.propertyAddress}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    {f.role && <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)", textTransform: "capitalize" }}>{f.role}</span>}
                    <Link href={`/agent/transactions/${f.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", color: CORAL }} aria-label="Open sale">
                      <ArrowSquareOut size={15} weight="bold" />
                    </Link>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
