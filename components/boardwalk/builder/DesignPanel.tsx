"use client";

// Design tab panel: theme presets plus focused overrides (colours, font,
// layout, progress, logo, background). Edits land instantly in the centre
// preview because both read the same definition.

import type { FormDefinition, FormTheme } from "@/lib/forms/types";
import { THEME_PRESETS } from "@/lib/forms/defaults";
import { BwField } from "../ui";

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 550 }}>{label}</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          style={{ width: 34, height: 28, border: "1px solid var(--bw-line-strong)", borderRadius: 7, padding: 2, background: "var(--bw-paper-raised)", cursor: "pointer" }}
        />
        <input
          className="bw-input bw-input-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 86, fontFamily: "monospace", fontSize: 12 }}
        />
      </div>
    </div>
  );
}

export function DesignPanel({
  def,
  update,
}: {
  def: FormDefinition;
  update: (fn: (d: FormDefinition) => FormDefinition) => void;
}) {
  const t = def.theme;
  const setTheme = (patch: Partial<FormTheme>) =>
    update((d) => ({ ...d, theme: { ...d.theme, ...patch } }));

  return (
    <aside
      className="bw-scroll"
      style={{
        width: 330,
        minWidth: 280,
        flex: "0 0 auto",
        borderLeft: "1px solid var(--bw-line)",
        background: "var(--bw-paper-raised)",
        overflowY: "auto",
        padding: "16px 16px 60px",
      }}
    >
      <h2 className="bw-display" style={{ fontSize: 17, margin: "0 0 4px" }}>Design</h2>
      <p className="bw-hint" style={{ margin: "0 0 16px" }}>Changes apply to this form and show in the preview instantly.</p>

      <p className="bw-label">Presets</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {Object.values(THEME_PRESETS).map((preset) => {
          const active = t.preset === preset.preset;
          return (
            <button
              key={preset.preset}
              onClick={() => setTheme({ ...preset })}
              style={{
                borderRadius: 12,
                border: `2px solid ${active ? "var(--bw-green)" : "var(--bw-line)"}`,
                background: preset.backgroundColor,
                color: preset.textColor,
                padding: "14px 10px 10px",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 140ms ease, transform 140ms ease",
                fontFamily: preset.font === "serif" ? "Georgia, serif" : "var(--bw-font-sans)",
              }}
            >
              <span style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 7 }}>Aa</span>
              <span style={{ display: "inline-block", background: preset.primaryColor, color: preset.buttonTextColor, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: preset.buttonRadius }}>
                Button
              </span>
              <span style={{ display: "block", fontSize: 10.5, marginTop: 8, opacity: 0.65, textTransform: "capitalize" }}>{preset.preset}</span>
            </button>
          );
        })}
      </div>

      <p className="bw-label">Colours</p>
      <div style={{ marginBottom: 18 }}>
        <ColourField label="Buttons & accents" value={t.primaryColor} onChange={(v) => setTheme({ primaryColor: v, preset: "custom" })} />
        <ColourField label="Background" value={t.backgroundColor} onChange={(v) => setTheme({ backgroundColor: v, preset: "custom" })} />
        <ColourField label="Text" value={t.textColor} onChange={(v) => setTheme({ textColor: v, preset: "custom" })} />
        <ColourField label="Button text" value={t.buttonTextColor} onChange={(v) => setTheme({ buttonTextColor: v, preset: "custom" })} />
      </div>

      <BwField label="Font">
        <select className="bw-select" value={t.font} onChange={(e) => setTheme({ font: e.target.value as FormTheme["font"] })}>
          <option value="sans">Modern sans-serif</option>
          <option value="serif">Classic serif</option>
          <option value="display">Editorial display</option>
          <option value="mono">Monospace</option>
        </select>
      </BwField>

      <BwField label="Button corners">
        <select className="bw-select" value={t.buttonRadius} onChange={(e) => setTheme({ buttonRadius: Number(e.target.value) })}>
          <option value={2}>Square</option>
          <option value={10}>Rounded</option>
          <option value={24}>Pill</option>
        </select>
      </BwField>

      <BwField label="Background style">
        <select className="bw-select" value={t.backgroundStyle} onChange={(e) => setTheme({ backgroundStyle: e.target.value as FormTheme["backgroundStyle"] })}>
          <option value="solid">Solid colour</option>
          <option value="gradient">Soft gradient</option>
          <option value="image">Image</option>
        </select>
      </BwField>
      {t.backgroundStyle === "image" && (
        <BwField label="Background image URL" hint="A calm, low-contrast photo works best. The background colour is overlaid for readability.">
          <input className="bw-input" placeholder="https://…" value={t.backgroundImageUrl ?? ""} onChange={(e) => setTheme({ backgroundImageUrl: e.target.value || undefined })} />
        </BwField>
      )}

      <BwField label="Logo URL (optional)" hint="Shown top-left on the form.">
        <input className="bw-input" placeholder="https://…" value={t.logoUrl ?? ""} onChange={(e) => setTheme({ logoUrl: e.target.value || undefined })} />
      </BwField>

      <BwField label="Layout">
        <select className="bw-select" value={t.layout} onChange={(e) => setTheme({ layout: e.target.value as FormTheme["layout"] })}>
          <option value="one_at_a_time">One question at a time</option>
          <option value="classic">Classic: all questions on one page</option>
        </select>
      </BwField>

      <BwField label="Progress indicator">
        <select className="bw-select" value={t.progressStyle} onChange={(e) => setTheme({ progressStyle: e.target.value as FormTheme["progressStyle"] })}>
          <option value="bar">Progress bar</option>
          <option value="fraction">Percentage</option>
          <option value="none">None</option>
        </select>
      </BwField>
    </aside>
  );
}
