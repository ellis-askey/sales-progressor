"use client";

import { useState, useRef, useEffect, createContext, useContext, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { TabContext } from "./TabContext";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";

type TabBadgeUpdater = (key: string, count: number) => void;
const TabBadgeContext = createContext<TabBadgeUpdater | null>(null);
export function useTabBadge() { return useContext(TabBadgeContext); }

type Tab = { key: string; label: string; badge?: number };

type Props = {
  tabs: Tab[];
  children: React.ReactNode[];
  sidebar: React.ReactNode;
  initialTab?: string;
  heroConnected?: boolean;
  // Optional right-aligned slot next to the tab bar. Used for internal-staff
  // controls (e.g. PortalConfirmEmailToggle). Hidden when null.
  rightSlot?: React.ReactNode;
  // 2026-07-06 pass 3 - Zone 4 slot. Rendered between the tab bar and
  // the content grid, spanning full width. Used by the file-detail page
  // for the always-visible milestone journey strip.
  beforeContent?: React.ReactNode;
};

// Module-scoped: persists across SPA navigations for the browser session
let _sessionSidebarOpen = false;

export function PropertyFileTabs({ tabs, children, sidebar, initialTab, heroConnected, rightSlot, beforeContent }: Props) {
  const [active, setActive] = useState(() => {
    if (initialTab && tabs.some((t) => t.key === initialTab)) return initialTab;
    return tabs[0].key;
  });
  const [sidebarOpen, setSidebarOpen] = useState(_sessionSidebarOpen);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [badges, setBadges] = useState<Record<string, number>>(
    Object.fromEntries(tabs.map((t) => [t.key, t.badge ?? 0]))
  );

  const activeIdx = tabs.findIndex((t) => t.key === active);
  const { btnRefs, ind } = useTabIndicator(activeIdx);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const updateBadge = useCallback<TabBadgeUpdater>((key, count) => {
    setBadges((prev) => ({ ...prev, [key]: count }));
  }, []);

  function toggleSidebar() {
    const next = !sidebarOpen;
    _sessionSidebarOpen = next;
    setSidebarOpen(next);
  }

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const t = Math.min(scrollY / 40, 1);
      const blur = 20 + t * 12;
      const el = tabBarRef.current;
      if (!el) return;
      el.style.setProperty("--tab-bar-blur", `${blur}px`);

      if (heroConnected) {
        // 2026-07-06 restyle pass 2 — no card chrome on the tab bar. Tabs
        // sit as text-only strip on the peachy backdrop when not stuck.
        // When stuck (scrolled), enable the glass-nav backdrop-blur so the
        // tab labels stay readable over content.
        const stuck = el.getBoundingClientRect().top <= 0;
        if (!stuck) {
          el.classList.remove("glass-nav");
          el.style.background = "transparent";
          el.style.backdropFilter = "";
          el.style.setProperty("-webkit-backdrop-filter", "");
          el.style.border = "none";
          el.style.borderRadius = "0";
          el.style.overflow = "visible";
          el.style.boxShadow = "none";
        } else {
          el.classList.add("glass-nav");
          el.style.background = "";
          el.style.backdropFilter = "";
          el.style.setProperty("-webkit-backdrop-filter", "");
          el.style.border = "";
          el.style.borderRadius = "";
          el.style.overflow = "";
          el.style.boxShadow = "";
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroConnected]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <TabContext.Provider value={{ setActiveTab: setActive }}>
      <TabBadgeContext.Provider value={updateBadge}>
        <div ref={tabBarRef} className={`sticky top-0 z-20${heroConnected ? "" : " glass-nav"}`}>
          <div
            className={heroConnected ? "" : "px-4 md:px-8"}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <div
              ref={scrollRef}
              className="agent-tab-bar overflow-x-auto scrollbar-hide"
              style={{ flex: 1, minWidth: 0 }}
            >
              {/* Sliding underline indicator */}
              {ind && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: ind.left,
                    width: ind.width,
                    height: 2,
                    background: "var(--agent-coral)",
                    borderRadius: "1px 1px 0 0",
                    transition: prefersReducedMotion ? "none" : "left 200ms ease, width 200ms ease",
                    pointerEvents: "none",
                  }}
                />
              )}
              {tabs.map((tab, i) => {
                const isActive = active === tab.key;
                const badgeCount = badges[tab.key] ?? 0;
                return (
                  <button
                    key={tab.key}
                    ref={(el) => { btnRefs.current[i] = el; }}
                    onClick={() => setActive(tab.key)}
                    aria-selected={isActive}
                    className="agent-tab flex-shrink-0"
                  >
                    {tab.label}
                    {badgeCount > 0 && (
                      <span
                        className="text-xs rounded-full px-1.5 py-0.5 font-medium leading-none"
                        style={isActive
                          ? { background: "var(--agent-coral)", color: "var(--agent-text-on-coral)" }
                          : { background: "rgba(var(--agent-coral-base-rgb),0.12)", color: "var(--agent-coral-deep)" }
                        }
                      >
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {rightSlot && (
              <div style={{ flexShrink: 0, paddingRight: heroConnected ? 12 : 0 }}>
                {rightSlot}
              </div>
            )}
          </div>
        </div>

        {/* Zone 4 - always-visible full-width slot between the tab bar
            and the content grid. Used for the milestone journey strip. */}
        {beforeContent && (
          <div style={{ marginTop: 24, marginBottom: 40 }}>
            {beforeContent}
          </div>
        )}

        {/* Mobile/tablet collapsible sidebar — hidden on lg+ */}
        <div className="lg:hidden border-b border-white/20">
          <button
            onClick={toggleSidebar}
            className={`hidden md:flex w-full items-center justify-between ${heroConnected ? "" : "px-4 "}py-3 text-sm font-medium text-slate-900/60 hover:text-slate-900/80 hover:bg-white/10 transition-colors`}
          >
            <span>File details</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${sidebarOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div className={[
            !heroConnected ? "px-4" : "",
            "pt-3 pb-3 md:pb-5",
            sidebarOpen ? "" : "md:hidden",
          ].filter(Boolean).join(" ")}>
            {sidebar}
          </div>
        </div>

        {/* Tab content + desktop sidebar */}
        <div className={`${heroConnected ? "" : "px-4 lg:px-8 "}py-5 lg:py-7 flex flex-col lg:flex-row gap-5 lg:gap-7 lg:items-start`}>
          <div className="flex-1 min-w-0 relative">
            {tabs.map((tab, i) => (
              <div
                key={tab.key}
                aria-hidden={active !== tab.key}
                className={`transition-opacity duration-[150ms] ease-out ${
                  active === tab.key
                    ? "opacity-100 relative"
                    : "opacity-0 absolute inset-0 pointer-events-none select-none overflow-hidden"
                }`}
              >
                {children[i]}
              </div>
            ))}
          </div>

          {/* Desktop sidebar — hidden on mobile/tablet */}
          <div className="hidden lg:block w-72 flex-shrink-0 sticky top-[53px]">
            {sidebar}
          </div>
        </div>
      </TabBadgeContext.Provider>
    </TabContext.Provider>
  );
}
