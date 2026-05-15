"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AddBrokerModal } from "./AddBrokerModal";
import { titleCase } from "@/lib/utils";

type Firm = { id: string; name: string };
type Handler = { id: string; name: string; phone: string | null; email: string | null };

export type BrokerSelection = {
  firmId: string;
  firmName: string;
  contactId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
};

type Props = {
  label: string;
  value: BrokerSelection | null;
  onChange: (v: BrokerSelection | null) => void;
  /** Pre-populate with the agency's preferred broker on first render */
  preferredBroker?: BrokerSelection | null;
};

export function BrokerPicker({ label, value, onChange, preferredBroker }: Props) {
  const [query, setQuery] = useState(value?.firmName ?? "");
  const [firms, setFirms] = useState<Firm[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [loadingHandlers, setLoadingHandlers] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalPrefill, setModalPrefill] = useState("");
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [inputBlurred, setInputBlurred] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  const didPreFill = useRef(false);

  useEffect(() => setMounted(true), []);

  // Auto-populate from preferred broker on first render
  useEffect(() => {
    if (!didPreFill.current && !value && preferredBroker?.firmId) {
      didPreFill.current = true;
      onChange(preferredBroker);
      setQuery(preferredBroker.firmName);
    }
  }, [preferredBroker, value, onChange]);

  // Close dropdown on outside click — check both wrapper and portal
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inWrapper = wrapperRef.current?.contains(target);
      const inPortal = dropdownPortalRef.current?.contains(target);
      if (!inWrapper && !inPortal) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync query text when firm is set externally
  useEffect(() => {
    setQuery(value?.firmName ?? "");
  }, [value?.firmId]);

  // Load handlers whenever the selected firm changes
  useEffect(() => {
    if (!value?.firmId) { setHandlers([]); return; }
    setLoadingHandlers(true);
    fetch(`/api/broker-firms/${value.firmId}/handlers`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setHandlers(Array.isArray(data) ? data : []))
      .catch(() => setHandlers([]))
      .finally(() => setLoadingHandlers(false));
  }, [value?.firmId]);

  const doSearch = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/broker-firms?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setSearchError(err.error ?? `Search error ${res.status}`);
          setFirms([]);
          return;
        }
        setSearchError(null);
        setFirms(await res.json());
      } catch {
        setSearchError("Search failed — check your connection");
        setFirms([]);
      }
    }, 200);
  }, []);

  function openDropdown() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setDropdownRect(rect);
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
    onChange({ ...value, contactId: h.id, contactName: h.name, phone: h.phone, email: h.email });
  }

  function handleAddFirm() {
    const cased = titleCase(query);
    setQuery(cased);
    setModalPrefill(cased);
    setShowModal(true);
    setShowDropdown(false);
  }

  function handleFirmCreated(firm: Firm, handler: Handler | null) {
    setShowModal(false);
    setQuery(firm.name);
    setSearchError(null);
    setInputBlurred(false);
    if (handler) {
      onChange({ firmId: firm.id, firmName: firm.name, contactId: handler.id, contactName: handler.name, phone: handler.phone, email: handler.email });
      setHandlers([handler]);
    } else {
      onChange({ firmId: firm.id, firmName: firm.name, contactId: null, contactName: null, phone: null, email: null });
      setHandlers([]);
    }
    setFirms([firm]);
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

  const dropdownContent = showDropdown && query.trim() && dropdownRect ? (
    <div
      ref={dropdownPortalRef}
      style={{
        position: "fixed",
        top: dropdownRect.bottom + 4,
        left: dropdownRect.left,
        width: dropdownRect.width,
        zIndex: 9999,
      }}
      className="bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-lg overflow-hidden"
    >
      {searchError ? (
        <div>
          <p className="px-4 py-2.5 text-sm text-red-500">{searchError}</p>
          <div className="border-t border-white/20">
            <button type="button" onMouseDown={handleAddFirm}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-white/40 font-medium flex items-center gap-2">
              <span>+</span> Add &ldquo;{query}&rdquo; as new brokerage
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
              <span>+</span> Add &ldquo;{query}&rdquo; as new brokerage
            </button>
          </div>
        </>
      ) : (
        <div>
          <p className="px-4 py-2.5 text-sm text-slate-900/40">No matching brokerages</p>
          <div className="border-t border-white/20">
            <button type="button" onMouseDown={handleAddFirm}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-white/40 font-medium flex items-center gap-2">
              <span>+</span> Add &ldquo;{query}&rdquo; as new brokerage
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

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
            ref={inputRef}
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
            placeholder="Search broker name…"
            className={`glass-input w-full px-3 py-2.5 text-sm${firmSelected ? " !border-blue-300 !bg-blue-50/30" : unconfirmed ? " agent-input-warning" : ""}`}
          />
          {unconfirmed && (
            <p className="agent-helper-warning">Brokerage not saved — choose from results or add as new</p>
          )}
        </div>

        {/* Broker contact dropdown */}
        {firmSelected && (
          <div className="pl-3 space-y-2 border-l-2 border-blue-200/60">
            {loadingHandlers ? (
              <p className="text-xs text-slate-900/40">Loading contacts…</p>
            ) : (
              <select
                value={value?.contactId ?? ""}
                onChange={(e) => {
                  const h = handlers.find((h) => h.id === e.target.value) ?? null;
                  if (h) selectHandler(h);
                  else onChange({ ...value!, contactId: null, contactName: null, phone: null, email: null });
                }}
                className="glass-input w-full px-3 py-2.5 text-sm"
              >
                <option value="">
                  {handlers.length === 0 ? "No contacts saved yet" : "Select broker contact…"}
                </option>
                {handlers.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}

            {value?.contactId && (
              <div className="grid grid-cols-2 gap-2">
                <input readOnly value={value.phone ?? ""} placeholder="Phone"
                  className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/20 text-slate-900/50" />
                <input readOnly value={value.email ?? ""} placeholder="Email"
                  className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/20 text-slate-900/50" />
              </div>
            )}
          </div>
        )}
      </div>

      {mounted && createPortal(dropdownContent, document.body)}

      {showModal && (
        <AddBrokerModal
          prefillName={modalPrefill}
          onClose={() => setShowModal(false)}
          onCreated={handleFirmCreated}
        />
      )}
    </>
  );
}
