"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2, Building2, Users, FolderOpen, Briefcase } from "lucide-react";
import type { CommandSearchResult } from "@/app/api/command/search/route";

// Global Command Centre search. Mounted ONCE in the (protected) layout; a single
// instance listens for ⌘K / Ctrl+K and opens a portaled palette. Interaction
// mirrors the agent-app AgentGlobalSearch (⌘K/Esc, debounce, arrow-nav,
// Enter/click), re-skinned to the Command Centre dark system. Read-only — it
// only navigates to existing detail routes. The agent search is untouched.

const EMPTY: CommandSearchResult = { agencies: [], businesses: [], people: [], files: [] };

function agencyModeLabel(m: string): string {
  return m === "self_progressed" ? "Self-progressed" : m === "progressor_managed" ? "Progressor-managed" : "Mixed";
}
function roleLabel(r: string): string {
  return r === "director" ? "Director" : r === "negotiator" ? "Negotiator" : r === "sales_progressor" ? "Progressor"
    : r === "admin" ? "Admin" : r === "superadmin" ? "Superadmin" : r === "viewer" ? "Viewer" : r;
}
const FILE_STATUS: Record<string, string> = { active: "Active", on_hold: "On hold", completed: "Completed", withdrawn: "Withdrawn" };

type Row = { href: string };

export function CommandGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [results, setResults] = useState<CommandSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  useEffect(() => { openRef.current = open; }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    if (abortRef.current) abortRef.current.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    // Return focus to whatever was focused before opening (accessibility).
    prevFocusRef.current?.focus?.();
  }, []);

  // Global shortcut: ⌘K / Ctrl+K toggles, Esc closes. A deliberate chord, so it
  // never swallows plain typing or other shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (openRef.current) close();
        else {
          prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;
          setOpen(true);
        }
      } else if (e.key === "Escape" && openRef.current) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setQuery(""); setResults(null); setError(false); setLoading(false); setSelected(0); setArchived(false);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Keep the keyboard-selected row visible within the scrollable results.
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected, open]);

  // Debounced, abortable search. Re-runs when the query or the archived toggle
  // changes. Stale requests are cancelled so late responses can't overwrite.
  const run = useCallback((q: string, withArchived: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (q.trim().length < 2) { setResults(null); setLoading(false); setError(false); return; }
    setLoading(true); setError(false);
    timerRef.current = setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/command/search?q=${encodeURIComponent(q.trim())}${withArchived ? "&archived=1" : ""}`, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data: CommandSearchResult = await res.json();
        setResults(data); setSelected(0); setError(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // superseded — ignore
        setResults(null); setError(true);
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    }, 200);
  }, []);

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    run(e.target.value, archived);
  }
  function toggleArchived() {
    const next = !archived;
    setArchived(next);
    run(query, next);
  }

  // Flat, ordered list of navigable rows for arrow-key selection.
  const rows: Row[] = [];
  if (results) {
    results.agencies.forEach((a) => rows.push({ href: `/command/agency/${a.id}` }));
    results.businesses.forEach((b) => rows.push({ href: `/command/businesses/${b.id}` }));
    results.people.forEach((p) => rows.push({ href: `/command/agencies/${p.id}` }));
    results.files.forEach((f) => rows.push({ href: `/command/files?tx=${f.id}` }));
  }

  const navigate = useCallback((href: string) => { close(); router.push(href); }, [close, router]);

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (!rows.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && selected >= 0 && rows[selected]) { e.preventDefault(); navigate(rows[selected].href); }
  }

  // Focus trap — keep Tab / Shift+Tab within the dialog (it's modal). Wraps at
  // the ends so focus can't escape to the page behind the overlay.
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const f = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const r = results ?? EMPTY;
  const total = r.agencies.length + r.businesses.length + r.people.length + r.files.length;
  const hasQuery = query.trim().length >= 2;

  // Running index so each section's rows get the correct flat selection index.
  let idx = 0;
  const nextIdx = () => idx++;

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] bg-black/60"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command Centre search"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-xl mx-4 rounded-xl border border-[#262626] bg-[#141414] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1f1f1f]">
          <Search className="w-4 h-4 text-[#2563eb] flex-shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={onInput}
            onKeyDown={onInputKeyDown}
            placeholder="Search agencies, progression companies, people, files…"
            aria-label="Search query"
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-neutral-500 animate-spin flex-shrink-0" />}
          <button
            onClick={close}
            className="text-[11px] text-neutral-500 border border-[#262626] rounded px-1.5 py-0.5 hover:text-neutral-300 transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Options */}
        <label className="flex items-center gap-2 px-4 py-2 border-b border-[#1f1f1f] text-[11px] text-neutral-500 cursor-pointer select-none hover:text-neutral-400 transition-colors">
          <input type="checkbox" checked={archived} onChange={toggleArchived} className="accent-[#2563eb]" />
          Include completed / withdrawn files
        </label>

        {/* Body */}
        <div className="max-h-[52vh] overflow-y-auto">
          {!hasQuery && (
            <p className="px-4 py-8 text-center text-[13px] text-neutral-600">
              Type to search across agencies, progression companies, people and files.
            </p>
          )}

          {hasQuery && error && (
            <p className="px-4 py-8 text-center text-[13px] text-red-400">Search failed. Try again.</p>
          )}

          {hasQuery && !error && results && total === 0 && !loading && (
            <p className="px-4 py-8 text-center text-[13px] text-neutral-500">No results for &ldquo;{query.trim()}&rdquo;</p>
          )}

          {hasQuery && !error && results && total > 0 && (
            <>
              {r.agencies.length > 0 && (
                <Section label="Estate agencies">
                  {r.agencies.map((a) => {
                    const i = nextIdx();
                    return (
                      <ResultRow key={a.id} Icon={Building2} title={a.name} sub={agencyModeLabel(a.mode)}
                        idx={i} selected={selected === i} onSelect={() => navigate(`/command/agency/${a.id}`)} onHover={() => setSelected(i)} />
                    );
                  })}
                </Section>
              )}
              {r.businesses.length > 0 && (
                <Section label="Progression companies">
                  {r.businesses.map((b) => {
                    const i = nextIdx();
                    return (
                      <ResultRow key={b.id} Icon={Briefcase} title={b.name}
                        sub={`${b.shortName ? `“${b.shortName}” · ` : ""}${b.subscribed ? "Subscribed" : "No subscription"}`}
                        idx={i} selected={selected === i} onSelect={() => navigate(`/command/businesses/${b.id}`)} onHover={() => setSelected(i)} />
                    );
                  })}
                </Section>
              )}
              {r.people.length > 0 && (
                <Section label="People">
                  {r.people.map((p) => {
                    const i = nextIdx();
                    const sub = [roleLabel(p.role), p.org, p.email].filter(Boolean).join(" · ");
                    return (
                      <ResultRow key={p.id} Icon={Users} title={p.name} sub={sub}
                        idx={i} selected={selected === i} onSelect={() => navigate(`/command/agencies/${p.id}`)} onHover={() => setSelected(i)} />
                    );
                  })}
                </Section>
              )}
              {r.files.length > 0 && (
                <Section label="Files">
                  {r.files.map((f) => {
                    const i = nextIdx();
                    const sub = [FILE_STATUS[f.status] ?? f.status, f.agencyName].filter(Boolean).join(" · ");
                    return (
                      <ResultRow key={f.id} Icon={FolderOpen} title={f.address} sub={sub}
                        idx={i} selected={selected === i} onSelect={() => navigate(`/command/files?tx=${f.id}`)} onHover={() => setSelected(i)} />
                    );
                  })}
                </Section>
              )}
            </>
          )}
        </div>

        <p className="px-4 py-2 border-t border-[#1f1f1f] text-[11px] text-neutral-600">
          ↑↓ navigate · ↵ open · Esc close
        </p>
      </div>
    </div>,
    document.body,
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-[#404040] border-t border-[#1f1f1f] first:border-t-0">
        {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({
  Icon, title, sub, selected, idx, onSelect, onHover,
}: {
  Icon: typeof Building2; title: string; sub?: string;
  selected: boolean; idx: number; onSelect: () => void; onHover: () => void;
}) {
  return (
    <button
      type="button"
      data-idx={idx}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        selected ? "bg-[#1d2d50]" : "hover:bg-[#1a1a1a]"
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? "text-[#2563eb]" : "text-neutral-500"}`} strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-neutral-200 truncate">{title}</span>
        {sub && <span className="block text-[11px] text-neutral-500 truncate">{sub}</span>}
      </span>
    </button>
  );
}
