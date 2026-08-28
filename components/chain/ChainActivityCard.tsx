"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock } from "@phosphor-icons/react";
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
          aria-label="Share and follow chain activity"
          disabled={toggling}
          onClick={() => { void toggle(); }}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            width: 58,
            height: 26,
            borderRadius: 99,
            padding: 0,
            cursor: toggling ? "wait" : "pointer",
            background: optedIn ? "var(--agent-coral)" : "var(--agent-border-subtle)",
            border: `1px solid ${optedIn ? "transparent" : "var(--agent-border-default)"}`,
            transition: "background .18s var(--agent-ease)",
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: optedIn ? 9 : undefined,
              right: optedIn ? undefined : 9,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".06em",
              color: optedIn ? "#fff" : "var(--agent-text-muted)",
            }}
          >
            {optedIn ? "ON" : "OFF"}
          </span>
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 2,
              left: optedIn ? undefined : 2,
              right: optedIn ? 2 : undefined,
              width: 20,
              height: 20,
              borderRadius: 99,
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,.25)",
              transition: "all .18s var(--agent-ease)",
            }}
          />
        </button>
      </div>

      {!optedIn ? (
        <>
          <p style={{ margin: "12px 0 0", fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            Follow the whole chain as it moves.
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
            See confirmed steps and key updates from the other agents involved.
          </p>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background: "var(--agent-hover-tint)",
              border: "1px solid var(--agent-border-subtle)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <Lock size={15} weight="fill" style={{ color: "var(--agent-text-muted)", marginTop: 1, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                Only progress is shared
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>
                See what&rsquo;s moved and when, without sharing any client or case details.
              </p>
            </div>
          </div>
        </>
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
