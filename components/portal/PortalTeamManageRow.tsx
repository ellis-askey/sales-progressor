"use client";

// A whole-row tappable wrapper for the "Your team" card (Batch 4, 2026-08-16).
// Replaces the filled "Edit" / "Add" buttons: the entire row is the control,
// with a subtle pencil (edit) or chevron (add) on the right. Tapping routes to
// the menu drawer's matching section — the same deep-link the old buttons used.
// Keeps PortalTeamCard a server component; this is the one interactive island
// per manageable row.

import { PencilSimple, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { P } from "@/components/portal/portal-ui";
import type { EditDrawerConfig } from "./PortalEditDrawer";

export function PortalTeamManageRow({
  section,
  icon,
  label,
  topBorder = true,
  agentConfig,
  children,
}: {
  /** Menu-drawer section to scroll to: "agents" or "solicitor". */
  section: "agents" | "solicitor";
  /** "edit" → pencil (something already set); "add" → chevron (nothing yet). */
  icon: "edit" | "add";
  /** Accessible description of what tapping does. */
  label: string;
  topBorder?: boolean;
  /** For the agents row: opens the edit drawer directly with prefilled data. */
  agentConfig?: EditDrawerConfig;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="portal-team-row"
      aria-label={label}
      onClick={() =>
        window.dispatchEvent(
          section === "agents" && agentConfig
            ? new CustomEvent("portal:open-edit-drawer", { detail: agentConfig })
            : new CustomEvent("portal:open-menu", { detail: { section } }),
        )
      }
      style={{
        display: "flex",
        gap: 13,
        padding: "13px 18px",
        alignItems: "flex-start",
        width: "100%",
        border: 0,
        borderTop: topBorder ? `1px solid ${P.borderSubtle}` : undefined,
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {children}
      <span aria-hidden style={{ flexShrink: 0, alignSelf: "center", color: P.textMuted, display: "inline-flex" }}>
        {icon === "edit" ? <PencilSimple size={16} weight="regular" /> : <CaretRight size={16} weight="bold" />}
      </span>
    </button>
  );
}

// Standalone pencil for a row that carries its own controls (e.g. the solicitor
// row's Email button), where the whole row can't be one big <button>. Deep-links
// to the same menu-drawer section as PortalTeamManageRow.
export function PortalManagePencil({
  section,
  label,
}: {
  section: "agents" | "solicitor";
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section } }))}
      className="pbtn pbtn-press"
      style={{
        flexShrink: 0,
        alignSelf: "center",
        padding: 7,
        borderRadius: 9,
        border: 0,
        background: "transparent",
        color: P.textMuted,
        cursor: "pointer",
        display: "inline-flex",
      }}
    >
      <PencilSimple size={16} weight="regular" />
    </button>
  );
}
