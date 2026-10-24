"use client";

// InfoTip — a small (i) after a title that reveals a short explainer. Now a thin
// wrapper over the canonical Tooltip (portal + flip/shift + edge gutter + locked
// glass), which opens on hover/focus and on tap (touch). Only the (i) button
// chrome is local; the surface + positioning + behaviour come from Tooltip.

import { useEffect, type ReactNode } from "react";
import { Info } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/Popover";

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    .infotip-btn { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; width: 16px; height: 16px; margin-left: 5px; padding: 0; border: none; border-radius: 50%; background: none; color: var(--agent-text-muted, #9ca3af); cursor: pointer; flex-shrink: 0; transition: color .14s ease, background .14s ease; }
    .infotip-btn:hover, .infotip-btn[aria-expanded="true"] { color: var(--agent-coral-deep, #E2452A); background: rgba(var(--agent-coral-rgb, 255,107,74),0.12); }
    .infotip-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(var(--agent-coral-rgb, 255,107,74),0.4); }
  `;
  document.head.appendChild(el);
}

export function InfoTip({ label, children }: { label?: string; children: ReactNode }) {
  useEffect(() => { injectStyles(); }, []);
  return (
    <Tooltip content={typeof children === "string" ? <p style={{ margin: 0 }}>{children}</p> : children}>
      <button
        type="button"
        className="infotip-btn"
        aria-label={label ? `About ${label}` : "More information"}
      >
        <Info size={13} weight="bold" />
      </button>
    </Tooltip>
  );
}
