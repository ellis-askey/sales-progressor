"use client";

// Lightweight, /sheets-scoped verification store. Persists which components
// the reviewer has marked "verified" in localStorage keyed by the entry's
// STABLE id — so re-ordering the catalogue never resets a flag. No backend,
// no DB, and deliberately confined to this page (per the task's scope guard:
// verification exists nowhere else in the app).

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sp:dev-sheets:verified:v1";

function readStore(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    // Keep only truthy boolean flags; drop anything malformed.
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === true) clean[k] = true;
    }
    return clean;
  } catch {
    return {};
  }
}

function writeStore(next: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / privacy mode — verification simply won't persist this session */
  }
}

export type VerificationApi = {
  /** Whether hydration has completed — before this the map is empty on server. */
  ready: boolean;
  verified: Record<string, boolean>;
  isVerified: (id: string) => boolean;
  toggle: (id: string) => void;
  set: (id: string, value: boolean) => void;
  /** Clear every flag (used by the header "reset" control). */
  clearAll: () => void;
  count: (ids: string[]) => number;
};

export function useVerification(): VerificationApi {
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR/client mismatch.
  useEffect(() => {
    setVerified(readStore());
    setReady(true);
  }, []);

  // Cross-tab sync: if the reviewer has /sheets open twice, keep them aligned.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setVerified(readStore());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: Record<string, boolean>) => {
    setVerified(next);
    writeStore(next);
  }, []);

  const set = useCallback(
    (id: string, value: boolean) => {
      persist({ ...readStore(), [id]: value || undefined } as Record<string, boolean>);
    },
    [persist],
  );

  const toggle = useCallback(
    (id: string) => {
      const store = readStore();
      const next = { ...store };
      if (next[id]) delete next[id];
      else next[id] = true;
      persist(next);
    },
    [persist],
  );

  const clearAll = useCallback(() => persist({}), [persist]);

  const isVerified = useCallback((id: string) => verified[id] === true, [verified]);

  const count = useCallback(
    (ids: string[]) => ids.reduce((n, id) => (verified[id] ? n + 1 : n), 0),
    [verified],
  );

  return { ready, verified, isVerified, toggle, set, clearAll, count };
}
