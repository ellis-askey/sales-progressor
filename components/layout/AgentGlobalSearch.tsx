"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AgentSearchResult } from "@/app/api/agent/search/route";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { ContactAvatar } from "@/components/ui/Avatar";
import { phoneSearchVariants } from "@/lib/utils";

// Capitalised, friendly role words for the Clients sub-line.
const ROLE_LABELS: Record<string, string> = {
  purchaser: "Purchaser", vendor: "Seller", broker: "Broker", solicitor: "Solicitor", chain_agent: "Agent",
};
function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? (role ? role.charAt(0).toUpperCase() + role.slice(1) : role);
}

// Find the span of a phone string that matches the typed query, tolerant of
// format: the DB stores +44…, agents type 07…/spaces/etc. We match on digits
// (via phoneSearchVariants) and map the hit back to display-string indices so
// the right characters bold. Returns null when nothing matches.
function phoneMatchRange(phone: string, query: string): { start: number; end: number } | null {
  const variants = phoneSearchVariants(query)
    .map((v) => v.replace(/\D/g, ""))
    .filter((v) => v.length >= 4);
  if (!variants.length) return null;
  const digitAt: number[] = []; // digit-index → display-index
  let digits = "";
  for (let i = 0; i < phone.length; i++) {
    if (phone[i] >= "0" && phone[i] <= "9") { digits += phone[i]; digitAt.push(i); }
  }
  let best: { pos: number; len: number } | null = null;
  for (const v of variants) {
    const pos = digits.indexOf(v);
    if (pos >= 0 && (!best || v.length > best.len)) best = { pos, len: v.length };
  }
  if (!best) return null;
  return { start: digitAt[best.pos], end: digitAt[best.pos + best.len - 1] + 1 };
}

// Render `text` with the [start,end) slice bolded (the matched email/phone bit).
function highlight(text: string, range: { start: number; end: number } | null): React.ReactNode {
  if (!range || range.start < 0) return text;
  return (
    <>
      {text.slice(0, range.start)}
      <b style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{text.slice(range.start, range.end)}</b>
      {text.slice(range.end)}
    </>
  );
}

// Small property thumbnail for a Files result — the signed photo, or the
// universal property-photo placeholder when the file has no picture.
function PropertyThumb({ url }: { url: string | null }) {
  return (
    <span style={{ width: 34, height: 34, borderRadius: 8, overflow: "hidden", flexShrink: 0, display: "block", border: url ? "0.5px solid var(--agent-border-subtle)" : "none" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <span className="property-photo-fallback" aria-hidden style={{ display: "block", width: "100%", height: "100%" }} />
      )}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_hold: "On hold", completed: "Completed", withdrawn: "Withdrawn",
};
const STATUS_COLORS: Record<string, string> = {
  active: "#16a34a", on_hold: "#d97706", completed: "#2563eb", withdrawn: "#94a3b8",
};

const NAV_ITEMS = [
  { label: "Hub",          href: "/agent/hub",              sub: "Your pipeline overview"        },
  { label: "Reminders",    href: "/agent/work-queue",       sub: "Due and overdue chasers"       },
  { label: "Completions",  href: "/agent/completions",      sub: "Files ready to complete"       },
  { label: "My Files",     href: "/agent/transactions",     sub: "All your property files"       },
  { label: "Updates",      href: "/agent/comms",            sub: "Portal activity"               },
  { label: "Analytics",    href: "/agent/analytics",        sub: "Pipeline and fee data"         },
  { label: "New sale",     href: "/agent/transactions/new", sub: "Register a new property"       },
];

// The open modal is portaled to document.body with data-theme={AgentTheme}
// (e.g. sunset), so its --agent-* tokens resolve to the LIGHT palette even in
// dark mode. Inject the dark values on the modal root when the app is dark so
// the surface + text flip. (The closed trigger lives in-shell, so it can use
// the tokens directly.)
const DARK_SEARCH_TOKENS: Record<string, string> = {
  "--agent-surface-elevated": "rgba(20, 28, 44, 0.98)",
  "--agent-text-primary": "#EFF6FF",
  "--agent-text-muted": "#94A3B8",
  "--agent-border-subtle": "rgba(255,255,255,0.08)",
  "--agent-coral": "#FF7A5E",
  "--agent-coral-bg-tint": "rgba(255,107,74,0.12)",
  "--agent-coral-base-rgb": "255,107,74",
};

export function AgentGlobalSearch() {
  const { theme, isNight } = usePortalTheme();
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<AgentSearchResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router   = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery(""); setResults(null); setSelected(-1);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agent/search?q=${encodeURIComponent(q)}`);
        const data: AgentSearchResult = await res.json();
        setResults(data); setSelected(0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 220);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    search(e.target.value);
  }

  const flat: { href: string }[] = [];
  if (query.length === 0) {
    NAV_ITEMS.forEach((n) => flat.push({ href: n.href }));
  } else if (results) {
    results.transactions.forEach((t) => flat.push({ href: `/agent/transactions/${t.id}` }));
    results.contacts.forEach((c) => flat.push({ href: `/agent/transactions/${c.transactionId}` }));
    results.solicitors.forEach(() => flat.push({ href: `/agent/solicitors` }));
  }

  function navigate(href: string) { setOpen(false); router.push(href); }

  // Phase 3 perceived-performance (2026-09-18, PERF-16): programmatic
  // router.push gets no automatic prefetch (unlike <Link>), so warm the top
  // few distinct destinations once a result set settles — Enter/click then
  // paints the destination's shell/fallback instantly. Capped at three so
  // per-keystroke result churn never floods the server; dynamic routes only
  // prefetch their static shell + loading boundary, not transaction data,
  // so this exposes nothing the user couldn't already open.
  useEffect(() => {
    const seen = new Set<string>();
    for (const { href } of flat) {
      if (!seen.has(href)) {
        seen.add(href);
        router.prefetch(href);
      }
      if (seen.size >= 3) break;
    }
    // flat is derived from results/query each render; keying on those is
    // equivalent and avoids re-running on unrelated state (selection).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && selected >= 0) { e.preventDefault(); navigate(flat[selected].href); }
  }

  const hasResults = results && (results.transactions.length + results.contacts.length + results.solicitors.length) > 0;

  // Closed state — input-like trigger with white background and hairline border
  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      title="Search (⌘K)"
      style={{
        width: "100%", height: 32, display: "flex", alignItems: "center", gap: 8,
        padding: "0 10px", borderRadius: 8, cursor: "pointer",
        background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-default)",
        color: "var(--agent-text-muted)", fontSize: 12,
        transition: "background 150ms, box-shadow 150ms",
      }}
      className="hover:shadow-sm"
    >
      <svg style={{ width: 14, height: 14, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
      </svg>
      <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
      <span style={{
        fontSize: 10, fontWeight: 500,
        background: "var(--agent-surface-overlay)", border: "0.5px solid var(--agent-border-default)",
        borderRadius: 4, padding: "1px 5px", letterSpacing: "0.02em",
      }}>
        ⌘K
      </span>
    </button>
  );

  return createPortal(
    <div
      data-theme={theme}
      style={{ ...(isNight ? (DARK_SEARCH_TOKENS as CSSProperties) : null), position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh" }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)", backdropFilter: "blur(8px)" }} />

      {/* Modal */}
      <div
        style={{
          position: "relative", width: "100%", maxWidth: 560, margin: "0 16px",
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.12)",
          background: "var(--agent-surface-elevated)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}>
          <svg style={{ width: 18, height: 18, color: "var(--agent-coral)", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={onKeyDown}
            placeholder="Search addresses, clients, solicitors…"
            style={{
              flex: 1, fontSize: "var(--agent-text-body)", color: "var(--agent-text-primary)",
              background: "transparent", border: "none", outline: "none",
            }}
          />
          {loading && (
            <svg style={{ width: 16, height: 16, color: "var(--agent-text-muted)", flexShrink: 0 }} className="animate-spin" fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          <button
            onClick={() => setOpen(false)}
            style={{
              fontSize: 11, color: "var(--agent-text-muted)", border: "0.5px solid var(--agent-border-subtle)",
              borderRadius: 5, padding: "2px 6px", background: "rgba(255,255,255,0.60)", cursor: "pointer",
            }}
          >
            Esc
          </button>
        </div>

        {/* Quick nav — shown when query is empty */}
        {query.length === 0 && (
          <>
            <SearchSection label="Go to">
              {NAV_ITEMS.map((n, i) => (
                <SearchRow
                  key={n.href}
                  label={n.label}
                  sub={n.sub}
                  selected={selected === i}
                  onClick={() => navigate(n.href)}
                  onMouseEnter={() => setSelected(i)}
                />
              ))}
            </SearchSection>
            <p style={{ fontSize: 11, color: "var(--agent-text-muted)", padding: "10px 16px", borderTop: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.10)" }}>
              ↑↓ navigate · ↵ go · Esc close · type to search
            </p>
          </>
        )}

        {/* Search results */}
        {query.length > 0 && hasResults && (
          <>
            {results!.transactions.length > 0 && (
              <SearchSection label="Files">
                {results!.transactions.map((t, i) => (
                  <SearchRow
                    key={t.id}
                    label={t.address}
                    leftVisual={<PropertyThumb url={t.photoUrl} />}
                    subPill={{ label: STATUS_LABELS[t.status] ?? t.status, color: STATUS_COLORS[t.status] ?? "#94a3b8" }}
                    selected={selected === i}
                    onClick={() => navigate(`/agent/transactions/${t.id}`)}
                    onMouseEnter={() => setSelected(i)}
                  />
                ))}
              </SearchSection>
            )}
            {results!.contacts.length > 0 && (
              <SearchSection label="Clients">
                {results!.contacts.map((c, i) => {
                  // GAP-4 labelling: purchaser contacts from a previous
                  // (fell-through) sale render with a "Sale N · fell
                  // through" sub-line and a danger-tinted subColor so the
                  // agent sees at-a-glance that this is historic, but the
                  // row is still findable + clickable (lands them on the
                  // file, where Section 2 already hides the contact from
                  // the live Contacts panel).
                  const role = roleLabel(c.role);
                  const qLower = query.toLowerCase();
                  const nameMatch = c.name.toLowerCase().includes(qLower);
                  // Surface + bold the matched detail ONLY when the search was an
                  // email or phone (i.e. the name itself didn't match) — otherwise
                  // the detail stays hidden and the address shows, same height.
                  const emailIdx = !nameMatch && c.email ? c.email.toLowerCase().indexOf(qLower) : -1;
                  const phoneRange = !nameMatch && emailIdx < 0 && c.phone ? phoneMatchRange(c.phone, query) : null;
                  let sub: React.ReactNode;
                  let subColor: string | undefined;
                  if (c.previousSale) {
                    sub = `${role} · Sale ${c.previousSale.roundNumber} · fell through · ${c.address}`;
                    subColor = "var(--agent-danger, #C73E3E)";
                  } else if (emailIdx >= 0 && c.email) {
                    sub = <>{role} · {highlight(c.email, { start: emailIdx, end: emailIdx + query.length })}</>;
                  } else if (phoneRange && c.phone) {
                    sub = <>{role} · {highlight(c.phone, phoneRange)}</>;
                  } else {
                    sub = `${role} · ${c.address}`;
                  }
                  return (
                    <SearchRow
                      key={c.id}
                      label={c.name}
                      sub={sub}
                      subColor={subColor}
                      leftVisual={<ContactAvatar contact={{ name: c.name, roleType: c.role }} size={34} image={c.avatarUrl} />}
                      selected={selected === results!.transactions.length + i}
                      onClick={() => navigate(`/agent/transactions/${c.transactionId}`)}
                      onMouseEnter={() => setSelected(results!.transactions.length + i)}
                    />
                  );
                })}
              </SearchSection>
            )}
            {results!.solicitors.length > 0 && (
              <SearchSection label="Solicitors">
                {results!.solicitors.map((s, i) => (
                  <SearchRow
                    key={s.id}
                    label={s.name}
                    sub={`${s.fileCount} file${s.fileCount !== 1 ? "s" : ""} on record`}
                    leftVisual={<ContactAvatar contact={{ name: s.name, roleType: "solicitor" }} size={34} />}
                    selected={selected === results!.transactions.length + results!.contacts.length + i}
                    onClick={() => navigate(`/agent/solicitors`)}
                    onMouseEnter={() => setSelected(results!.transactions.length + results!.contacts.length + i)}
                  />
                ))}
              </SearchSection>
            )}
            <p style={{ fontSize: 11, color: "var(--agent-text-muted)", padding: "10px 16px", borderTop: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.10)" }}>
              ↑↓ navigate · ↵ open · Esc close
            </p>
          </>
        )}

        {/* No results */}
        {query.length > 0 && results && !hasResults && (
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>No results for &ldquo;{query}&rdquo;</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function SearchSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--agent-text-muted)", padding: "8px 16px 6px",
        borderTop: "0.5px solid rgba(var(--agent-coral-base-rgb), 0.10)",
        background: "rgba(var(--agent-coral-base-rgb), 0.06)",
        margin: 0,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function SearchRow({
  label, sub, subColor, subPill, leftVisual, selected, onClick, onMouseEnter,
}: {
  label: string; sub?: React.ReactNode; subColor?: string;
  // When set, the sub-line renders as a coloured status pill (Files rows) instead
  // of plain text.
  subPill?: { label: string; color: string };
  // Optional visual before the text — a property thumbnail or a contact avatar.
  leftVisual?: React.ReactNode;
  selected: boolean; onClick: () => void; onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "11px 16px", border: "none", cursor: "pointer", textAlign: "left",
        background: selected ? "var(--agent-coral-bg-tint)" : "transparent",
        transition: "background 80ms",
        borderLeft: selected ? "2px solid var(--agent-coral)" : "2px solid transparent",
      }}
    >
      {leftVisual && <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{leftVisual}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </p>
        {subPill ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 11, fontWeight: 600, color: subPill.color }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: subPill.color,
              // A glossy highlight + soft colour glow so the dot reads as a bead,
              // not a flat disc.
              backgroundImage: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(255,255,255,0) 55%)",
              boxShadow: `0 0 5px ${subPill.color}80, inset 0 -0.5px 1px rgba(0,0,0,0.12)`,
            }} />
            {subPill.label}
          </span>
        ) : sub ? (
          <p style={{ margin: 0, fontSize: 11, color: subColor ?? "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </p>
        ) : null}
      </div>
      {/* Hover chevron — slides in from the right + fades, matching the left
          nav rail (.agent-rail-chevron). Driven by `selected`, which hover sets. */}
      <span
        aria-hidden
        style={{
          display: "inline-flex", flexShrink: 0, color: "var(--agent-coral)",
          opacity: selected ? 1 : 0,
          transform: selected ? "translateX(0)" : "translateX(10px)",
          transition: "opacity 160ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <svg style={{ width: 14, height: 14, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </span>
    </button>
  );
}
