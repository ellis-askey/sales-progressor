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
      {/* ── Sticky tab bar ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#e4e9f0]"
           style={{ boxShadow: "0 1px 0 0 #e4e9f0" }}>
        <div className="px-8 flex items-center gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                active === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="text-xs bg-orange-100 text-orange-600 rounded-full px-1.5 py-0.5 font-medium leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Two-column layout: tabs content + sidebar ─────────────────── */}
      <div className="px-8 py-7 flex gap-7 items-start">
        <div className="flex-1 min-w-0">
          {tabs.map((tab, i) => (
            <div key={tab.key} className={active === tab.key ? "" : "hidden"}>
              {children[i]}
            </div>
          ))}
        </div>

        <div className="w-72 flex-shrink-0 sticky top-[49px]">
          {sidebar}
        </div>
      </div>
    </TabContext.Provider>
  );
}
