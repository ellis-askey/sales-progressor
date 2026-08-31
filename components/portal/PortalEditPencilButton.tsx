"use client";

// Bare pencil (no background) that opens the stacked edit drawer with a
// prefilled config. Used from server components (e.g. the Overview team card)
// that can't hold onClick handlers themselves.

import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { EditDrawerConfig } from "./PortalEditDrawer";

export function PortalEditPencilButton({ config, label }: { config: EditDrawerConfig; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => window.dispatchEvent(new CustomEvent("portal:open-edit-drawer", { detail: config }))}
      className="pbtn-press"
      style={{
        background: "none", border: "none", padding: 4, cursor: "pointer",
        color: "var(--portal-textMuted, #8B91A3)", display: "inline-flex",
        alignItems: "center", flexShrink: 0,
      }}
    >
      <PencilSimple size={16} weight="regular" />
    </button>
  );
}
