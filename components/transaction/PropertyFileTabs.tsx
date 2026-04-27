"use client";

import { useState, useRef, useEffect, createContext, useContext, useCallback } from "react";
import { TabContext } from "./TabContext";

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

export function PropertyFileTabs({ tabs, children, sidebar, initialTab }: Props) {
  const [active, setActive] = useState(() => {
    if (initialTab && tabs.some((t) => t.key === initialTab)) return initialTab;
    return tabs[0].key;
  });
  const tabBarRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [badges, setBadges] = useState<Record<string, number>>(
    Object.fromEntries(tabs.map((t) => [t.key, t.badge ?? 0]))
  );

  const updateBadge = useCallback<TabBadgeUpdater>((key, count) => {
    setBadges((prev) => ({ ...prev, [key]: count }));
  }, []);

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
          <div ref={scrollRef} className="px-4 md:px-8 py-2.5 flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = active === tab.key;
              const badgeCount = badges[tab.key] ?? 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActive(tab.key)}
                  data-active={String(isActive)}
                  className={`relative flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-xl ${
                    isActive
                      ? "bg-white/[0.92] text-slate-900 shadow-sm"
                      : "text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20"
                  }`}
                >
                  {tab.label}
                  {badgeCount > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium leading-none ${
                      isActive ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-600"
                    }`}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-8 py-7 flex gap-7 items-start">
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

          <div className="w-72 flex-shrink-0 sticky top-[53px]">
            {sidebar}
          </div>
        </div>
      </TabBadgeContext.Provider>
    </TabContext.Provider>
  );
}
