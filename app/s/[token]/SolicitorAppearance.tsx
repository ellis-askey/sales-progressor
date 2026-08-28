"use client";

import { useEffect, useState } from "react";
import { TextAa, Book, Waveform } from "@phosphor-icons/react/dist/ssr";
import { S } from "./ui";

// Per-device accessibility controls, borrowed from the client portal's appearance
// settings. These set the same <html> data attributes the global portal CSS
// already keys off (zoom for text size, OpenDyslexic for the font, and the
// reduced-motion block), so no component styling has to change. Stored in
// localStorage (per device), applied pre-paint by the boot script in the layout.
// Dark mode is deliberately omitted: the solicitor surface is a fixed light,
// professional skin, and a full dark theme needs the cards moved onto theme
// variables first.

const KEY = "sol_a11y";
type TextSize = "default" | "large" | "larger";
type Prefs = { textSize: TextSize; dyslexic: boolean; reduceMotion: boolean };

const DEFAULTS: Prefs = { textSize: "default", dyslexic: false, reduceMotion: false };

export function readA11y(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs) {
  const d = document.documentElement;
  if (p.textSize !== "default") d.setAttribute("data-portal-textsize", p.textSize);
  else d.removeAttribute("data-portal-textsize");
  if (p.dyslexic) d.setAttribute("data-portal-font", "dyslexic");
  else d.removeAttribute("data-portal-font");
  if (p.reduceMotion) d.setAttribute("data-portal-motion", "reduced");
  else d.removeAttribute("data-portal-motion");
}

export function SolicitorAppearance() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    setPrefs(readA11y());
  }, []);

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    apply(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode; the live change already applied */
    }
  }

  return (
    <div>
      <p style={sectionLabel}>Appearance</p>

      {/* Text size */}
      <div style={rowStyle}>
        <span style={iconBox}><TextAa size={18} weight="regular" /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={rowTitle}>Text size</span>
        </span>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {(["default", "large", "larger"] as TextSize[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ textSize: t })}
              aria-pressed={prefs.textSize === t}
              style={segBtn(prefs.textSize === t)}
            >
              {t === "default" ? "A" : t === "large" ? "A+" : "A++"}
            </button>
          ))}
        </div>
      </div>

      {/* Dyslexia-friendly font */}
      <ToggleRow
        icon={<Book size={18} weight="regular" />}
        title="Dyslexia-friendly font"
        on={prefs.dyslexic}
        onToggle={() => update({ dyslexic: !prefs.dyslexic })}
      />

      {/* Reduce motion */}
      <ToggleRow
        icon={<Waveform size={18} weight="regular" />}
        title="Reduce motion"
        on={prefs.reduceMotion}
        onToggle={() => update({ reduceMotion: !prefs.reduceMotion })}
      />

      <p style={{ margin: "8px 2px 0", fontSize: 11.5, color: S.faint, lineHeight: 1.5 }}>These settings are saved on this device only.</p>
    </div>
  );
}

function ToggleRow({ icon, title, on, onToggle }: { icon: React.ReactNode; title: string; on: boolean; onToggle: () => void }) {
  return (
    <div style={rowStyle}>
      <span style={iconBox}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={rowTitle}>{title}</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={title}
        style={{ width: 44, height: 26, borderRadius: 13, border: "none", padding: 0, position: "relative", cursor: "pointer", background: on ? S.accent : "rgba(15,39,64,0.18)", transition: "background 180ms ease", flexShrink: 0 }}
      >
        <span style={{ position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: 10, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform 180ms cubic-bezier(0.16,1,0.3,1)" }} />
      </button>
    </div>
  );
}

const sectionLabel: React.CSSProperties = { margin: "16px 2px 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted };
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, background: S.nested, border: `1px solid ${S.nestedBorder}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 };
const iconBox: React.CSSProperties = { width: 36, height: 36, borderRadius: 9, background: "rgba(15,39,64,0.06)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: S.muted, flexShrink: 0 };
const rowTitle: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 600, color: S.ink };

function segBtn(active: boolean): React.CSSProperties {
  return {
    minWidth: 34,
    padding: "6px 8px",
    fontSize: 12.5,
    fontWeight: 700,
    color: active ? S.accent : S.muted,
    background: active ? S.accentBg : "#fff",
    border: `1px solid ${active ? S.accentBorder : "#d5deea"}`,
    borderRadius: 8,
    cursor: "pointer",
  };
}
