"use client";

// Mobile top-bar search (Ellis). On a phone the search is a single icon in the
// bar; tapping it opens a top overlay where the field grows out of the icon to
// the full bar width and a results panel drops down beneath it. Typing filters
// (empty = "Go to"; ≥2 chars hits the same /api/agent/search the desktop
// palette uses). The X in the grey circle, selecting a result, or Esc collapse
// it back to the icon.
//
// It is a portal overlay (like AgentGlobalSearch's modal) rather than an in-bar
// transform, so the shipped bar layout is untouched — the overlay simply covers
// it. Desktop keeps AgentGlobalSearch's ⌘K pill + palette; this renders only at
// the mobile breakpoint (md:hidden on its wrapper in AgentShell).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AgentSearchResult } from "@/app/api/agent/search/route";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { ContactAvatar } from "@/components/ui/Avatar";
import { NAV_ITEMS, contactHref, roleLabel, STATUS_LABELS, STATUS_COLORS } from "./AgentGlobalSearch";
import "./AgentMobileSearch.css";

// The overlay is portaled to document.body with data-theme={theme}, which
// resolves --agent-* to the LIGHT palette; inject the dark values when the app
// is in night mode so the surface + text flip (mirrors AgentGlobalSearch).
const DARK_TOKENS: Record<string, string> = {
  "--agent-surface-elevated": "rgba(20, 28, 44, 0.98)",
  "--agent-bg": "#0c1322",
  "--agent-text-primary": "#EFF6FF",
  "--agent-text-secondary": "#C7D3E6",
  "--agent-text-muted": "#94A3B8",
  "--agent-text-disabled": "#64748B",
  "--agent-border-default": "rgba(255,255,255,0.10)",
  "--agent-border-strong": "rgba(255,255,255,0.18)",
  "--agent-hover-shade": "rgba(255,255,255,0.06)",
  "--agent-coral": "#FF7A5E",
};

export function AgentMobileSearch({ showSelfPages = true, className }: { showSelfPages?: boolean; className?: string }) {
  const remindersLocked = !showSelfPages;
  const { theme, isNight } = usePortalTheme();
  const router = useRouter();

  const [open, setOpen] = useState(false);   // overlay mounted
  const [shown, setShown] = useState(false);  // open animation engaged
  const [press, setPress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AgentSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [openW, setOpenW] = useState(320);
  const [barH, setBarH] = useState(56); // the real top bar's height, so the overlay covers it exactly

  const field = useRef<HTMLInputElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const beat = useRef<number>(0);
  const burst = useRef<number>(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shut = useRef<number>(0);

  useEffect(() => () => {
    window.clearTimeout(beat.current); window.clearTimeout(burst.current); window.clearTimeout(shut.current);
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // ── open / close ──────────────────────────────────────────
  function expand() {
    if (open) return;
    setPress(true);
    window.clearTimeout(beat.current);
    beat.current = window.setTimeout(() => { setPress(false); setOpen(true); }, 90);
  }
  const collapse = useCallback(() => {
    setShown(false);
    setQuery(""); setResults(null); setLoading(false); setSelected(0);
    field.current?.blur();
    window.clearTimeout(shut.current);
    shut.current = window.setTimeout(() => setOpen(false), 320);
  }, []);

  // Measure the bar's inner width (the field's open target) once mounted, and
  // engage the open animation a frame later so the width transition plays.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = bar.current;
      if (!el) return;
      const cs = getComputedStyle(el);
      setOpenW(Math.max(160, el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)));
      // Cover down to just below whichever top chrome is live — the experimental
      // floating command bar (.agx-cap, ~top:14) or the standard topbar.
      const tb = document.querySelector(".agx-cap") ?? document.querySelector(".agent-topbar");
      if (tb) setBarH(Math.ceil((tb as HTMLElement).getBoundingClientRect().bottom + 4));
    };
    measure();
    const raf = requestAnimationFrame(() => { setShown(true); requestAnimationFrame(() => field.current?.focus()); });
    const ro = new ResizeObserver(measure);
    if (bar.current) ro.observe(bar.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [open]);

  // Esc closes while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") collapse(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, collapse]);

  // ── the search — same contract as AgentGlobalSearch ───────
  const runSearch = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agent/search?q=${encodeURIComponent(q)}`);
        const data: AgentSearchResult = await res.json();
        setResults(data); setSelected(0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 220);
  }, []);

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setSelected(0);
    runSearch(e.target.value);
    setBusy(true);
    window.clearTimeout(burst.current);
    burst.current = window.setTimeout(() => setBusy(false), 340);
  }

  // Flat list for keyboard nav + the empty/results branches.
  const flat: { href: string }[] = useMemo(() => {
    const out: { href: string }[] = [];
    if (query.length === 0) NAV_ITEMS.forEach((n) => out.push({ href: n.href }));
    else if (results) {
      results.transactions.forEach((t) => out.push({ href: `/agent/transactions/${t.id}` }));
      results.contacts.forEach((c) => out.push({ href: contactHref(c) }));
      results.solicitors.forEach(() => out.push({ href: `/agent/solicitors` }));
    }
    return out;
  }, [query, results]);

  const navigate = useCallback((href: string) => {
    if (remindersLocked && href === "/agent/work-queue") return; // locked destination — no-op
    collapse();
    router.push(href);
  }, [remindersLocked, collapse, router]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && selected >= 0 && flat[selected]) { e.preventDefault(); navigate(flat[selected].href); }
  }

  const hasResults = results && results.transactions.length + results.contacts.length + results.solicitors.length > 0;

  return (
    <>
      {/* the trigger — a 40px icon in the bar (mobile only via the wrapper) */}
      <button
        type="button"
        className={`ams-trigger${className ? " " + className : ""}`}
        aria-label="Search"
        data-press={press || undefined}
        onClick={expand}
      >
        <svg viewBox="0 0 18 18" width="19" height="19" aria-hidden><circle cx="7.6" cy="7.6" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11.6 11.6 L15.4 15.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>

      {open && createPortal(
        <div
          className="ams-ov"
          data-shown={shown || undefined}
          data-busy={busy || undefined}
          data-theme={theme}
          style={{ ...(isNight ? (DARK_TOKENS as CSSProperties) : null), "--open-w": `${openW}px`, "--bar-h": `${barH}px` } as CSSProperties}
        >
          <button className="ams-scrim" aria-label="Close search" onClick={collapse} />

          <div className="ams-bar" ref={bar}>
            <div className="ams-field-box">
              <svg className="ams-lens" viewBox="0 0 18 18" aria-hidden><circle cx="7.6" cy="7.6" r="5.4" /><path d="M11.6 11.6 L15.4 15.4" /></svg>
              <input
                ref={field}
                className="ams-field"
                type="text"
                value={query}
                onChange={onInput}
                onKeyDown={onKeyDown}
                placeholder="Search addresses, clients, solicitors…"
                aria-label="Search"
              />
              {loading && <span className="ams-spin" aria-hidden />}
              <button className="ams-clear" aria-label="Close search" onClick={collapse}>
                <svg viewBox="0 0 16 16" width="13" height="13"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>

          <div className="ams-drop" role="listbox" aria-label="Search results">
            {/* empty query → Go to */}
            {query.length === 0 && (
              <Section label="Go to">
                {NAV_ITEMS.map((n, i) => (
                  <Row
                    key={n.href}
                    label={n.label}
                    sub={n.sub}
                    selected={selected === i}
                    locked={remindersLocked && n.href === "/agent/work-queue"}
                    onSelect={() => navigate(n.href)}
                    onHover={() => setSelected(i)}
                  />
                ))}
              </Section>
            )}

            {/* results */}
            {query.length > 0 && hasResults && (
              <>
                {results!.transactions.length > 0 && (
                  <Section label="Files">
                    {results!.transactions.map((t, i) => (
                      <Row
                        key={t.id}
                        label={t.address}
                        pill={{ label: STATUS_LABELS[t.status] ?? t.status, color: STATUS_COLORS[t.status] ?? "#94a3b8" }}
                        left={<Thumb url={t.photoUrl} />}
                        selected={selected === i}
                        onSelect={() => navigate(`/agent/transactions/${t.id}`)}
                        onHover={() => setSelected(i)}
                      />
                    ))}
                  </Section>
                )}
                {results!.contacts.length > 0 && (
                  <Section label="Clients">
                    {results!.contacts.map((c, i) => {
                      const idx = results!.transactions.length + i;
                      const sub = c.previousSale
                        ? `${roleLabel(c.role)} · Sale ${c.previousSale.roundNumber} · fell through`
                        : `${roleLabel(c.role)} · ${c.address}`;
                      return (
                        <Row
                          key={c.id}
                          label={c.name}
                          sub={sub}
                          subColor={c.previousSale ? "var(--agent-danger, #C73E3E)" : undefined}
                          left={<ContactAvatar contact={{ name: c.name, roleType: c.role }} size={32} image={c.avatarUrl} />}
                          selected={selected === idx}
                          onSelect={() => navigate(contactHref(c))}
                          onHover={() => setSelected(idx)}
                        />
                      );
                    })}
                  </Section>
                )}
                {results!.solicitors.length > 0 && (
                  <Section label="Solicitors">
                    {results!.solicitors.map((s, i) => {
                      const idx = results!.transactions.length + results!.contacts.length + i;
                      return (
                        <Row
                          key={s.id}
                          label={s.name}
                          sub={`${s.fileCount} file${s.fileCount !== 1 ? "s" : ""} on record`}
                          left={<ContactAvatar contact={{ name: s.name, roleType: "solicitor" }} size={32} />}
                          selected={selected === idx}
                          onSelect={() => navigate(`/agent/solicitors`)}
                          onHover={() => setSelected(idx)}
                        />
                      );
                    })}
                  </Section>
                )}
              </>
            )}

            {/* no results */}
            {query.length > 0 && results && !hasResults && (
              <div className="ams-empty">No results for “{query}”</div>
            )}

            <div className="ams-foot">↑↓ navigate · ↵ go · Esc close</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="ams-thumb">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" aria-hidden />
      ) : (
        <span className="property-photo-fallback" aria-hidden />
      )}
    </span>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ams-group">
      <div className="ams-group-h">{label}</div>
      {children}
    </div>
  );
}

function Row({
  label, sub, subColor, pill, left, selected, locked, onSelect, onHover,
}: {
  label: string;
  sub?: React.ReactNode;
  subColor?: string;
  pill?: { label: string; color: string };
  left?: React.ReactNode;
  selected: boolean;
  locked?: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={locked || undefined}
      className="ams-row"
      data-sel={selected || undefined}
      data-locked={locked || undefined}
      onClick={locked ? undefined : onSelect}
      onMouseEnter={onHover}
    >
      {left && <span className="ams-row-left">{left}</span>}
      <span className="ams-row-text">
        <span className="ams-row-label">{label}</span>
        {pill ? (
          <span className="ams-row-pill" style={{ color: pill.color }}>
            <span className="ams-row-pill-dot" style={{ background: pill.color }} />
            {pill.label}
          </span>
        ) : sub ? (
          <span className="ams-row-sub" style={subColor ? { color: subColor } : undefined}>{sub}</span>
        ) : null}
      </span>
      {locked ? (
        <svg className="ams-row-go" viewBox="0 0 24 24" width="15" height="15" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 11V7a4 4 0 118 0v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      ) : (
        <svg className="ams-row-go" viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}
