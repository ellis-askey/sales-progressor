"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "@phosphor-icons/react";

// Sales Progressor bell. Polls /api/sp/notifications for the unread count
// (DB-backed, no localStorage). Clicking the bell POSTs to the same endpoint
// to mark every unread row as read, then navigates to /agent/comms.
//
// Read state lives on Notification.readAt — so it syncs across devices,
// unlike the older content-pattern bells. userKey is kept only to keep the
// component prop signature stable with the existing AppShell call site.
export function SPBell({ userKey: _userKey }: { userKey: string }) {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/sp/notifications");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  useEffect(() => {
    if ("setAppBadge" in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  }, [count]);

  function handleClick() {
    // Optimistic: clear the badge immediately so the click feels snappy.
    setCount(0);
    // Fire-and-forget: mark unread rows as read on the server. Navigation
    // happens regardless of the response.
    fetch("/api/sp/notifications", { method: "POST" }).catch(() => {});
    window.location.href = "/agent/comms";
  }

  return (
    <button
      onClick={handleClick}
      className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/60 transition-colors flex-shrink-0"
      title={count > 0 ? `${count} update${count === 1 ? "" : "s"}` : "Activity"}
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
