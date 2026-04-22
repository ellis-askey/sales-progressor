"use client";

import { useState, useRef, useEffect } from "react";
import { TabContext } from "./TabContext";

type Tab = { key: string; label: string; badge?: number };

type Props = {
  tabs: Tab[];
  children: React.ReactNode[];
  sidebar: React.ReactNode;
};

export function PropertyFileTabs({ tabs, children, sidebar }: Props) {
  const [active, setActive] = useState(tabs[0].key);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Scroll-linked blur intensification: 20px → 32px over first 40px of scroll.
  // Uses --tab-bar-blur CSS custom property so it can override the !important
  // backdrop-filter in .glass-page .glass-nav without a specificity fight.
  useEffect(() => {
    const onScroll = () => {
      const t = Math.min(window.scrollY / 40, 1); // 0 → 1 over first 40px
      const blur = 20 + t * 12;                   // 20px → 32px
      tabBarRef.current?.style.setProperty("--tab-bar-blur", `${blur}px`);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // set initial value on mount
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <TabContext.Provider value={{ setActiveTab: setActive }}>
      {/* ── Sticky tab bar — dark glass in .glass-page, light glass otherwise ── */}
      <div ref={tabBarRef} className="sticky top-0 z-20 glass-nav">
        <div className="px-8 py-2.5 flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                data-active={String(isActive)}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-xl ${
                  isActive
                    ? "bg-white/[0.92] text-slate-900 shadow-sm"
                    : "text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20"
                }`}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium leading-none ${
                    isActive ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-600"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two-column layout: tab content + sidebar ──────────────────── */}
      <div className="px-8 py-7 flex gap-7 items-start">
        {/* Tab panels — active panel is in normal flow (sets height);
            inactive panels are absolute + opacity-0 (no layout impact).
            All panels carry transition-opacity so the crossfade plays both
            directions: outgoing fades to 0, incoming fades to 1. */}
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
    </TabContext.Provider>
  );
}
