"use client";

import { useState } from "react";
import { TabContext } from "./TabContext";

type Tab = { key: string; label: string; badge?: number };

type Props = {
  tabs: Tab[];
  children: React.ReactNode[];
  sidebar: React.ReactNode;
};

export function PropertyFileTabs({ tabs, children, sidebar }: Props) {
  const [active, setActive] = useState(tabs[0].key);

  return (
    <TabContext.Provider value={{ setActiveTab: setActive }}>
      {/* ── Sticky tab bar — dark glass in .glass-page, light glass otherwise ── */}
      <div className="sticky top-0 z-20 glass-tab-bar">
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
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-black/5"
                }`}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium leading-none ${
                    isActive ? "bg-white/20 text-white" : "bg-orange-100 text-orange-600"
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
        <div className="flex-1 min-w-0">
          {tabs.map((tab, i) => (
            <div key={tab.key} className={active === tab.key ? "" : "hidden"}>
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
