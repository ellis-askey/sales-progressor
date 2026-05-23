"use client";

import { useRef, useEffect } from "react";

type Interval = { start: string; end: string };

// transactionId of null disables tracking entirely — used by the file-detail
// page to suspend the session while the file is on hold (time spent looking
// at a paused file shouldn't accrue to billing / median calculations).
export function useFileTimeTracking(transactionId: string | null) {
  const sessionIdRef    = useRef<string | null>(null);
  const intervalStartRef = useRef<string | null>(null);
  const accumulatedRef  = useRef<Interval[]>([]);

  function startInterval() {
    if (intervalStartRef.current) return;
    intervalStartRef.current = new Date().toISOString();
  }

  function endInterval() {
    if (!intervalStartRef.current) return;
    accumulatedRef.current.push({ start: intervalStartRef.current, end: new Date().toISOString() });
    intervalStartRef.current = null;
  }

  function snapshot(): Interval[] {
    const copy = [...accumulatedRef.current];
    if (intervalStartRef.current) {
      copy.push({ start: intervalStartRef.current, end: new Date().toISOString() });
    }
    return copy;
  }

  function isCurrentlyEngaged() {
    return !document.hidden && document.hasFocus();
  }

  useEffect(() => {
    if (!transactionId) return; // disabled (e.g. file on hold) — no session opens
    let mounted = true;

    fetch("/api/file-time/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, userAgent: navigator.userAgent }),
    })
      .then((r) => r.json())
      .then((d: { sessionId?: string }) => {
        if (mounted && d.sessionId) sessionIdRef.current = d.sessionId;
      })
      .catch(() => {});

    if (isCurrentlyEngaged()) startInterval();

    const onVisibility = () => {
      if (document.hidden) {
        endInterval();
      } else if (document.hasFocus()) {
        startInterval();
      }
    };
    const onFocus = () => { if (!document.hidden) startInterval(); };
    const onBlur  = () => endInterval();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur",  onBlur);

    const hb = setInterval(() => {
      if (!sessionIdRef.current) return;
      fetch("/api/file-time/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current, intervals: snapshot() }),
      }).catch(() => {});
    }, 30_000);

    const onUnload = () => {
      endInterval();
      if (!sessionIdRef.current) return;
      navigator.sendBeacon(
        "/api/file-time/end",
        JSON.stringify({ sessionId: sessionIdRef.current, intervals: accumulatedRef.current, reason: "beforeunload" })
      );
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      mounted = false;
      clearInterval(hb);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur",  onBlur);
      window.removeEventListener("beforeunload", onUnload);
      endInterval();
      if (sessionIdRef.current) {
        fetch("/api/file-time/end", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current, intervals: accumulatedRef.current, reason: "unmount" }),
        }).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);
}
