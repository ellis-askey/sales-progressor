"use client";

// Tab strip for the Account > Emails page (settings consolidation). Splits the
// email life into Words / Look / Sender so the page is clicked through rather
// than scrolled. The server page builds each tab's content (which contains the
// real client editors) and passes it in; only the active tab mounts, so the
// heavy branding Studio and copy editor don't both load at once.

import { useState } from "react";
import { TextAa, PaintBrushBroad, PaperPlaneTilt } from "@phosphor-icons/react";

type Tab = "words" | "look" | "sender";

export function EmailsTabs({ words, look, sender }: { words: React.ReactNode; look: React.ReactNode; sender: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("words");
  const TABS: { id: Tab; label: string; Icon: typeof TextAa }[] = [
    { id: "words", label: "Words", Icon: TextAa },
    { id: "look", label: "Look", Icon: PaintBrushBroad },
    { id: "sender", label: "Sender", Icon: PaperPlaneTilt },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid rgba(0,0,0,0.08)", marginBottom: 24 }}>
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
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
              <Icon size={16} weight={on ? "fill" : "regular"} />
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
        {tab === "words" && words}
        {tab === "look" && look}
        {tab === "sender" && sender}
      </div>
    </div>
  );
}
