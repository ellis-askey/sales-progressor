"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "@phosphor-icons/react";

// Polls the agent-scoped notification endpoint.
// Shows a red badge count like Apple Notification Center.
export function AgentBell({ userKey }: { userKey: string }) {
  const storageKey = `agent-bell-cleared-${userKey}`;
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const stored = localStorage.getItem(storageKey);
    const cleared = stored ?? (() => {
      const now = new Date().toISOString();
      localStorage.setItem(storageKey, now);
      return now;
    })();
    try {
      const res = await fetch(`/api/agent/notifications?after=${encodeURIComponent(cleared)}`);
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  function handleClick() {
    localStorage.setItem(storageKey, new Date().toISOString());
    setCount(0);
    window.location.href = "/agent/comms";
  }

  return (
    <button
      onClick={handleClick}
      className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/60 transition-colors flex-shrink-0"
      title={count > 0 ? `${count} portal update${count === 1 ? "" : "s"}` : "Portal activity"}
    >
      <Bell
        className="w-4 h-4"
        style={{ color: count > 0 ? "#FF6B4A" : "rgba(15,23,42,0.40)" }}
        weight={count > 0 ? "fill" : "regular"}
      />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white px-1 leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
