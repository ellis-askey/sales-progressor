"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AddFirmModal } from "./AddFirmModal";
import { titleCaseKeepAcronyms } from "@/lib/utils";

type Firm = { id: string; name: string };
type Handler = { id: string; name: string; phone: string | null; email: string | null; secondaryEmail?: string | null };

export type SolicitorSelection = {
  firmId: string;
  firmName: string;
  contactId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  secondaryEmail?: string | null;
};

type Props = {
  label: string;
  value: SolicitorSelection | null;
  onChange: (v: SolicitorSelection | null) => void;
  // Fired ONLY when the user creates a brand-new firm via AddFirmModal.
  // Parent uses this to commit the selection immediately (no second
  // "Save" click on the outer card needed). For ordinary picks, only
  // onChange fires.
  onFirmCreated?: (v: SolicitorSelection) => void;
};

export function SolicitorPicker({ label, value, onChange, onFirmCreated }: Props) {
  const [query, setQuery] = useState(value?.firmName ?? "");
  const [firms, setFirms] = useState<Firm[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [loadingHandlers, setLoadingHandlers] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalPrefill, setModalPrefill] = useState("");
  // When true, the firm field in the modal is locked — we're adding a
  // case handler to a firm that's already selected. Reset to false on
  // every modal open so the "+ Add as new firm" path stays unaffected.
  const [modalLockFirm, setModalLockFirm] = useState(false);
  const [inputBlurred, setInputBlurred] = useState(false);
  // Handler dropdown — custom open state + positioning so we can render
  // a styled menu like the firm picker uses (rather than a native select).
  const [handlerOpen, setHandlerOpen] = useState(false);
  const [handlerDropPos, setHandlerDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const handlerTriggerRef = useRef<HTMLButtonElement>(null);
  const handlerWrapperRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or scroll
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (handlerWrapperRef.current && !handlerWrapperRef.current.contains(e.target as Node)) {
        setHandlerOpen(false);
      }
    }
    function handleScroll() { setShowDropdown(false); setHandlerOpen(false); }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  function openHandlerDropdown() {
    if (handlerTriggerRef.current) {
      const rect = handlerTriggerRef.current.getBoundingClientRect();
      setHandlerDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setHandlerOpen(true);
  }

  // Sync query text when firm is set externally (e.g. memo auto-fill)
  useEffect(() => {
    setQuery(value?.firmName ?? "");
  }, [value?.firmId]);

  // Load handlers whenever the selected firm changes
  useEffect(() => {
    if (!value?.firmId) { setHandlers([]); return; }
    setLoadingHandlers(true);
    fetch(`/api/solicitor-firms/${value.firmId}/handlers`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setHandlers(Array.isArray(data) ? data : []))
      .catch(() => setHandlers([]))
      .finally(() => setLoadingHandlers(false));
  }, [value?.firmId]);

  const doSearch = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/solicitor-firms?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setSearchError(err.error ?? `Search error ${res.status}`);
          setFirms([]);
          return;
        }
        setSearchError(null);
        setFirms(await res.json());
      } catch {
        setSearchError("Search failed. Check your connection");
        setFirms([]);
      }
    }, 200);
  }, []);

  function openDropdown() {
    if (wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setShowDropdown(true);
  }

  function handleQueryChange(q: string) {
    setQuery(q);
    openDropdown();
    if (value) onChange(null);
    if (q.trim()) doSearch(q);
    else { setFirms([]); setSearchError(null); }
  }

  function selectFirm(firm: Firm) {
    setQuery(firm.name);
    setShowDropdown(false);
    setInputBlurred(false);
    onChange({ firmId: firm.id, firmName: firm.name, contactId: null, contactName: null, phone: null, email: null });
  }

  function selectHandler(h: Handler) {
    if (!value) return;
    onChange({ ...value, contactId: h.id, contactName: h.name, phone: h.phone, email: h.email, secondaryEmail: h.secondaryEmail ?? null });
  }

  // Assistant/secretary email — edited inline for the selected handler and
  // saved straight to that handler (reused across every file they're on).
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantSaving, setAssistantSaving] = useState(false);
  const [assistantSaved, setAssistantSaved] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  useEffect(() => {
    setAssistantDraft(value?.secondaryEmail ?? "");
    setAssistantSaved(false);
    setAssistantError(null);
  }, [value?.contactId]);
  const assistantDirty = (value?.secondaryEmail ?? "") !== assistantDraft.trim().toLowerCase();

  async function saveAssistant() {
    if (!value?.contactId) return;
    const trimmed = assistantDraft.trim().toLowerCase();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setAssistantError("That email address doesn't look right");
      return;
    }
    setAssistantSaving(true);
    setAssistantError(null);
    try {
      const res = await fetch(`/api/solicitor-handlers/${value.contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secondaryEmail: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setAssistantError(j?.error ?? "Couldn't save. Try again.");
        return;
      }
      const updated: Handler = await res.json();
      onChange({ ...value, secondaryEmail: updated.secondaryEmail ?? null });
      setHandlers((hs) => hs.map((h) => (h.id === updated.id ? { ...h, secondaryEmail: updated.secondaryEmail ?? null } : h)));
      setAssistantSaved(true);
      setTimeout(() => setAssistantSaved(false), 1600);
    } finally {
      setAssistantSaving(false);
    }
  }

  function handleAddFirm() {
    const cased = titleCaseKeepAcronyms(query);
    setQuery(cased);
    setModalPrefill(cased);
    setModalLockFirm(false);
    setShowModal(true);
    setShowDropdown(false);
  }

  // Open the modal to add a NEW case handler to the firm that's
  // currently picked. Firm name is locked in the modal so the user can
  // only fill in the handler's details.
  function handleAddHandler() {
    if (!value?.firmName) return;
    setModalPrefill(value.firmName);
    setModalLockFirm(true);
    setShowModal(true);
  }

  function handleFirmCreated(firm: Firm, handler: Handler | null) {
    setShowModal(false);
    setQuery(firm.name);
    setSearchError(null);
    setInputBlurred(false);
    const sel: SolicitorSelection = handler
      ? { firmId: firm.id, firmName: firm.name, contactId: handler.id, contactName: handler.name, phone: handler.phone, email: handler.email, secondaryEmail: handler.secondaryEmail ?? null }
      : { firmId: firm.id, firmName: firm.name, contactId: null, contactName: null, phone: null, email: null, secondaryEmail: null };
    onChange(sel);
    setHandlers(handler ? [handler] : []);
    // Prime the firm list so it shows up immediately if user searches again
    setFirms([firm]);
    // Signal "fresh create" to the parent so it can commit/save without
    // requiring a second click. Existing pick-an-existing-firm flow is
    // unaffected — only this modal path fires onFirmCreated.
    if (onFirmCreated) onFirmCreated(sel);
  }

  function clear() {
    setQuery("");
    setFirms([]);
    setHandlers([]);
    setSearchError(null);
    setInputBlurred(false);
    onChange(null);
  }

  const firmSelected = !!value?.firmId;
  const unconfirmed = inputBlurred && !!query.trim() && !firmSelected;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900/50 uppercase tracking-wide">{label}</span>
          {value && (
            <button type="button" onClick={clear} className="text-xs text-slate-900/30 hover:text-slate-900/50 transition-colors">
              Clear
            </button>
          )}
        </div>

        {/* Firm typeahead */}
        <div ref={wrapperRef} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => { handleQueryChange(e.target.value); setInputBlurred(false); }}
            onFocus={() => {
              if (query.trim() && !firmSelected) {
                openDropdown();
                doSearch(query);
              }
            }}
            onBlur={() => { if (!showDropdown) setInputBlurred(true); }}
            placeholder="Search firm name…"
            className={`glass-input w-full px-3 py-2.5 text-sm${firmSelected ? " !border-blue-300 !bg-blue-50/30" : unconfirmed ? " agent-input-warning" : ""}`}
          />
          {unconfirmed && (
            <p className="agent-helper-warning">Firm not saved — choose from results or add as new</p>
          )}

          {showDropdown && query.trim() && dropPos && typeof document !== "undefined" && createPortal(
            <div className="agent-dropdown-in" style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.60)", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.14)", overflow: "hidden" }}>
              {searchError ? (
                <div>
                  <p className="px-4 py-2.5 text-sm text-red-500">{searchError}</p>
                  <div className="border-t border-white/20">
                    <button type="button" onMouseDown={handleAddFirm}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-white/40 font-medium flex items-center gap-2">
                      <span>+</span> Add &ldquo;{query}&rdquo; as new firm
                    </button>
                  </div>
                </div>
              ) : firms.length > 0 ? (
                <>
                  {firms.map((f) => (
                    <button key={f.id} type="button" onMouseDown={() => selectFirm(f)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-900/80 hover:bg-white/40 transition-colors">
                      {f.name}
                    </button>
                  ))}
                  <div className="border-t border-white/20">
                    <button type="button" onMouseDown={handleAddFirm}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-white/40 font-medium flex items-center gap-2">
                      <span>+</span> Add &ldquo;{query}&rdquo; as new firm
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <p className="px-4 py-2.5 text-sm text-slate-900/40">No matching firms</p>
                  <div className="border-t border-white/20">
                    <button type="button" onMouseDown={handleAddFirm}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-white/40 font-medium flex items-center gap-2">
                      <span>+</span> Add &ldquo;{query}&rdquo; as new firm
                    </button>
                  </div>
                </div>
              )}
            </div>,
            document.body
          )}
        </div>

        {/* Case handler dropdown — custom popover that matches the firm
          * typeahead's style so "+ Add new case handler" sits inside the
          * visible menu (not below a native browser select). */}
        {firmSelected && (
          <div ref={handlerWrapperRef} className="pl-3 space-y-2 border-l-2 border-blue-200/60 relative">
            {loadingHandlers ? (
              <p className="text-xs text-slate-900/40">Loading handlers…</p>
            ) : (
              <>
                <button
                  ref={handlerTriggerRef}
                  type="button"
                  onClick={() => (handlerOpen ? setHandlerOpen(false) : openHandlerDropdown())}
                  className="glass-input w-full px-3 py-2.5 text-sm text-left"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                >
                  <span style={{ color: value?.contactName ? "var(--agent-text-primary)" : "rgba(15,23,42,0.45)" }}>
                    {value?.contactName ?? (handlers.length === 0 ? "No case handlers saved yet" : "Select case handler…")}
                  </span>
                  <span aria-hidden style={{ color: "rgba(15,23,42,0.35)" }}>▾</span>
                </button>

                {handlerOpen && handlerDropPos && typeof document !== "undefined" && createPortal(
                  <div className="agent-dropdown-in" style={{ position: "fixed", top: handlerDropPos.top, left: handlerDropPos.left, width: handlerDropPos.width, zIndex: 9999, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.60)", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.14)", overflow: "hidden" }}>
                    {handlers.length === 0 ? (
                      <p className="px-4 py-2.5 text-sm text-slate-900/40">No case handlers yet</p>
                    ) : (
                      handlers.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onMouseDown={() => { selectHandler(h); setHandlerOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-900/80 hover:bg-white/40 transition-colors"
                        >
                          {h.name}
                        </button>
                      ))
                    )}
                    <div className="border-t border-white/20">
                      <button
                        type="button"
                        onMouseDown={() => { handleAddHandler(); setHandlerOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-white/40 font-medium flex items-center gap-2"
                      >
                        <span>+</span> Add new case handler
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
              </>
            )}

            {value?.contactId && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input readOnly value={value.phone ?? ""} placeholder="Phone"
                    className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/20 text-slate-900/50" />
                  <input readOnly value={value.email ?? ""} placeholder="Email"
                    className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/20 text-slate-900/50" />
                </div>
                {/* Assistant / secretary — cc'd on every email to this handler */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-900/45">
                    Assistant email <span className="font-normal text-slate-900/35">optional, cc&apos;d on all emails</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={assistantDraft}
                      onChange={(e) => { setAssistantDraft(e.target.value); setAssistantError(null); setAssistantSaved(false); }}
                      placeholder="assistant@firm.co.uk"
                      className="glass-input agent-focus flex-1 px-3 py-2 text-sm"
                    />
                    {assistantDirty && (
                      <button
                        type="button"
                        onClick={saveAssistant}
                        disabled={assistantSaving}
                        className="agent-btn agent-btn-xs agent-btn-primary disabled:opacity-50"
                        style={{ flexShrink: 0 }}
                      >
                        {assistantSaving ? "Saving…" : "Save"}
                      </button>
                    )}
                    {!assistantDirty && assistantSaved && (
                      <span className="text-[11px] font-medium text-emerald-600" style={{ flexShrink: 0 }}>Saved</span>
                    )}
                  </div>
                  {assistantError && <p className="agent-helper-error">{assistantError}</p>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AddFirmModal
          prefillName={modalPrefill}
          onClose={() => { setShowModal(false); setModalLockFirm(false); }}
          onCreated={handleFirmCreated}
          lockFirm={modalLockFirm}
        />
      )}
    </>
  );
}
