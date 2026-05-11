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
};

// Module-scoped: persists across SPA navigations for the browser session
let _sessionSidebarOpen = false;

export function PropertyFileTabs({ tabs, children, sidebar, initialTab }: Props) {
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
      const t = Math.min(window.scrollY / 40, 1);
      const blur = 20 + t * 12;
      tabBarRef.current?.style.setProperty("--tab-bar-blur", `${blur}px`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <TabContext.Provider value={{ setActiveTab: setActive }}>
      <TabBadgeContext.Provider value={updateBadge}>
        <div ref={tabBarRef} className="sticky top-0 z-20 glass-nav">
          <div ref={scrollRef} className="px-4 md:px-8 agent-tab-bar overflow-x-auto scrollbar-hide">
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
        </div>

        {/* Mobile/tablet collapsible sidebar — hidden on lg+ */}
        <div className="lg:hidden border-b border-white/20">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-900/60 hover:text-slate-900/80 hover:bg-white/10 transition-colors"
          >
            <span>File details</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${sidebarOpen ? "rotate-180" : ""}`}
            />
          </button>
          {sidebarOpen && (
            <div className="px-4 pb-5">
              {sidebar}
            </div>
          )}
        </div>

        {/* Tab content + desktop sidebar */}
        <div className="px-4 lg:px-8 py-5 lg:py-7 flex flex-col lg:flex-row gap-5 lg:gap-7 lg:items-start">
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
