"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AgentSearchResult } from "@/app/api/agent/search/route";

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_hold: "On Hold", completed: "Completed", withdrawn: "Withdrawn",
};
const STATUS_COLORS: Record<string, string> = {
  active: "#16a34a", on_hold: "#d97706", completed: "#2563eb", withdrawn: "#94a3b8",
};

const NAV_ITEMS = [
  { label: "Hub",          href: "/agent/hub",              sub: "Your pipeline overview"        },
  { label: "Reminders",    href: "/agent/work-queue",       sub: "Due and overdue chasers"       },
  { label: "Completions",  href: "/agent/completions",      sub: "Files ready to complete"       },
  { label: "My Files",     href: "/agent/dashboard",        sub: "All your property files"       },
  { label: "Updates",      href: "/agent/comms",            sub: "Portal activity"               },
  { label: "Analytics",    href: "/agent/analytics",        sub: "Pipeline and fee data"         },
  { label: "New sale",     href: "/agent/transactions/new", sub: "Register a new property"       },
];

export function AgentGlobalSearch() {
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
      setQuery(""); setResults(null); setSelected(0);
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

  function onKeyDown(e: React.KeyboardEvent) {
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); navigate(flat[selected].href); }
  }

  const hasResults = results && (results.transactions.length + results.contacts.length + results.solicitors.length) > 0;

  // Closed state — a compact trigger button that fits in the sidebar
  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      title="Search (⌘K)"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer",
        background: "rgba(255,255,255,0.35)", color: "var(--agent-text-muted)",
        fontSize: 12, transition: "background 150ms",
      }}
      className="hover:bg-white/60"
    >
      <svg style={{ width: 14, height: 14, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
      </svg>
      <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
      <span style={{
        fontSize: 10, fontWeight: 500,
        background: "rgba(255,255,255,0.50)", border: "0.5px solid rgba(255,255,255,0.60)",
        borderRadius: 4, padding: "1px 5px", letterSpacing: "0.02em",
      }}>
        ⌘K
      </span>
    </button>
  );

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "15vh" }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,5,0,0.45)", backdropFilter: "blur(4px)" }} />

      {/* Modal */}
      <div
        style={{
          position: "relative", width: "100%", maxWidth: 560, margin: "0 16px",
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(255,107,74,0.15)",
          background: "rgba(255,250,246,0.98)", backdropFilter: "blur(24px)",
          border: "0.5px solid rgba(255,138,101,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", borderBottom: "0.5px solid rgba(255,138,101,0.15)",
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
              flex: 1, fontSize: 15, color: "var(--agent-text-primary)",
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
                />
              ))}
            </SearchSection>
            <p style={{ fontSize: 11, color: "var(--agent-text-muted)", padding: "10px 16px", borderTop: "0.5px solid rgba(255,138,101,0.10)" }}>
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
                    sub={STATUS_LABELS[t.status] ?? t.status}
                    subColor={STATUS_COLORS[t.status]}
                    selected={selected === i}
                    onClick={() => navigate(`/agent/transactions/${t.id}`)}
                  />
                ))}
              </SearchSection>
            )}
            {results!.contacts.length > 0 && (
              <SearchSection label="Clients">
                {results!.contacts.map((c, i) => (
                  <SearchRow
                    key={c.id}
                    label={c.name}
                    sub={`${c.role} · ${c.address}`}
                    selected={selected === results!.transactions.length + i}
                    onClick={() => navigate(`/agent/transactions/${c.transactionId}`)}
                  />
                ))}
              </SearchSection>
            )}
            {results!.solicitors.length > 0 && (
              <SearchSection label="Solicitors">
                {results!.solicitors.map((s, i) => (
                  <SearchRow
                    key={s.id}
                    label={s.name}
                    sub={`${s.fileCount} file${s.fileCount !== 1 ? "s" : ""} on record`}
                    selected={selected === results!.transactions.length + results!.contacts.length + i}
                    onClick={() => navigate(`/agent/solicitors`)}
                  />
                ))}
              </SearchSection>
            )}
            <p style={{ fontSize: 11, color: "var(--agent-text-muted)", padding: "10px 16px", borderTop: "0.5px solid rgba(255,138,101,0.10)" }}>
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
        borderTop: "0.5px solid rgba(255,138,101,0.10)",
        background: "rgba(255,245,236,0.60)",
        margin: 0,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function SearchRow({
  label, sub, subColor, selected, onClick,
}: {
  label: string; sub: string; subColor?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px", border: "none", cursor: "pointer", textAlign: "left",
        background: selected ? "rgba(255,138,101,0.10)" : "transparent",
        transition: "background 80ms",
        borderLeft: selected ? "2px solid var(--agent-coral)" : "2px solid transparent",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: subColor ?? "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub}
        </p>
      </div>
      {selected && (
        <svg style={{ width: 14, height: 14, color: "var(--agent-coral)", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      )}
    </button>
  );
}
