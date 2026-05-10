import { useState, useRef, useCallback } from "react";

export type PropertyIntel = {
  address: { street: string | null; city: string | null; postcode: string };
  lastSold: { price: number; date: string } | null;
  saleHistory: Array<{ year: number; price: number }> | null;
  recentLocalSales: Array<{ address: string; price: number; date: string }> | null;
  epc: { rating: string; score: number | null; validUntil: string | null } | null;
  tenure: { value: "freehold" | "leasehold"; since: number | null } | null;
  councilTaxBand: null;
  marketPulse: null;
};

export type IntelState = "idle" | "loading" | "success" | "error";

export type LookupAddress = {
  postcode: string;
  street?: string | null;
  city?: string | null;
};

const DEBOUNCE_MS = 800;

export function usePropertyIntel() {
  const [data, setData] = useState<PropertyIntel | null>(null);
  const [state, setState] = useState<IntelState>("idle");

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAddressRef = useRef<LookupAddress | null>(null);

  const _fire = useCallback((address: LookupAddress) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastAddressRef.current = address;
    setState("loading");
    setData(null);

    fetch("/api/property-intel-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: PropertyIntel) => {
        setState("success");
        setData(d);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setState("error");
      });
  // setState and setData are stable; refs are mutable — no deps needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced — for search field keystrokes
  const lookup = useCallback((address: LookupAddress) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => _fire(address), DEBOUNCE_MS);
  }, [_fire]);

  // Immediate — for extraction complete, button clicks
  const lookupImmediate = useCallback((address: LookupAddress) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    _fire(address);
  }, [_fire]);

  const retry = useCallback(() => {
    if (lastAddressRef.current) _fire(lastAddressRef.current);
  }, [_fire]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setData(null);
    setState("idle");
    lastAddressRef.current = null;
  }, []);

  return { lookup, lookupImmediate, data, state, retry, clear };
}
