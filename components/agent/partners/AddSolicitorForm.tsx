"use client";

// Add / edit a recommended solicitor firm inside the Partners popup. Firms are
// shared and carry a pool of case handlers, so once a firm is chosen we load its
// existing handlers and let the agent pick one (no duplicate created) or add a
// new one if theirs isn't there. A brand-new firm, or one with no handlers yet,
// requires a handler so the firm is contactable. Edit mode locks the firm and
// prefills the fee. 2026-08-31.

import { useState, useRef, useEffect, useCallback } from "react";
import { NumericFormat } from "react-number-format";
import { addRecommendedSolicitorWithContactAction, getSolicitorFirmHandlersAction } from "@/app/actions/solicitors";

export type AddedSolicitor = { firmId: string; firmName: string; defaultReferralFeePence: number | null };
type AllFirm = { id: string; name: string };
type Handler = { id: string; name: string; phone: string | null; email: string | null };
type SelectedFirm = { id?: string; name: string };

const ACCENT = "59,130,246"; // blue — matches the solicitor card icon.
const NEW = "__new__";

export function AddSolicitorForm({
  allFirms,
  excludeFirmIds,
  initialFirm,
  initialFee,
  isEdit = false,
  onAdded,
  onCancel,
}: {
  allFirms: AllFirm[];
  excludeFirmIds: string[];
  initialFirm?: SelectedFirm;
  initialFee?: number | null;
  isEdit?: boolean;
  onAdded: (firm: AddedSolicitor) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showList, setShowList] = useState(false);
  const [firm, setFirm] = useState<SelectedFirm | null>(initialFirm ?? null);
  const [handlers, setHandlers] = useState<Handler[] | null>(null); // null = loading
  const [handlerChoice, setHandlerChoice] = useState<string>(NEW);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [feePence, setFeePence] = useState<number | null>(initialFee ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowList(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load the firm's existing handlers whenever a known firm is chosen. A brand
  // new firm (no id) has none, so we go straight to the add-handler fields.
  const loadHandlers = useCallback(async (f: SelectedFirm | null) => {
    if (!f) { setHandlers(null); return; }
    if (!f.id) { setHandlers([]); setHandlerChoice(NEW); return; }
    setHandlers(null);
    try {
      const rows = await getSolicitorFirmHandlersAction(f.id);
      setHandlers(rows);
      setHandlerChoice(rows.length > 0 ? rows[0].id : NEW);
    } catch {
      setHandlers([]);
      setHandlerChoice(NEW);
    }
  }, []);

  useEffect(() => { loadHandlers(firm); }, [firm, loadHandlers]);

  // Focus the new-handler name field when the add-new path is active.
  useEffect(() => {
    if (firm && handlerChoice === NEW && handlers !== null) nameRef.current?.focus();
  }, [firm, handlerChoice, handlers]);

  const excluded = new Set(excludeFirmIds);
  const filtered = allFirms.filter(
    (f) => !excluded.has(f.id) && f.name.toLowerCase().includes(query.toLowerCase()),
  );

  function pickFirm(f: SelectedFirm) {
    setFirm(f);
    setQuery("");
    setShowList(false);
    setError("");
    setCName(""); setCPhone(""); setCEmail("");
  }

  async function confirm() {
    if (!firm) { setError("Choose or add a firm first."); return; }
    const addingNew = handlerChoice === NEW;
    if (addingNew && (!cName.trim() || !cPhone.trim() || !cEmail.trim())) {
      setError("Case handler name, phone and email are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await addRecommendedSolicitorWithContactAction({
        firmId: firm.id,
        firmName: firm.id ? undefined : firm.name,
        contactName: addingNew ? cName.trim() : undefined,
        contactPhone: addingNew ? cPhone.trim() : undefined,
        contactEmail: addingNew ? cEmail.trim() : undefined,
        referralFeePence: feePence,
      });
      onAdded({ firmId: result.firmId, firmName: result.firmName, defaultReferralFeePence: feePence });
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 9,
    border: `1px solid rgba(${ACCENT},0.24)`, background: "var(--agent-surface-glass)",
    color: "var(--agent-text-primary)", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600, color: `rgba(${ACCENT},0.85)`,
    marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const locked = !firm; // the block below fades until a firm is set.
  const hasHandlers = (handlers?.length ?? 0) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Firm select / create (locked in edit mode) */}
      <div ref={searchRef} style={{ position: "relative" }}>
        <label style={labelStyle}>Solicitor firm <span style={{ color: "#f87171" }}>*</span></label>
        {firm ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            padding: "10px 12px", borderRadius: 9,
            border: `1px solid rgba(${ACCENT},0.30)`, background: `rgba(${ACCENT},0.06)`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{firm.name}</span>
            {!isEdit && (
              <button
                type="button"
                onClick={() => { setFirm(null); setHandlers(null); }}
                style={{ fontSize: 12, fontWeight: 600, color: `rgb(${ACCENT})`, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowList(true); }}
              onClick={() => setShowList(true)}
              placeholder="Search or add a solicitor firm…"
              autoFocus
              style={inputStyle}
            />
            {showList && (query.length > 0 || filtered.length > 0) && (
              <div style={{
                position: "absolute", zIndex: 5, left: 0, right: 0, marginTop: 4,
                borderRadius: 10, overflow: "hidden", maxHeight: 220, overflowY: "auto",
                background: "var(--agent-surface-elevated)",
                border: "1px solid var(--agent-border-default)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
              }}>
                {filtered.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={() => pickFirm({ id: f.id, name: f.name })}
                    className="agent-hover-row"
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 13, color: "var(--agent-text-primary)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    {f.name}
                  </button>
                ))}
                {query.trim() && !allFirms.some((f) => f.name.toLowerCase() === query.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onMouseDown={() => pickFirm({ name: query.trim() })}
                    className="agent-hover-row"
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", fontSize: 13, fontWeight: 600, color: `rgb(${ACCENT})`, background: "none", border: "none", borderTop: "0.5px solid var(--agent-border-default)", cursor: "pointer" }}
                  >
                    + Add &ldquo;{query.trim()}&rdquo; as a new firm
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Case handler + fee — faded until a firm is chosen */}
      <div
        aria-hidden={locked}
        style={{
          display: "flex", flexDirection: "column", gap: 16,
          opacity: locked ? 0.4 : 1,
          pointerEvents: locked ? "none" : "auto",
          transition: "opacity 220ms ease",
        }}
      >
        <div style={{ borderTop: `0.5px solid rgba(${ACCENT},0.16)`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: `rgba(${ACCENT},0.7)`, textTransform: "uppercase", letterSpacing: "0.05em" }}>Case handler</p>

          {firm && handlers === null && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)" }}>Loading handlers…</p>
          )}

          {/* Existing handlers to pick from (shared firm) */}
          {hasHandlers && handlers && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {handlers.map((h) => {
                const on = handlerChoice === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHandlerChoice(h.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left", width: "100%",
                      padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                      background: on ? `rgba(${ACCENT},0.08)` : "var(--agent-surface-glass)",
                      border: `1px solid ${on ? `rgba(${ACCENT},0.45)` : "var(--agent-border-default)"}`,
                      transition: "border-color 120ms ease, background 120ms ease",
                    }}
                  >
                    <span style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${on ? `rgb(${ACCENT})` : "var(--agent-border-strong, rgba(15,23,42,0.25))"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {on && <span style={{ width: 7, height: 7, borderRadius: "50%", background: `rgb(${ACCENT})` }} />}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{h.name}</span>
                      {(h.phone || h.email) && (
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--agent-text-muted)" }}>{[h.phone, h.email].filter(Boolean).join(" · ")}</span>
                      )}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setHandlerChoice(NEW)}
                style={{
                  alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600,
                  color: handlerChoice === NEW ? `rgb(${ACCENT})` : "var(--agent-text-muted)",
                  background: "none", border: "none", cursor: "pointer", padding: "2px 0",
                }}
              >
                + Add a new handler
              </button>
            </div>
          )}

          {/* New-handler fields (forced when the firm has no handlers) */}
          {firm && handlers !== null && handlerChoice === NEW && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!hasHandlers && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>This firm has no case handlers yet — add one so we can reach them.</p>
              )}
              <div>
                <label style={labelStyle}>Name <span style={{ color: "#f87171" }}>*</span></label>
                <input ref={nameRef} type="text" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Sarah Jones" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Phone <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="tel" value={cPhone} onChange={(e) => setCPhone(e.target.value)} maxLength={20} placeholder="01234 567890" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} maxLength={100} placeholder="sarah@firm.co.uk" style={inputStyle} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: `0.5px solid rgba(${ACCENT},0.16)`, paddingTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ ...labelStyle, margin: 0, flexShrink: 0 }}>Default referral fee</label>
          <NumericFormat
            value={feePence != null ? feePence / 100 : ""}
            onValueChange={({ floatValue }) => setFeePence(floatValue != null ? Math.round(floatValue * 100) : null)}
            prefix="£"
            thousandSeparator=","
            decimalScale={2}
            allowNegative={false}
            inputMode="decimal"
            placeholder="£250"
            style={{ ...inputStyle, width: 120 }}
          />
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>(optional)</span>
        </div>
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>}

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={confirm}
          disabled={saving || !firm}
          className="agent-btn-primary"
          style={{ padding: "9px 18px", fontSize: 13, borderRadius: 9, border: "none", opacity: !firm ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add solicitor firm"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ fontSize: 12, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
