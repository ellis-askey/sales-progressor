"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { useAgentTheme } from "@/lib/agent/use-theme";
import { AGENT_THEMES, type AgentTheme } from "@/lib/agent/themes";

interface ThemePickerProps {
  currentTheme: AgentTheme;
}

const THEME_META: Record<AgentTheme, { name: string; tagline: string }> = {
  sunset:   { name: "Sunset",   tagline: "Warm and modern"     },
  coastal:  { name: "Coastal",  tagline: "Calm and fresh"      },
  heritage: { name: "Heritage", tagline: "Trustworthy classic" },
  slate:    { name: "Slate",    tagline: "Modern minimal"      },
  emerald:  { name: "Emerald",  tagline: "Premium established" },
  claret:   { name: "Claret",   tagline: "Distinctive bold"    },
};

export function ThemePicker({ currentTheme }: ThemePickerProps) {
  const { setTheme } = useAgentTheme();
  // Local state so the active tile reflects clicks immediately without waiting
  // for a server round-trip or page reload
  const [activeTheme, setActiveTheme] = useState<AgentTheme>(currentTheme);

  function handleSelect(theme: AgentTheme) {
    setActiveTheme(theme);
    setTheme(theme);
  }

  return (
    <div className="glass-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-slate-900/80 mb-1">Branch theme</h2>
        <p className="text-xs text-slate-900/50">
          Choose the look that matches your branch. Changes apply instantly.
        </p>
      </div>

      <div className="agent-theme-grid">
        {AGENT_THEMES.map((theme) => {
          const isActive = theme === activeTheme;
          const meta = THEME_META[theme];

          return (
            <button
              key={theme}
              type="button"
              onClick={() => handleSelect(theme)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.boxShadow = "0 0 0 2px var(--agent-border-strong)";
                }
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = isActive
                  ? "0 0 0 2px var(--agent-coral-deep)"
                  : "0 0 0 1px var(--agent-border-default)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              aria-label={`Switch to ${meta.name} theme${isActive ? " (currently active)" : ""}`}
              aria-pressed={isActive}
              style={{
                position: "relative",
                padding: 0,
                cursor: "pointer",
                background: "transparent",
                border: "none",
                boxShadow: isActive
                  ? "0 0 0 2px var(--agent-coral-deep)"
                  : "0 0 0 1px var(--agent-border-default)",
                borderRadius: "var(--agent-radius-lg)",
                overflow: "hidden",
                textAlign: "left",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              {/* Inner wrapper: establishes this tile's own CSS var scope */}
              <div data-theme={theme} style={{ borderRadius: "var(--agent-radius-lg)", overflow: "hidden" }}>

                {/* ── Preview area ─────────────────────────────────────────── */}
                <div style={{
                  position: "relative",
                  height: 130,
                  background: "linear-gradient(135deg, var(--agent-bg-base) 0%, var(--agent-bg-warm) 100%)",
                  overflow: "hidden",
                }}>

                  {/* Sidebar with active nav pill + inactive lines */}
                  <div style={{
                    position: "absolute",
                    left: 8, top: 8, bottom: 8,
                    width: 36,
                    borderRadius: 6,
                    background: "linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%)",
                  }}>
                    {/* Active nav pill */}
                    <div style={{
                      position: "absolute",
                      left: 4, right: 4, top: 8,
                      height: 6,
                      borderRadius: 3,
                      background: "var(--agent-text-on-coral)",
                      opacity: 0.9,
                    }} />
                    {/* Inactive nav lines */}
                    <div style={{
                      position: "absolute",
                      left: 4, right: 4, top: 20,
                      height: 3,
                      borderRadius: 2,
                      background: "var(--agent-text-on-coral)",
                      opacity: 0.3,
                    }} />
                    <div style={{
                      position: "absolute",
                      left: 4, right: 4, top: 28,
                      height: 3,
                      borderRadius: 2,
                      background: "var(--agent-text-on-coral)",
                      opacity: 0.3,
                    }} />
                  </div>

                  {/* Primary action button shape */}
                  <div style={{
                    position: "absolute",
                    right: 12, top: 12,
                    width: 52, height: 14,
                    borderRadius: 5,
                    background: "linear-gradient(135deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%)",
                  }} />

                  {/* Main content panel */}
                  <div style={{
                    position: "absolute",
                    left: 52, right: 12,
                    top: 34, bottom: 10,
                    borderRadius: 6,
                    background: "var(--agent-surface-elevated)",
                    border: "0.5px solid rgba(0,0,0,0.06)",
                    padding: 6,
                    overflow: "hidden",
                  }}>
                    {/* Heading line */}
                    <div style={{
                      height: 4, width: "45%",
                      borderRadius: 2,
                      background: "var(--agent-text-secondary)",
                      opacity: 0.45,
                      marginBottom: 5,
                    }} />

                    {/* Attention row with semantic red left-border */}
                    <div style={{
                      height: 10,
                      borderRadius: 3,
                      background: "rgba(199,62,62,0.08)",
                      borderLeft: "2px solid #C73E3E",
                      marginBottom: 6,
                    }} />

                    {/* Three mini stat cards */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {/* Stat 1 — success */}
                      <div style={{
                        flex: 1, height: 26,
                        borderRadius: 4,
                        background: "var(--agent-bg-base)",
                        position: "relative",
                      }}>
                        <div style={{
                          position: "absolute",
                          top: 4, left: 4,
                          width: 10, height: 5,
                          borderRadius: 1,
                          background: "var(--agent-success)",
                        }} />
                        <div style={{
                          position: "absolute",
                          bottom: 4, left: 4, right: 4,
                          height: 2,
                          borderRadius: 1,
                          background: "var(--agent-text-tertiary)",
                          opacity: 0.35,
                        }} />
                      </div>
                      {/* Stat 2 — brand coral */}
                      <div style={{
                        flex: 1, height: 26,
                        borderRadius: 4,
                        background: "var(--agent-bg-base)",
                        position: "relative",
                      }}>
                        <div style={{
                          position: "absolute",
                          top: 4, left: 4,
                          width: 8, height: 5,
                          borderRadius: 1,
                          background: "var(--agent-coral-deep)",
                        }} />
                        <div style={{
                          position: "absolute",
                          bottom: 4, left: 4, right: 4,
                          height: 2,
                          borderRadius: 1,
                          background: "var(--agent-text-tertiary)",
                          opacity: 0.35,
                        }} />
                      </div>
                      {/* Stat 3 — danger */}
                      <div style={{
                        flex: 1, height: 26,
                        borderRadius: 4,
                        background: "var(--agent-bg-base)",
                        position: "relative",
                      }}>
                        <div style={{
                          position: "absolute",
                          top: 4, left: 4,
                          width: 10, height: 5,
                          borderRadius: 1,
                          background: "var(--agent-danger)",
                        }} />
                        <div style={{
                          position: "absolute",
                          bottom: 4, left: 4, right: 4,
                          height: 2,
                          borderRadius: 1,
                          background: "var(--agent-text-tertiary)",
                          opacity: 0.35,
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Active check badge */}
                  {isActive && (
                    <div style={{
                      position: "absolute",
                      top: 10, right: 10,
                      width: 24, height: 24,
                      borderRadius: "50%",
                      background: "var(--agent-coral-deep)",
                      color: "var(--agent-text-on-coral)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.20)",
                      zIndex: 2,
                    }}>
                      <Check size={13} weight="bold" />
                    </div>
                  )}
                </div>

                {/* ── Label area ───────────────────────────────────────────── */}
                <div style={{
                  padding: "9px 11px",
                  background: "var(--agent-surface-elevated)",
                  borderTop: "0.5px solid var(--agent-border-subtle)",
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 6,
                  }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--agent-text-primary)",
                    }}>
                      {meta.name}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: "var(--agent-radius-pill)",
                        background: "var(--agent-coral-pale)",
                        color: "var(--agent-coral-darker)",
                        letterSpacing: "0.03em",
                        textTransform: "uppercase" as const,
                      }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11,
                    marginTop: 2,
                    color: "var(--agent-text-secondary)",
                  }}>
                    {meta.tagline}
                  </div>
                </div>

              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
