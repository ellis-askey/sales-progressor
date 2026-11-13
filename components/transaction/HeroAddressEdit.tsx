"use client";

// Inline address editing for the hero. The big address heading gets a pencil on
// hover; click turns it into street / town / postcode inputs. Save commits
// straight through saveAddressAction (logged server-side). No confirm step: a
// rename only changes the single address field everywhere it's shown from now on
// (past emails/steps already snapshot the old address), and it's reversible, so
// the Save/Cancel pair is the only confirmation needed.

import { useState, type CSSProperties, type ReactNode } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { saveAddressAction } from "@/app/actions/transactions";
import { parseAddressParts } from "@/lib/utils/address";

// County-aware split into { street, city, postcode } — line 1 holds the full
// street/building, the town groups with its county, and the postcode is slotted
// even when lower-cased or a bare outward code. See lib/utils/address.ts.
function parseAddress(addr: string) {
  const { street, town, postcode } = parseAddressParts(addr);
  return { street, city: town, postcode };
}

const H1_STYLE: CSSProperties = {
  fontSize: "clamp(28px, 3.4vw, 44px)", fontWeight: 440, color: "var(--agent-text-primary)",
  margin: "14px 0 0", letterSpacing: "-0.032em", lineHeight: 1.06,
};
const LINE2_STYLE: CSSProperties = { margin: "6px 0 0", fontSize: 15, color: "var(--agent-text-muted)", lineHeight: 1.35 };

export function HeroAddressEdit({ transactionId, address, trailing }: { transactionId: string; address: string; trailing?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseAddress(address);
  const [street, setStreet] = useState(parsed.street);
  const [city, setCity] = useState(parsed.city);
  const [postcode, setPostcode] = useState(parsed.postcode);

  const joined = [street.trim(), city.trim(), postcode.trim()].filter(Boolean).join(", ");
  const changed = joined !== address && !!street.trim();

  // Heading + subtitle use the same county-aware parse as the edit boxes, so the
  // H1 is the full clean first line (not just the text before the first comma —
  // which truncated "Flat 2, Hafod, Church Road" down to "Flat 2"). The subtitle
  // carries whatever the heading didn't: town (+ county) then postcode.
  const line1 = parsed.street || parsed.city || parsed.postcode || address;
  const line2 = (
    parsed.street
      ? [parsed.city, parsed.postcode]
      : parsed.city
        ? [parsed.postcode]
        : []
  ).filter(Boolean).join(", ");

  function open() {
    const p = parseAddress(address);
    setStreet(p.street); setCity(p.city); setPostcode(p.postcode);
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!changed) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      await saveAddressAction(transactionId, joined);
      setEditing(false);
      // PERF-03: no client refresh — saveAddressAction revalidates the file page,
      // so its response already carries the re-render.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the address");
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <button
          type="button"
          onClick={open}
          className="group"
          aria-label="Edit address"
          style={{ display: "block", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
        >
          <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6 }}>
            <h1 data-sensitive="true" style={H1_STYLE}>{line1}</h1>
            <PencilSimple size={16} weight="regular" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--agent-text-muted)", flexShrink: 0, marginTop: 18 }} />
          </span>
        </button>
        {(line2 || trailing) && (
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 6, flexWrap: "wrap" }}>
            {line2 && <p data-sensitive="true" style={{ ...LINE2_STYLE, margin: 0 }}>{line2}</p>}
            {trailing}
          </div>
        )}
      </div>
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
        <button onClick={save} disabled={!changed || saving} className="py-2 px-4 rounded-xl agent-btn-color-primary text-xs font-semibold transition-colors disabled:opacity-40">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} disabled={saving} className="py-2 px-4 rounded-xl text-xs text-slate-900/60 glass-subtle transition-colors disabled:opacity-40" style={{ border: "0.5px solid rgba(255,255,255,0.50)" }}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
