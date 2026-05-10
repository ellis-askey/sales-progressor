"use client";

import { useState, useEffect } from "react";

export type RecentlyViewedEntry = { id: string; address: string; visitedAt: number };

const KEY = "agent_recently_viewed";
const MAX_STORED = 8;
const TRACK_EVENT = "agent_recently_viewed_update";

function read(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function trackView(id: string, address: string) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const existing = read().filter((e) => e.id !== id);
  const updated = [{ id, address, visitedAt: now }, ...existing].slice(0, MAX_STORED);
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(TRACK_EVENT));
  } catch {
    // localStorage unavailable or full — silent fail
  }
}

export function useRecentlyViewed(limit = 5): RecentlyViewedEntry[] {
  const [items, setItems] = useState<RecentlyViewedEntry[]>([]);

  useEffect(() => {
    setItems(read().slice(0, limit));
    const handler = () => setItems(read().slice(0, limit));
    window.addEventListener(TRACK_EVENT, handler);
    return () => window.removeEventListener(TRACK_EVENT, handler);
  }, [limit]);

  return items;
}
