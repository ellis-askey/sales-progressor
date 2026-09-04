"use client";
// Drawer / modal DESIGN DIRECTIONS for the /dev/sheets bench.
//
// The point: give a few complete, opinionated looks — surface + header +
// section structure + fields + footer + accent — not translucent alpha
// variations that all read grey. Pick one as the precedent and every
// drawer/modal follows the same family.
//
// Each preset ships a `skin` (concrete style pieces) that the bench interior
// (BenchHeader / BenchSections / BenchFooter) renders against, plus the panel
// surfaceVariant + footerVariant the real primitive takes. Everything is
// token-driven so a single skin reads correctly in light and dark.

import type { CSSProperties, ReactNode } from "react";
import { PencilSimpleLine, Users, Scales } from "@phosphor-icons/react";
import type { GlassVariantId } from "@/lib/glass/variants";
import { ADDRESS, LONG_NOTE } from "./fixtures";

export type PresetSkin = {
  // ── Header ────────────────────────────────────────────────────────────
  // Style merged onto the primitive's Header part (background, border, padding).
  headerWrap: CSSProperties;
  showIconChip: boolean;
  iconChip?: CSSProperties;
  iconColor?: string;
  kicker?: CSSProperties;
  title: CSSProperties;
  subtitle: CSSProperties;
  // A short accent rule drawn under the header text (null = none).
  headerRule?: CSSProperties | null;
  // ── Body ──────────────────────────────────────────────────────────────
  bodyWrap: CSSProperties;
  sectionGap: number;
  // When true each section is wrapped in its own card (bento depth).
  nested: boolean;
  sectionCard?: CSSProperties;
  sectionLabel: CSSProperties;
  // A small accent mark before the section label (square tick / left bar / none).
  sectionMark?: CSSProperties | null;
  // Divider drawn between sections when not nested (null = none).
  sectionDivider?: string | null;
  fieldLabel: CSSProperties;
  field: CSSProperties;
  note: CSSProperties;
};

export type DrawerPreset = {
  id: string;
  label: string;
  blurb: string;
  surfaceVariant: GlassVariantId | null;
  footerVariant: "default" | "glass";
  skin: PresetSkin;
};

// ── Shared token shorthands ──────────────────────────────────────────────────
const T = {
  primary: "var(--agent-text-primary)",
  secondary: "var(--agent-text-secondary)",
  muted: "var(--agent-text-muted)",
  coral: "var(--agent-coral)",
  coralDeep: "var(--agent-coral-deep)",
  coralTint: "var(--agent-coral-bg-tint)",
  onCoral: "var(--agent-text-on-coral, #fff)",
  borderSubtle: "var(--agent-border-subtle)",
  borderDefault: "var(--agent-border-default)",
  elevated: "var(--agent-surface-elevated)",
  nested: "var(--agent-surface-nested, rgba(255,255,255,0.6))",
};

const upperLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

// ── Reusable interior recipe: clean "paper" body (Editorial's structure) ──────
// Hairline dividers, coral square section ticks, inset field wells. Shared by
// the hybrids so only the HEADER personality changes between them.
const paperBody: Pick<
  PresetSkin,
  "bodyWrap" | "sectionGap" | "nested" | "sectionLabel" | "sectionMark" | "sectionDivider" | "fieldLabel" | "field" | "note"
> = {
  bodyWrap: { padding: "18px 24px 22px" },
  sectionGap: 22,
  nested: false,
  sectionLabel: { ...upperLabel, fontSize: 11, color: T.secondary, display: "flex", alignItems: "center", gap: 8 },
  sectionMark: { width: 6, height: 6, borderRadius: 1.5, background: T.coralDeep },
  sectionDivider: `1px solid ${T.borderSubtle}`,
  fieldLabel: { fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5 },
  // Matches the canonical .agent-input line: 0.5px border, radius-md, elevated
  // surface — the same thin line as the add-a-sale postcode field.
  field: { padding: "11px 13px", borderRadius: "var(--agent-radius-md)", background: T.elevated, border: "0.5px solid var(--agent-border-default)", fontSize: 13, color: T.primary },
  note: { fontSize: 13, lineHeight: 1.65, color: T.secondary },
};

// ── The directions ───────────────────────────────────────────────────────────
export const PRESETS: DrawerPreset[] = [
  // 1 — REFINED (hybrid, default). Editorial's clean paper body + a branded
  //     header: coral icon chip, coral kicker, a coral→transparent hairline
  //     rule, blur-through footer. Beautiful, clean, unmistakably ours.
  {
    id: "refined",
    label: "Refined",
    blurb: "Editorial body · coral chip + fade rule · blur footer",
    surfaceVariant: "v01",
    footerVariant: "glass",
    skin: {
      ...paperBody,
      headerWrap: { background: "transparent", borderBottom: "none", padding: "22px 24px 14px" },
      showIconChip: true,
      iconChip: { width: 40, height: 40, borderRadius: 12, background: T.coralTint, border: `1px solid ${T.borderDefault}`, display: "flex", alignItems: "center", justifyContent: "center" },
      iconColor: T.coralDeep,
      kicker: { ...upperLabel, fontSize: 10, color: T.coralDeep },
      title: { margin: "2px 0 0", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: T.primary },
      subtitle: { margin: "3px 0 0", fontSize: 13, color: T.muted },
      headerRule: { height: 2, borderRadius: 2, marginTop: 14, background: `linear-gradient(90deg, ${T.coral} 0%, ${T.coralDeep} 26%, transparent 92%)` },
    },
  },

  // 2 — CREST (hybrid). A soft coral-TINT header zone with dark text (not a
  //     full band) + coral chip, over the same clean paper body. Branded but
  //     light.
  {
    id: "crest",
    label: "Crest",
    blurb: "Soft coral-tint header zone · dark text · clean body",
    surfaceVariant: "v01",
    footerVariant: "glass",
    skin: {
      ...paperBody,
      headerWrap: { background: T.coralTint, borderBottom: `1px solid ${T.borderSubtle}`, padding: "20px 24px 18px" },
      showIconChip: true,
      iconChip: { width: 40, height: 40, borderRadius: 12, background: T.elevated, border: `1px solid ${T.borderDefault}`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" },
      iconColor: T.coralDeep,
      kicker: { ...upperLabel, fontSize: 10, color: T.coralDeep },
      title: { margin: "2px 0 0", fontSize: 19, fontWeight: 700, color: T.primary },
      subtitle: { margin: "2px 0 0", fontSize: 12.5, color: T.muted },
      headerRule: null,
    },
  },

  // 3 — RIBBON (hybrid). A SLIM coral band — Contrast's identity, trimmed — over
  //     the clean paper body. The middle ground.
  {
    id: "ribbon",
    label: "Ribbon",
    blurb: "Slim coral band · clean paper body · blur footer",
    surfaceVariant: "v01",
    footerVariant: "glass",
    skin: {
      ...paperBody,
      headerWrap: { background: T.coralDeep, borderBottom: "none", padding: "15px 24px 15px", color: T.onCoral },
      showIconChip: false,
      kicker: { ...upperLabel, fontSize: 10, color: "rgba(255,255,255,0.78)" },
      title: { margin: "2px 0 0", fontSize: 17, fontWeight: 700, color: T.onCoral },
      subtitle: { margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.88)" },
      headerRule: null,
    },
  },

  // 4 — EDITORIAL. Solid paper, hairline dividers, coral ticks. No header chip
  //     — the calmest, most typographic direction.
  {
    id: "editorial",
    label: "Editorial",
    blurb: "Solid paper · hairline dividers · coral section ticks",
    surfaceVariant: "v01",
    footerVariant: "default",
    skin: {
      ...paperBody,
      headerWrap: { background: "transparent", borderBottom: "none", padding: "22px 24px 16px" },
      showIconChip: false,
      kicker: { ...upperLabel, fontSize: 10, color: T.coralDeep },
      title: { margin: "6px 0 0", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", color: T.primary },
      subtitle: { margin: "3px 0 0", fontSize: 13, color: T.muted },
      headerRule: { width: 34, height: 2, borderRadius: 2, background: T.coralDeep, marginTop: 12 },
    },
  },

  // 5 — CONTRAST. Full coral header band, white body, bold dividers.
  //     Maximum identity — the boldest option.

  // ── BENTO. Frosted panel, but each section is a solid floating card. Depth
  //    and structure — the strongest answer to "nothing breaks up the card".
  {
    id: "bento",
    label: "Bento",
    blurb: "Frosted panel · solid floating section cards · depth",
    surfaceVariant: "v05",
    footerVariant: "glass",
    skin: {
      headerWrap: { background: "transparent", borderBottom: "none", padding: "20px 22px 8px" },
      showIconChip: true,
      iconChip: { width: 38, height: 38, borderRadius: 11, background: T.elevated, border: `1px solid ${T.borderDefault}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center" },
      iconColor: T.coralDeep,
      kicker: { ...upperLabel, fontSize: 10, color: T.muted },
      title: { margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: T.primary },
      subtitle: { margin: "2px 0 0", fontSize: 12.5, color: T.muted },
      headerRule: null,
      bodyWrap: { padding: "10px 16px 16px", display: "flex", flexDirection: "column" },
      sectionGap: 12,
      nested: true,
      sectionCard: { background: T.elevated, border: `1px solid ${T.borderSubtle}`, borderRadius: 16, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" },
      sectionLabel: { ...upperLabel, fontSize: 10.5, color: T.muted, marginBottom: 12 },
      sectionMark: null,
      sectionDivider: null,
      fieldLabel: { fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 },
      field: { padding: "9px 0", borderBottom: `1px solid ${T.borderSubtle}`, fontSize: 13, color: T.primary },
      note: { fontSize: 13, lineHeight: 1.6, color: T.secondary },
    },
  },

  // 4 — CONTRAST. A bold coral header band with white text, then a clean solid
  //     body with strong dividers. Editorial, memorable, instant identity.
  {
    id: "contrast",
    label: "Contrast",
    blurb: "Coral header band · white body · bold dividers",
    surfaceVariant: "v01",
    footerVariant: "default",
    skin: {
      headerWrap: { background: T.coralDeep, borderBottom: "none", padding: "22px 24px 20px", color: T.onCoral },
      showIconChip: true,
      iconChip: { width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" },
      iconColor: T.onCoral,
      kicker: { ...upperLabel, fontSize: 10, color: "rgba(255,255,255,0.75)" },
      title: { margin: "2px 0 0", fontSize: 19, fontWeight: 700, color: T.onCoral },
      subtitle: { margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)" },
      headerRule: null,
      bodyWrap: { padding: "20px 24px" },
      sectionGap: 20,
      nested: false,
      sectionLabel: { ...upperLabel, fontSize: 11, color: T.primary },
      sectionMark: null,
      sectionDivider: `1.5px solid ${T.borderDefault}`,
      fieldLabel: { fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5 },
      field: { padding: "10px 0 10px", borderBottom: `1.5px solid ${T.borderDefault}`, fontSize: 13.5, fontWeight: 500, color: T.primary },
      note: { fontSize: 13, lineHeight: 1.65, color: T.secondary },
    },
  },

  // 5 — FROST. The current translucent baseline, for comparison.
  {
    id: "frost",
    label: "Frost (current)",
    blurb: "Today's translucent frost — the baseline to beat",
    surfaceVariant: null,
    footerVariant: "default",
    skin: {
      headerWrap: {},
      showIconChip: false,
      title: { margin: 0, fontSize: 15, fontWeight: 700, color: T.primary },
      subtitle: { margin: "2px 0 0", fontSize: 12, color: T.muted },
      headerRule: null,
      bodyWrap: {},
      sectionGap: 16,
      nested: false,
      sectionLabel: { ...upperLabel, fontSize: 11, color: T.muted },
      sectionMark: null,
      sectionDivider: null,
      fieldLabel: { fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 },
      field: { padding: "10px 12px", borderRadius: 10, background: T.nested, border: `1px solid ${T.borderSubtle}`, fontSize: 13, color: T.primary },
      note: { fontSize: 13, lineHeight: 1.6, color: T.secondary },
    },
  },
];

export const DEFAULT_PRESET_ID = "ribbon";

export function getPreset(id: string): DrawerPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

// ── Interior fixture, skin-driven ────────────────────────────────────────────

const SECTIONS: { label: string; Icon: typeof Users; rows: { label: string; value: string }[] }[] = [
  {
    label: "Parties",
    Icon: Users,
    rows: [
      { label: "Buyer", value: "Tom & Rebecca Whitfield" },
      { label: "Seller", value: "Priya Chandrasekaran" },
    ],
  },
  {
    label: "Solicitors",
    Icon: Scales,
    rows: [
      { label: "Buyer's solicitor", value: "Margaret Osei-Bonsu · Carter & Wells" },
      { label: "Seller's solicitor", value: "H. Cholmondeley · Featherstonehaugh LLP" },
    ],
  },
];

export function BenchHeader({ skin }: { skin: PresetSkin }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
      {skin.showIconChip && (
        <span style={skin.iconChip} aria-hidden>
          <PencilSimpleLine size={19} weight="bold" color={skin.iconColor} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        {skin.kicker && <p style={{ margin: 0, ...skin.kicker }}>Sale progression</p>}
        <p style={skin.title}>Edit sale details</p>
        <p style={skin.subtitle}>{ADDRESS}</p>
        {skin.headerRule && <div style={skin.headerRule} />}
      </div>
    </div>
  );
}

function SectionMark({ style }: { style?: CSSProperties | null }) {
  if (!style) return null;
  return <span style={style} aria-hidden />;
}

export function BenchSections({ skin }: { skin: PresetSkin }) {
  const sectionInner = (s: (typeof SECTIONS)[number]) => (
    <>
      <div style={skin.sectionLabel}>
        <SectionMark style={skin.sectionMark} />
        {s.label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: skin.nested ? 0 : 12 }}>
        {s.rows.map((r) => (
          <div key={r.label}>
            <div style={skin.fieldLabel}>{r.label}</div>
            <div style={skin.field}>{r.value}</div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: skin.sectionGap }}>
      {SECTIONS.map((s, i) =>
        skin.nested ? (
          <div key={s.label} style={skin.sectionCard}>
            {sectionInner(s)}
          </div>
        ) : (
          <div
            key={s.label}
            style={{
              paddingTop: i > 0 && skin.sectionDivider ? skin.sectionGap : 0,
              borderTop: i > 0 && skin.sectionDivider ? skin.sectionDivider : "none",
            }}
          >
            {sectionInner(s)}
          </div>
        ),
      )}

      {/* Notes block */}
      {skin.nested ? (
        <div style={skin.sectionCard}>
          <div style={skin.sectionLabel}>
            <SectionMark style={skin.sectionMark} />
            Notes
          </div>
          <p style={{ ...skin.note, marginTop: 12, marginBottom: 0 }}>{LONG_NOTE}</p>
        </div>
      ) : (
        <div
          style={{
            paddingTop: skin.sectionDivider ? skin.sectionGap : 0,
            borderTop: skin.sectionDivider ? skin.sectionDivider : "none",
          }}
        >
          <div style={{ ...skin.sectionLabel, marginBottom: 10 }}>
            <SectionMark style={skin.sectionMark} />
            Notes
          </div>
          <p style={{ ...skin.note, margin: 0 }}>{LONG_NOTE}</p>
        </div>
      )}
    </div>
  );
}

export function BenchFooter(): ReactNode {
  return (
    <>
      <button type="button" className="agent-btn agent-btn-sm agent-btn-secondary">Cancel</button>
      <button type="button" className="agent-btn agent-btn-sm agent-btn-primary">Save changes</button>
    </>
  );
}
