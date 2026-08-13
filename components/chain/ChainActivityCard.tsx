"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChainActivityEvent } from "@/lib/services/chains";

function relativeTime(at: string): string {
  const diff = Math.floor((Date.now() - new Date(at).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return `${days}d ago`;
}

// Opt-in, default-OFF activity feed for the wide chain drawer's right column.
// Self-contained: fetches its own opt-in state + events, and persists the
// toggle to the per-agent preference via POST /api/chains/activity. refreshKey
// re-pulls when the parent drawer refetches (e.g. after an invite or claim).
export function ChainActivityCard({
  chainId,
  refreshKey = 0,
}: {
  chainId: string;
  refreshKey?: number;
}) {
  const [optedIn, setOptedIn] = useState(false);
  const [events, setEvents] = useState<ChainActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chains/activity?chainId=${chainId}`);
      if (res.ok) {
        const data = await res.json();
        setOptedIn(data.optedIn === true);
        setEvents(Array.isArray(data.events) ? data.events : []);
      }
    } catch {
      // Network error — keep whatever we had; the off-state copy is a safe default.
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function toggle() {
    if (toggling) return;
    const next = !optedIn;
    setToggling(true);
    setOptedIn(next); // optimistic
    try {
      const res = await fetch(`/api/chains/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, chainId }),
      });
      if (res.ok) {
        const data = await res.json();
        setOptedIn(data.optedIn === true);
        setEvents(Array.isArray(data.events) ? data.events : []);
      } else {
        setOptedIn(!next); // revert on failure
      }
    } catch {
      setOptedIn(!next);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="chain-scard">
      <div className="chain-acthead">
        <span className="t">Chain activity</span>
        <button
          type="button"
          role="switch"
          aria-checked={optedIn}
          aria-label="Show chain activity feed"
          className="chain-toggle"
          disabled={toggling}
          onClick={() => { void toggle(); }}
        />
      </div>

      {!optedIn ? (
        <p className="chain-actoff">
          Off. Turn on to see what&rsquo;s happening across every linked sale, updated as agents confirm steps.
        </p>
      ) : loading ? (
        <p className="chain-actempty">Loading the latest&hellip;</p>
      ) : events.length === 0 ? (
        <p className="chain-actempty">
          Nothing yet. As agents confirm steps across the chain, they&rsquo;ll show here.
        </p>
      ) : (
        <div className="chain-acton">
          {events.map((e) => (
            <div key={e.id} className="chain-arow">
              <span
                className={`chain-adot${e.tone === "danger" ? " danger" : e.tone === "info" ? " info" : ""}`}
                aria-hidden
              />
              <span className="chain-alink">{e.linkAddress}</span>
              <span className="chain-aev">{e.message}</span>
              <span className="chain-atime">{relativeTime(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
