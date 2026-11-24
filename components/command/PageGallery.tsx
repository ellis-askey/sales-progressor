"use client";

import { useState } from "react";

// Command-Centre page gallery. Lists every page + state and loads the real route
// in an iframe (byte-for-byte). Dark utilitarian chrome to match the Command
// Centre; the framed pages render in their own (light) styling. Superadmin-only
// tool — do not import outside the Command Centre (Law 8).

export interface GalleryItem {
  label: string;
  url: string;
  /** Small warning under the item (e.g. "redirects when logged in"). */
  note?: string;
}
export interface GalleryGroup {
  category: string;
  blurb?: string;
  items: GalleryItem[];
}

// Command palette (blue accent, hairline borders, no glass).
const BG = "#0a0a0a";
const PANEL = "#111111";
const TOOLBAR = "#141414";
const INK = "#d4d4d4";
const INK_STRONG = "#fafafa";
const MUTED = "#737373";
const FAINT = "#404040";
const LINE = "#262626";
const ACCENT = "#2563eb";
const ACTIVE_BG = "#1d2d50";
const ACTIVE_FG = "#93c5fd";

const DEVICES = [
  { id: "desktop", label: "Desktop", w: 1280 },
  { id: "tablet", label: "Tablet", w: 834 },
  { id: "mobile", label: "Mobile", w: 390 },
] as const;
type DeviceId = (typeof DEVICES)[number]["id"];

export function PageGallery({ groups, heightCss = "100vh" }: { groups: GalleryGroup[]; heightCss?: string }) {
  const first = groups[0]?.items[0];
  const [selected, setSelected] = useState<GalleryItem | null>(first ?? null);
  const [device, setDevice] = useState<DeviceId>("desktop");
  const [reloadKey, setReloadKey] = useState(0);

  const dev = DEVICES.find((d) => d.id === device)!;

  return (
    <div style={{ display: "flex", height: heightCss, background: BG, color: INK, border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
      {/* ── Left: the page list ── */}
      <aside style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${LINE}`, overflowY: "auto", padding: "14px 12px 32px", background: PANEL }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT }}>Page gallery</div>
        <p style={{ margin: "6px 0 16px", fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
          Every page + state, live in the frame. Tokens seed automatically.
        </p>
        {groups.map((g) => (
          <div key={g.category} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT, marginBottom: 6 }}>{g.category}</div>
            {g.blurb && <p style={{ margin: "0 0 6px", fontSize: 10.5, color: MUTED, lineHeight: 1.4 }}>{g.blurb}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {g.items.map((it) => {
                const active = selected?.url === it.url;
                return (
                  <button
                    key={it.url}
                    onClick={() => { setSelected(it); setReloadKey((k) => k + 1); }}
                    style={{
                      textAlign: "left", padding: "7px 9px", borderRadius: 7, cursor: "pointer",
                      border: "1px solid transparent",
                      background: active ? ACTIVE_BG : "transparent",
                      color: active ? ACTIVE_FG : INK, fontSize: 12.5, fontWeight: active ? 600 : 500,
                      lineHeight: 1.3, transition: "background 0.1s, color 0.1s",
                    }}
                  >
                    {it.label}
                    {it.note && <span style={{ display: "block", fontSize: 10, color: FAINT, fontWeight: 400, marginTop: 2 }}>{it.note}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      {/* ── Right: the live frame ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ height: 48, flexShrink: 0, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 10, padding: "0 12px", background: TOOLBAR }}>
          <div style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: 7, overflow: "hidden" }}>
            {DEVICES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDevice(d.id)}
                style={{
                  padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                  background: device === d.id ? ACCENT : "transparent", color: device === d.id ? "#fff" : MUTED,
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: FAINT, fontVariantNumeric: "tabular-nums" }}>
            {device === "desktop" ? "fluid" : `${dev.w}px`}
          </span>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: INK_STRONG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
            {selected?.label}
          </div>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            style={{ padding: "5px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${LINE}`, borderRadius: 7, background: "transparent", color: INK }}
          >
            Reload
          </button>
          {selected && (
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "5px 9px", fontSize: 12, fontWeight: 600, textDecoration: "none", border: `1px solid ${LINE}`, borderRadius: 7, background: "transparent", color: ACTIVE_FG }}
            >
              New tab ↗
            </a>
          )}
        </div>

        {/* Frame area */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", justifyContent: "center", padding: device === "desktop" ? 0 : "18px", background: device === "desktop" ? "#fff" : "#000" }}>
          {selected ? (
            <iframe
              key={`${selected.url}::${reloadKey}`}
              src={selected.url}
              title={selected.label}
              style={{
                border: device === "desktop" ? "none" : `1px solid ${LINE}`,
                borderRadius: device === "desktop" ? 0 : 12,
                width: device === "desktop" ? "100%" : dev.w,
                height: "100%",
                minHeight: device === "desktop" ? "100%" : 700,
                background: "#fff", flexShrink: 0,
              }}
            />
          ) : (
            <div style={{ margin: "auto", color: MUTED, fontSize: 13 }}>Pick a page from the left.</div>
          )}
        </div>
      </main>
    </div>
  );
}
