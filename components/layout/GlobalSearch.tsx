"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/app/api/search/route";

const STATUS_LABELS: Record<string, string> = {
  active: "Active", on_hold: "On Hold", completed: "Completed", withdrawn: "Withdrawn",
};
const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-600", on_hold: "text-amber-500",
  completed: "text-blue-500", withdrawn: "text-slate-400",
};

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/dashboard",        sub: "Overview and pipeline",      icon: <NavIcon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
  { label: "Work Queue",      href: "/tasks",            sub: "Pending tasks and reminders", icon: <NavIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
  { label: "To-Do",           href: "/todos",            sub: "Manual tasks and agent requests", icon: <NavIcon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { label: "Analytics",       href: "/analytics",        sub: "Pipeline and fee reporting",  icon: <NavIcon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
  { label: "New Transaction",  href: "/transactions/new", sub: "Add a new property file",     icon: <NavIcon d="M12 4.5v15m7.5-7.5h-15" /> },
];

export function GlobalSearch() {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router   = useRouter();

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(null);
      setSelected(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data: SearchResult = await res.json();
        setResults(data);
        setSelected(0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 220);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    search(e.target.value);
  }

  // Flatten all results for keyboard nav
  const flat: { href: string; label: string; sub: string }[] = [];
  if (query.length === 0) {
    NAV_ITEMS.forEach((n) => flat.push({ href: n.href, label: n.label, sub: n.sub }));
  } else if (results) {
    results.transactions.forEach((t) => flat.push({
      href: `/transactions/${t.id}`,
      label: t.address,
      sub: STATUS_LABELS[t.status] ?? t.status,
    }));
    results.contacts.forEach((c) => flat.push({
      href: `/transactions/${c.transactionId}`,
      label: c.name,
      sub: c.address,
    }));
    results.solicitors.forEach((s) => flat.push({
      href: `/solicitors`,
      label: s.name,
      sub: `${s.fileCount} file${s.fileCount !== 1 ? "s" : ""}`,
    }));
  }

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); navigate(flat[selected].href); }
  }

  const hasResults = results && (results.transactions.length + results.contacts.length + results.solicitors.length) > 0;

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-900/40 hover:text-slate-900/70 hover:bg-white/60 hover:shadow-sm transition-all"
      title="Search (⌘K)"
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
      </svg>
      <span className="flex-1 text-left">Search or navigate…</span>
      <span className="text-[10px] font-medium bg-white/40 border border-white/30 rounded px-1.5 py-0.5 tracking-wide">⌘K</span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl mx-4"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.40), 0 8px 24px rgba(0,0,0,0.20)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-t-2xl border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={onKeyDown}
            placeholder="Search addresses, clients, solicitors…"
            className="flex-1 text-[15px] text-slate-900 placeholder-slate-400 bg-transparent outline-none"
          />
          {loading && (
            <svg className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-[11px] font-medium border border-slate-200 rounded px-1.5 py-0.5">
            Esc
          </button>
        </div>

        {/* Quick nav — shown when query is empty */}
        {query.length === 0 && (
          <div className="bg-white rounded-b-2xl overflow-hidden">
            <Section label="Go to">
              {NAV_ITEMS.map((n, i) => (
                <ResultRow
                  key={n.href}
                  label={n.label}
                  sub={<span className="text-slate-500">{n.sub}</span>}
                  icon={n.icon}
                  selected={selected === i}
                  onClick={() => navigate(n.href)}
                />
              ))}
            </Section>
            <p className="text-[11px] text-slate-400 px-4 py-2.5 border-t border-slate-100">
              ↑↓ to navigate · ↵ to go · Esc to close · type to search
            </p>
          </div>
        )}

        {/* Results */}
        {query.length > 0 && hasResults && (
          <div className="bg-white rounded-b-2xl overflow-hidden">
            {/* Transactions */}
            {results!.transactions.length > 0 && (
              <Section label="Files">
                {results!.transactions.map((t, i) => {
                  const idx = i;
                  return (
                    <ResultRow
                      key={t.id}
                      label={t.address}
                      sub={
                        <span className={STATUS_COLORS[t.status] ?? "text-slate-400"}>
                          {STATUS_LABELS[t.status] ?? t.status}
                          {t.assignedName ? ` · ${t.assignedName}` : ""}
                        </span>
                      }
                      icon={<FileIcon />}
                      selected={selected === idx}
                      onClick={() => navigate(`/transactions/${t.id}`)}
                    />
                  );
                })}
              </Section>
            )}

            {/* Contacts */}
            {results!.contacts.length > 0 && (
              <Section label="Clients">
                {results!.contacts.map((c, i) => {
                  const idx = results!.transactions.length + i;
                  return (
                    <ResultRow
                      key={c.id}
                      label={c.name}
                      sub={<span className="text-slate-500">{c.role} · {c.address}</span>}
                      icon={<PersonIcon />}
                      selected={selected === idx}
                      onClick={() => navigate(`/transactions/${c.transactionId}`)}
                    />
                  );
                })}
              </Section>
            )}

            {/* Solicitors */}
            {results!.solicitors.length > 0 && (
              <Section label="Solicitors">
                {results!.solicitors.map((s, i) => {
                  const idx = results!.transactions.length + results!.contacts.length + i;
                  return (
                    <ResultRow
                      key={s.id}
                      label={s.name}
                      sub={<span className="text-slate-500">{s.fileCount} file{s.fileCount !== 1 ? "s" : ""} on record</span>}
                      icon={<BuildingIcon />}
                      selected={selected === idx}
                      onClick={() => navigate(`/solicitors`)}
                    />
                  );
                })}
              </Section>
            )}

            <p className="text-[11px] text-slate-400 px-4 py-2.5 border-t border-slate-100">
              ↑↓ to navigate · ↵ to open · Esc to close
            </p>
          </div>
        )}

        {/* No results */}
        {query.length > 0 && results && !hasResults && (
          <div className="bg-white rounded-b-2xl px-4 py-8 text-center">
            <p className="text-sm text-slate-400">No results for "{query}"</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 px-4 py-2 border-t border-slate-100 bg-slate-50">
        {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({
  label, sub, icon, selected, onClick,
}: {
  label: string; sub: React.ReactNode; icon: React.ReactNode; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        selected ? "bg-blue-50" : "hover:bg-slate-50"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        selected ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-slate-900 truncate">{label}</p>
        <p className="text-[12px] truncate">{sub}</p>
      </div>
      {selected && (
        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      )}
    </button>
  );
}

function FileIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
    </svg>
  );
}
function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
