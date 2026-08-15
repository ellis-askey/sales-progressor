"use client";

// Inline address editing for the hero. The big address heading gets a pencil on
// hover; click turns it into street / town / postcode inputs. Saving shows the
// same "this file has X messages and Y steps logged at the old address" confirm
// the drawer used (historical records keep the old address for the audit trail),
// then saveAddressAction (logged server-side).

import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PencilSimple, X } from "@phosphor-icons/react";
import { getAddressConsequencesAction, saveAddressAction } from "@/app/actions/transactions";

function parseAddress(addr: string) {
  const parts = addr.split(", ");
  const re = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s[0-9][A-Z]{2}$/;
  const remaining = [...parts];
  let postcode = "";
  let city = "";
  if (remaining.length > 0 && re.test(remaining[remaining.length - 1])) postcode = remaining.pop()!;
  if (remaining.length > 1) city = remaining.pop()!;
  return { street: remaining.join(", "), city, postcode };
}

const H1_STYLE: CSSProperties = {
  fontSize: "clamp(26px, 3.2vw, 40px)", fontWeight: 700, color: "var(--agent-text-primary)",
  margin: "14px 0 0", letterSpacing: "-0.02em", lineHeight: 1.12,
};
const LINE2_STYLE: CSSProperties = { margin: "6px 0 0", fontSize: 15, color: "var(--agent-text-muted)", lineHeight: 1.35 };

export function HeroAddressEdit({ transactionId, address }: { transactionId: string; address: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ commCount: number; milestoneCount: number } | null>(null);

  const parsed = parseAddress(address);
  const [street, setStreet] = useState(parsed.street);
  const [city, setCity] = useState(parsed.city);
  const [postcode, setPostcode] = useState(parsed.postcode);

  const joined = [street.trim(), city.trim(), postcode.trim()].filter(Boolean).join(", ");
  const changed = joined !== address && !!street.trim();

  const [line1, ...rest] = address.split(",");
  const line2 = rest.join(",").trim();

  function open() {
    const p = parseAddress(address);
    setStreet(p.street); setCity(p.city); setPostcode(p.postcode);
    setError(null);
    setEditing(true);
  }

  async function requestSave() {
    if (!changed) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      const c = await getAddressConsequencesAction(transactionId);
      setConfirm(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check the address");
    } finally {
      setSaving(false);
    }
  }

  async function doSave() {
    setSaving(true);
    setError(null);
    try {
      await saveAddressAction(transactionId, joined);
      setConfirm(null);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the address");
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className="group"
        aria-label="Edit address"
        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
      >
        <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6 }}>
          <h1 data-sensitive="true" style={H1_STYLE}>{line1}</h1>
          <PencilSimple size={16} weight="regular" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--agent-text-muted)", flexShrink: 0, marginTop: 18 }} />
        </span>
        {line2 && <p data-sensitive="true" style={LINE2_STYLE}>{line2}</p>}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6, maxWidth: 460 }}>
      <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" disabled={saving}
        className="glass-input agent-focus text-sm px-3 py-2 rounded-lg w-full" autoFocus />
      <div style={{ display: "flex", gap: 6 }}>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Town / city" disabled={saving}
          className="glass-input agent-focus text-sm px-3 py-2 rounded-lg flex-1" />
        <input value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="Postcode" disabled={saving}
          className="glass-input agent-focus text-sm px-3 py-2 rounded-lg w-28" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button onClick={requestSave} disabled={!changed || saving} className="py-2 px-4 rounded-xl agent-btn-color-primary text-xs font-semibold transition-colors disabled:opacity-40">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} disabled={saving} className="py-2 px-4 rounded-xl text-xs text-slate-900/60 glass-subtle transition-colors disabled:opacity-40" style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {confirm && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={() => setConfirm(null)} />
          <div style={{ position: "relative", zIndex: 1, background: "var(--agent-surface-elevated)", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 16, maxWidth: 380, width: "100%", padding: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>Change address?</h3>
              <button onClick={() => setConfirm(null)} className="agent-icon-btn agent-icon-btn-sm"><X size={14} weight="bold" /></button>
            </div>
            {(() => {
              const commStr = confirm.commCount > 0 ? `${confirm.commCount} message${confirm.commCount !== 1 ? "s" : ""}` : null;
              const msStr = confirm.milestoneCount > 0 ? `${confirm.milestoneCount} completed step${confirm.milestoneCount !== 1 ? "s" : ""}` : null;
              const ps: CSSProperties = { fontSize: 13, color: "rgba(15,23,42,0.60)", marginBottom: 20, lineHeight: 1.6 };
              return commStr || msStr ? (
                <p style={ps}>This file has {commStr && <strong>{commStr}</strong>}{commStr && msStr && " and "}{msStr && <strong>{msStr}</strong>} logged at the current address. They&apos;ll keep the old address for the audit trail.</p>
              ) : (
                <p style={ps}>The address will update. Any historical records keep the old address for the audit trail.</p>
              );
            })()}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={doSave} disabled={saving} className="flex-1 py-2.5 rounded-xl agent-btn-color-primary text-sm font-semibold transition-colors disabled:opacity-40">
                {saving ? "Saving…" : "Change address"}
              </button>
              <button onClick={() => setConfirm(null)} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm text-slate-900/60 glass-subtle transition-colors" style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
