"use client";

// Brand-colour picker — replaces the 6 preset themes. Pick a colour from the
// wheel or type a hex code; a couple of suggested swatches for a quick start.
// Saving derives the whole app palette from this one colour (see
// lib/agent/brand-theme.ts). Buttons, links, focus and the ambient glow take
// the colour; glass cards and the red/amber/green stay fixed.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBrandColor } from "@/app/actions/agent-preferences";
import { normaliseHex, DEFAULT_BRAND_HEX } from "@/lib/agent/brand-theme";
import { useAgentToast } from "@/components/agent/AgentToaster";

const SUGGESTED = ["#FF6B4A", "#2563EB", "#0891B2", "#16A34A", "#7C3AED", "#DB2777", "#D97706", "#0F3845"];

// Quick white-vs-dark decision for the preview button text.
function isLight(hex: string): boolean {
  const h = hex.replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62;
}

export function BrandColorPicker({ initialColor }: { initialColor: string }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const start0 = normaliseHex(initialColor) ?? DEFAULT_BRAND_HEX;
  const [color, setColor] = useState(start0);
  const [hexText, setHexText] = useState(start0);
  const [saved, setSaved] = useState(start0);
  const [saving, startSaving] = useTransition();

  const dirty = color.toLowerCase() !== saved.toLowerCase();
  const previewText = isLight(color) ? "#1a1512" : "#ffffff";

  function apply(hex: string) {
    const n = normaliseHex(hex);
    if (!n) { toast.error("Enter a valid colour, e.g. #2563EB"); return; }
    setColor(n); setHexText(n);
    startSaving(async () => {
      const r = await updateBrandColor(n);
      if (r.ok) { setSaved(n); toast.success("Brand colour updated"); router.refresh(); }
      else toast.error(r.error);
    });
  }

  const swatch: React.CSSProperties = { width: 26, height: 26, borderRadius: 7, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.12)", padding: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pick + preview */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <label style={{ position: "relative", width: 52, height: 52, borderRadius: 12, cursor: "pointer", flexShrink: 0, background: color, border: "0.5px solid rgba(0,0,0,0.12)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }}>
          <input
            type="color"
            value={color}
            onChange={(e) => { setColor(e.target.value); setHexText(e.target.value); }}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
            aria-label="Pick brand colour"
          />
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 500 }}>Hex code</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={hexText}
              onChange={(e) => {
                setHexText(e.target.value);
                const n = normaliseHex(e.target.value);
                if (n) setColor(n);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") apply(hexText); }}
              placeholder="#2563EB"
              spellCheck={false}
              className="account-input"
              style={{ width: 120, padding: "8px 10px", fontSize: 13.5, fontFamily: "ui-monospace, monospace", color: "#111827", background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, outline: "none" }}
            />
          </div>
        </div>
        {/* Live preview of a button + link in the picked colour */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: previewText, background: color }}>
            Confirm
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color }}>A link</span>
        </div>
      </div>

      {/* Suggested swatches */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "#9ca3af" }}>Suggestions</span>
        {SUGGESTED.map((s) => (
          // Select only — the colour is applied when "Save colour" is pressed,
          // not on pick (no silent auto-save).
          <button key={s} type="button" onClick={() => { setColor(s); setHexText(s); }} title={s} aria-label={`Use ${s}`} style={{ ...swatch, background: s, outline: s.toLowerCase() === color.toLowerCase() ? "2px solid #111827" : "none", outlineOffset: 1 }} />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => apply(color)}
          disabled={saving || !dirty}
          className="account-btn-primary"
          style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0, cursor: saving || !dirty ? "default" : "pointer" }}
        >
          {saving ? "Saving…" : "Save colour"}
        </button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "#9ca3af" }}>Glass cards and the status colours (green / amber / red) stay the same.</span>
      </div>
    </div>
  );
}
