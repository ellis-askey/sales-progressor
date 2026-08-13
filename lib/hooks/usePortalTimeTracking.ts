"use client";

import { useRef, useEffect } from "react";

type Interval = { start: string; end: string };

// Portal twin of useFileTimeTracking. Measures real ENGAGED time (tab visible +
// window focused) a client spends on their portal, heartbeating every 30s and
// flushing on unload via sendBeacon. Authenticates by the portal token in the
// URL rather than a NextAuth session. Pass the token from PortalShell.
export function usePortalTimeTracking(token: string | null) {
  const sessionIdRef = useRef<string | null>(null);
  const intervalStartRef = useRef<string | null>(null);
  const accumulatedRef = useRef<Interval[]>([]);

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
    if (!token) return;
    let mounted = true;
    const base = `/api/portal/${token}/time`;

    fetch(`${base}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAgent: navigator.userAgent }),
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
    const onBlur = () => endInterval();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    const hb = setInterval(() => {
      if (!sessionIdRef.current) return;
      fetch(`${base}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current, intervals: snapshot() }),
      }).catch(() => {});
    }, 30_000);

    const onUnload = () => {
      endInterval();
      if (!sessionIdRef.current) return;
      navigator.sendBeacon(
        `${base}/end`,
        JSON.stringify({ sessionId: sessionIdRef.current, intervals: accumulatedRef.current, reason: "beforeunload" }),
      );
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      mounted = false;
      clearInterval(hb);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onUnload);
      endInterval();
      if (sessionIdRef.current) {
        fetch(`${base}/end`, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current, intervals: accumulatedRef.current, reason: "unmount" }),
        }).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
