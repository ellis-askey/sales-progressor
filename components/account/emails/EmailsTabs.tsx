"use client";

// Tab strip for the Account > Emails page (settings consolidation). Splits the
// email life into Style / Words / Sender so the page is clicked through rather
// than scrolled. The server page builds each tab's content (which contains the
// real client editors) and passes it in; only the active tab mounts, so the
// heavy branding Studio and copy editor don't both load at once.
//
// Style leads (founder, 2026-10-15): you set the look first, then move to Words
// and see your wording in that look. "Style" was previously labelled "Look".

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextAa, PaperPlaneTilt } from "@phosphor-icons/react";

type Tab = "style" | "words" | "sender";

// Paint-splat glyph for Style — an "art splat" rather than a brush.
function SplatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.6 2.8c1.8-.3 3.1 1 3.3 2.7.1 1.3-.5 2 .2 3 .7 1 2.1 1 3.1 1.9 1.5 1.2 1.4 3.6-.2 4.6-1 .6-2.2.3-3.1 1.1-.9.7-.8 2.1-1.8 2.9-1.6 1.3-4.2.5-4.7-1.4-.3-1 0-1.9-.9-2.7-.8-.8-2.1-.7-3-1.5-1.6-1.3-1.3-3.9.7-4.6 1-.4 2.1-.1 2.8-1 .6-.7.3-1.9 1-2.7a3.1 3.1 0 0 1 2.3-1.8Z" />
      <circle cx="19.8" cy="4.9" r="1.15" />
      <circle cx="4.4" cy="18.4" r="1.35" />
      <circle cx="18.9" cy="19" r=".95" />
    </svg>
  );
}

export function EmailsTabs({ words, style, sender }: { words: React.ReactNode; style: React.ReactNode; sender: React.ReactNode }) {
  const router = useRouter();
  // Land on Style so the look is set before the wording is reviewed.
  const [tab, setTab] = useState<Tab>("style");

  // The Words preview renders in the agency's saved email look, which is a
  // server-computed prop fixed at page load. When a director leaves the Style
  // tab (where they may have just saved a new look), refresh so the Words
  // preview re-resolves to the look they set, rather than the stale one.
  function go(next: Tab) {
    if (tab === "style" && next !== "style") router.refresh();
    setTab(next);
  }
  const TABS: { id: Tab; label: string; render: (on: boolean) => React.ReactNode }[] = [
    { id: "style", label: "Style", render: () => <SplatIcon size={16} /> },
    { id: "words", label: "Words", render: (on) => <TextAa size={16} weight={on ? "fill" : "regular"} /> },
    { id: "sender", label: "Sender", render: (on) => <PaperPlaneTilt size={16} weight={on ? "fill" : "regular"} /> },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid rgba(0,0,0,0.08)", marginBottom: 24 }}>
        {TABS.map(({ id, label, render }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                font: "inherit",
                fontSize: 14,
                fontWeight: 650,
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: "9px 14px 13px",
                color: on ? "var(--agent-coral-deep, #E2452A)" : "#6b7280",
                transition: "color 160ms",
              }}
            >
              {render(on)}
              {label}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: -0.5,
                  height: 2,
                  borderRadius: 2,
                  background: "var(--agent-coral-deep, #E2452A)",
                  transform: on ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "center",
                  transition: "transform 200ms cubic-bezier(.4,0,.2,1)",
                }}
              />
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {tab === "style" && style}
        {tab === "words" && words}
        {tab === "sender" && sender}
      </div>
    </div>
  );
}
