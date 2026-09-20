"use client";

// Shared tab-badge context for the file-detail surface.
//
// Extracted from PropertyFileTabs (2026-09-20) so both the (legacy) tabs
// component and the new route-based FileTabsChrome can provide it, and so a
// streamed panel can bump its own tab's badge count after the initial server
// count is seeded.

import { createContext, useContext } from "react";

export type TabBadgeUpdater = (key: string, count: number) => void;

export const TabBadgeContext = createContext<TabBadgeUpdater | null>(null);

export function useTabBadge() {
  return useContext(TabBadgeContext);
}
