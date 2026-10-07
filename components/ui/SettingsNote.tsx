// SettingsNote — the calm, inset sibling of the glass `Banner`/`AgentBanner`.
//
// Banner was built to FLOAT over the transaction photo backdrop (24px blur,
// drop shadow, 18px radius). On a calm settings/account page that chrome is too
// loud, which is why ~23 notices across Settings & Account were hand-rolled as
// one-off tinted strips in a dozen different looks (three stray blues, a coral
// mis-used as info, Tailwind palette islands, literal "i" glyphs).
//
// This is the single home for those. "Frost" treatment (founder pick, 2026-10-07):
// the house frosted material (reuses --agent-banner-mat-* tokens, so dark mode is
// already handled), flattened a touch to sit inset among settings cards. Tone is
// carried ONLY by the icon colour — the surface stays neutral and coral is kept
// out (it's the brand/action colour, never a notice tone). Server-safe: no client
// hooks, ssr icons, action passed as a slot.
//
// Catalog: docs/reference/COMPONENT_LIBRARY_CATALOG.md §1.x.

import type { CSSProperties, ReactNode } from "react";
import { Info, CheckCircle, Warning, WarningOctagon } from "@phosphor-icons/react/dist/ssr";

export type SettingsNoteTone = "info" | "success" | "warning" | "danger" | "neutral";

// Each tone maps to a live semantic token — no hard-coded hexes.
const TONE_COLOR: Record<SettingsNoteTone, string> = {
  info: "var(--agent-info)",
  success: "var(--agent-success)",
  warning: "var(--agent-warning)",
  danger: "var(--agent-danger)",
  neutral: "var(--agent-text-muted)",
};

// The icon is the only element that carries tone. Callers can override via `icon`
// (e.g. a Sparkle on an AI empty-state) but the default is correct for each tone.
const DEFAULT_ICON: Record<SettingsNoteTone, ReactNode> = {
  info: <Info size={18} weight="fill" />,
  success: <CheckCircle size={18} weight="fill" />,
  warning: <Warning size={18} weight="fill" />,
  danger: <WarningOctagon size={18} weight="fill" />,
  neutral: <Info size={18} weight="fill" />,
};

type Props = {
  /** Visual tone. Defaults to "info". Coral is deliberately not an option. */
  tone?: SettingsNoteTone;
  /** The headline line, in neutral ink (the icon signals the tone, not the text). */
  title: string;
  /** Optional second line in secondary ink. Many notices are title-only. */
  body?: ReactNode;
  /** Override the default tone icon (sized 18, coloured by the tone). */
  icon?: ReactNode;
  /** Right-aligned slot — a Link or a client button. Inherits the tone colour. */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function SettingsNote({ tone = "info", title, body, icon, action, className, style }: Props) {
  const color = TONE_COLOR[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={className}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        padding: "13px 15px",
        borderRadius: 14,
        background: "var(--agent-banner-mat-bg, rgba(255,255,255,0.55))",
        backdropFilter: "blur(18px) saturate(165%)",
        WebkitBackdropFilter: "blur(18px) saturate(165%)",
        border: "1px solid var(--agent-banner-mat-border, rgba(255,255,255,0.7))",
        boxShadow:
          "var(--agent-banner-mat-shadow, 0 10px 30px rgba(15,26,46,0.12)), inset 0 1px 0 var(--agent-banner-mat-highlight, rgba(255,255,255,0.4))",
        ...style,
      }}
    >
      <span aria-hidden style={{ flexShrink: 0, marginTop: 0.5, color, display: "flex", alignItems: "center" }}>
        {icon ?? DEFAULT_ICON[tone]}
      </span>

      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.4, letterSpacing: "-0.005em" }}>
          {title}
        </p>
        {body != null && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
            {body}
          </p>
        )}
      </div>

      {action != null && (
        <span style={{ marginLeft: "auto", alignSelf: "center", flexShrink: 0, color, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
          {action}
        </span>
      )}
    </div>
  );
}
