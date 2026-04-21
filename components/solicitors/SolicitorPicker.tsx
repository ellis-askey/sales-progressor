"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AddFirmModal } from "./AddFirmModal";

type Firm = { id: string; name: string };
type Handler = { id: string; name: string; phone: string | null; email: string | null };

export type SolicitorSelection = {
  firmId: string;
  firmName: string;
  contactId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
};

type Props = {
  label: string;
  value: SolicitorSelection | null;
  onChange: (v: SolicitorSelection | null) => void;
};

export function SolicitorPicker({ label, value, onChange }: Props) {
  const [query, setQuery] = useState(value?.firmName ?? "");
  const [firms, setFirms] = useState<Firm[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [loadingHandlers, setLoadingHandlers] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalPrefill, setModalPrefill] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        setSearchError("Search failed — check your connection");
        setFirms([]);
      }
    }, 200);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    setShowDropdown(true);
    if (value) onChange(null);
    if (q.trim()) doSearch(q);
    else { setFirms([]); setSearchError(null); }
  }

  async function selectFirm(firm: Firm) {
    setQuery(firm.name);
    setShowDropdown(false);
    setLoadingHandlers(true);
    setHandlers([]);
    onChange({ firmId: firm.id, firmName: firm.name, contactId: null, contactName: null, phone: null, email: null });

    const res = await fetch(`/api/solicitor-firms/${firm.id}/handlers`, { cache: "no-store" });
    if (res.ok) setHandlers(await res.json());
    setLoadingHandlers(false);
  }

  function selectHandler(h: Handler) {
    if (!value) return;
    onChange({ ...value, contactId: h.id, contactName: h.name, phone: h.phone, email: h.email });
  }

  function handleAddFirm() {
    setModalPrefill(query);
    setShowModal(true);
    setShowDropdown(false);
  }

  function handleFirmCreated(firm: Firm, handler: Handler | null) {
    setShowModal(false);
    setQuery(firm.name);
    setSearchError(null);
    if (handler) {
      onChange({ firmId: firm.id, firmName: firm.name, contactId: handler.id, contactName: handler.name, phone: handler.phone, email: handler.email });
      setHandlers([handler]);
    } else {
      onChange({ firmId: firm.id, firmName: firm.name, contactId: null, contactName: null, phone: null, email: null });
      setHandlers([]);
    }
    // Prime the firm list so it shows up immediately if user searches again
    setFirms([firm]);
  }

  function clear() {
    setQuery("");
    setFirms([]);
    setHandlers([]);
    setSearchError(null);
    onChange(null);
  }

  const firmSelected = !!value?.firmId;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
          {value && (
            <button type="button" onClick={clear} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
              Clear
            </button>
          )}
        </div>

        {/* Firm typeahead */}
        <div ref={wrapperRef} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (query.trim() && !firmSelected) {
                setShowDropdown(true);
                doSearch(query);
              }
            }}
            placeholder="Search firm name…"
            className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white focus:outline-none focus:ring-1 transition-all ${
              firmSelected
                ? "border-blue-300 focus:border-blue-400 focus:ring-blue-400 bg-blue-50/30"
                : "border-[#e4e9f0] focus:border-blue-400 focus:ring-blue-400"
            }`}
          />

          {showDropdown && query.trim() && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#e4e9f0] rounded-xl shadow-lg overflow-hidden">
              {searchError ? (
                <div>
                  <p className="px-4 py-2.5 text-sm text-red-500">{searchError}</p>
                  <div className="border-t border-[#f0f4f8]">
                    <button type="button" onMouseDown={handleAddFirm}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-blue-50 font-medium flex items-center gap-2">
                      <span>+</span> Add "{query}" as new firm
                    </button>
                  </div>
                </div>
              ) : firms.length > 0 ? (
                <>
                  {firms.map((f) => (
                    <button key={f.id} type="button" onMouseDown={() => selectFirm(f)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                      {f.name}
                    </button>
                  ))}
                  <div className="border-t border-[#f0f4f8]">
                    <button type="button" onMouseDown={handleAddFirm}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-blue-50 font-medium flex items-center gap-2">
                      <span>+</span> Add "{query}" as new firm
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <p className="px-4 py-2.5 text-sm text-gray-400">No matching firms</p>
                  <div className="border-t border-[#f0f4f8]">
                    <button type="button" onMouseDown={handleAddFirm}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-500 hover:bg-blue-50 font-medium flex items-center gap-2">
                      <span>+</span> Add "{query}" as new firm
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Case handler dropdown */}
        {firmSelected && (
          <div className="pl-3 space-y-2 border-l-2 border-blue-100">
            {loadingHandlers ? (
              <p className="text-xs text-gray-400">Loading handlers…</p>
            ) : (
              <select
                value={value?.contactId ?? ""}
                onChange={(e) => {
                  const h = handlers.find((h) => h.id === e.target.value) ?? null;
                  if (h) selectHandler(h);
                  else onChange({ ...value!, contactId: null, contactName: null, phone: null, email: null });
                }}
                className="w-full px-3 py-2.5 text-sm border border-[#e4e9f0] rounded-lg bg-white focus:outline-none focus:border-blue-400"
              >
                <option value="">
                  {handlers.length === 0 ? "No case handlers saved yet" : "Select case handler…"}
                </option>
                {handlers.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}

            {value?.contactId && (
              <div className="grid grid-cols-2 gap-2">
                <input readOnly value={value.phone ?? ""} placeholder="Phone"
                  className="px-3 py-2 text-sm border border-[#e4e9f0] rounded-lg bg-gray-50 text-gray-500" />
                <input readOnly value={value.email ?? ""} placeholder="Email"
                  className="px-3 py-2 text-sm border border-[#e4e9f0] rounded-lg bg-gray-50 text-gray-500" />
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AddFirmModal
          prefillName={modalPrefill}
          onClose={() => setShowModal(false)}
          onCreated={handleFirmCreated}
        />
      )}
    </>
  );
}
