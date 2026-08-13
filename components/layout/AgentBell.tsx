"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Bell, ArrowRight, Scales } from "@phosphor-icons/react";
import { UserAvatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";

// Notification bell (rebuilt 2026-08-09). Polls the agent-scoped updates feed
// and shows an unread badge; clicking opens a dropdown of the latest updates
// (the same "completed step" activity as the Updates page, scoped per role by
// the API) with a "View all" link to /agent/comms. Marks read on open.
//
// The dropdown renders in-shell (not portaled), so it inherits the --agent-*
// tokens and flips light/dark automatically.

type BellItem = {
  id: string;
  txId: string;
  address: string;
  sentence: string;
  who: "client" | "agent" | "solicitor";
  avatarImage: string | null;
  avatarName: string;
  at: string;
  // Pill text for informational client items (date set / note / chain agent /
  // chase paused). Null on confirmations, which show no pill. "Paused" for a
  // chase pause, "Update" otherwise.
  updateLabel?: string | null;
};

function BellAvatar({ it }: { it: BellItem }) {
  if (it.who === "agent") {
    return <UserAvatar user={{ name: it.avatarName, image: it.avatarImage }} size={30} />;
  }
  if (it.who === "client") {
    // The client's own uploaded photo if they've set one (audit #16 phase 2),
    // otherwise a friendly generic person.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={it.avatarImage || "/client-avatar-fallback.png"} alt="" aria-hidden width={30} height={30} style={{ borderRadius: 999, flexShrink: 0, display: "block", objectFit: "cover" }} />;
  }
  return (
    <span aria-hidden style={{ width: 30, height: 30, borderRadius: 999, background: "rgba(var(--agent-info-rgb), 0.12)", color: "var(--agent-info)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Scales size={15} weight="regular" />
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function AgentBell({ userKey }: { userKey: string }) {
  const storageKey = `agent-bell-cleared-${userKey}`;
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<BellItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const getCleared = useCallback(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const now = new Date().toISOString();
    localStorage.setItem(storageKey, now);
    return now;
  }, [storageKey]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/notifications?after=${encodeURIComponent(getCleared())}`);
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      // ignore — transient
    }
  }, [getCleared]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if ("setAppBadge" in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  }, [count]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening marks everything read — stamp now and clear the badge.
    if (next && count > 0) {
      localStorage.setItem(storageKey, new Date().toISOString());
      setCount(0);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={toggle}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg agent-hover-row transition-colors"
        title={count > 0 ? `${count} update${count === 1 ? "" : "s"}` : "Updates"}
        aria-label="Updates"
        aria-expanded={open}
      >
        <Bell
          className="w-4 h-4"
          style={{ color: count > 0 ? "var(--agent-coral)" : "var(--agent-text-secondary)" }}
          weight={count > 0 ? "fill" : "regular"}
        />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white px-1 leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxWidth: "calc(100vw - 24px)",
            background: "var(--agent-surface-elevated)",
            border: "0.5px solid var(--agent-border-default)",
            borderRadius: 12,
            boxShadow: "var(--agent-glass-shadow-lifted, 0 12px 40px rgba(0,0,0,0.18))",
            zIndex: 200,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "min(70vh, 520px)",
            animation: "agent-dropdown-in 160ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderBottom: "0.5px solid var(--agent-border-subtle)",
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Updates</p>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Latest steps across your files</span>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {items.length === 0 ? (
              <p style={{ margin: 0, padding: "28px 16px", textAlign: "center", fontSize: 12, color: "var(--agent-text-muted)" }}>
                No recent updates.
              </p>
            ) : (
              items.map((it) => (
                <Link
                  key={it.id}
                  href={`/agent/transactions/${it.txId}`}
                  onClick={() => setOpen(false)}
                  className="agent-hover-row"
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 14px", textDecoration: "none",
                    borderBottom: "0.5px solid var(--agent-border-subtle)",
                  }}
                >
                  <span style={{ marginTop: 1 }}><BellAvatar it={it} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 10.5, color: "var(--agent-text-muted)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {it.address}
                    </p>
                    <p style={{ margin: "1px 0 0", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>
                      {it.sentence}
                    </p>
                    <div style={{ margin: "3px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
                        {relativeTime(it.at)}
                      </span>
                      {it.updateLabel && <Pill glass tone="default" size="sm">{it.updateLabel}</Pill>}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/agent/comms"
            onClick={() => setOpen(false)}
            className="agent-link"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "11px 14px", fontSize: 12, fontWeight: 600,
              borderTop: "0.5px solid var(--agent-border-subtle)",
            }}
          >
            View all updates
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
      )}
    </div>
  );
}
