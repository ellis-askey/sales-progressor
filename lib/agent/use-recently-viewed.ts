"use client";

import { useState, useEffect } from "react";

export type RecentlyViewedEntry = { id: string; address: string; visitedAt: number };

// Key scoped per userId — prevents cross-user data leakage on shared browsers.
function scopedKey(userId: string) {
  return `agent_recently_viewed_${userId}`;
}

// Legacy unscoped key — cleared on first read to remove pre-upgrade shared data.
const LEGACY_KEY = "agent_recently_viewed";
const MAX_STORED = 8;
const TRACK_EVENT = "agent_recently_viewed_update";

function clearLegacyKey() {
  try {
    if (localStorage.getItem(LEGACY_KEY) !== null) {
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    // ignore
  }
}

function read(userId: string): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  clearLegacyKey();
  try {
    return JSON.parse(localStorage.getItem(scopedKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}

export function trackView(id: string, address: string, userId: string) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const existing = read(userId).filter((e) => e.id !== id);
  const updated = [{ id, address, visitedAt: now }, ...existing].slice(0, MAX_STORED);
  try {
    localStorage.setItem(scopedKey(userId), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(TRACK_EVENT));
  } catch {
    // localStorage unavailable or full — silent fail
  }
}

export function useRecentlyViewed(limit = 5, userId = ""): RecentlyViewedEntry[] {
  const [items, setItems] = useState<RecentlyViewedEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    setItems(read(userId).slice(0, limit));
    const handler = () => setItems(read(userId).slice(0, limit));
    window.addEventListener(TRACK_EVENT, handler);
    return () => window.removeEventListener(TRACK_EVENT, handler);
  }, [limit, userId]);

  return items;
}
