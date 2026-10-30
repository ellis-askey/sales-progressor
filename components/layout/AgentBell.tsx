"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Bell } from "@phosphor-icons/react";
import { Popover } from "@/components/ui/Popover";
import { UserAvatar, ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { Pill } from "@/components/ui/Pill";
import { CountBadge } from "@/components/ui/CountBadge";
import { markAgentBellReadAction } from "@/app/actions/agent-preferences";

// Notification bell (rebuilt 2026-08-09). Polls the agent-scoped updates feed
// and shows an unread badge; clicking opens a dropdown of the latest updates
// (the same "completed step" activity as the Updates page, scoped per role by
// the API) with a "View all" link to /agent/comms. Marks read on open.
//
// The dropdown renders in-shell (not portaled), so it inherits the --agent-*
// tokens and flips light/dark automatically.
//
// Read-state (the "cleared at" baseline for the unread count) is server-backed
// on User.agentPreferences.agentBellClearedAt, seeded from the layout via
// initialClearedAt. This replaced the old per-device localStorage stamp, which
// zeroed all history on a fresh device and never synced across devices.

type BellItem = {
  id: string;
  txId: string;
  address: string;
  sentence: string;
  who: "client" | "helper" | "agent" | "solicitor";
  // The confirming side, when there is one — drives the buyer/seller tint on the
  // branded fallback avatar. Null for side-agnostic notifications.
  side: "vendor" | "purchaser" | null;
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
  // The client/helper/solicitor's own photo if they've set one (audit #16 phase
  // 2), otherwise the branded, side-tinted fallback: seller blue, buyer green,
  // solicitor a grey id-card. The same art the Updates page uses.
  const role: ActorRole =
    it.who === "solicitor" ? "solicitor"
    : it.side === "vendor" ? "seller"
    : it.side === "purchaser" ? "buyer"
    : "other";
  return <ActorAvatar name={it.avatarName} role={role} image={it.avatarImage} size={30} />;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function AgentBell({ initialClearedAt }: { initialClearedAt: string | null }) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<BellItem[]>([]);
  // The unread baseline, server-sourced. A ref (not state) so the 30s poll
  // always reads the latest value without re-subscribing the interval.
  const clearedRef = useRef<string>(initialClearedAt ?? new Date().toISOString());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/notifications?after=${encodeURIComponent(clearedRef.current)}`);
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      // ignore — transient
    }
  }, []);

  // Brand-new user with no server baseline yet: persist "now" once so the
  // baseline exists server-side and every device agrees from then on. Matches
  // the previous new-user behaviour (start from now), minus the per-device drift.
  useEffect(() => {
    if (initialClearedAt == null) {
      markAgentBellReadAction()
        .then((r) => { clearedRef.current = r.clearedAt; })
        .catch(() => {});
    }
  }, [initialClearedAt]);

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

  // Opening marks everything read — advance the baseline (server-backed) and
  // clear the badge. Fired from the trigger click; guarded on count so the
  // close-click (count already 0) is a no-op. Fire-and-forget; the local ref
  // moves immediately so the next poll stays at zero.
  function markRead() {
    if (count > 0) {
      clearedRef.current = new Date().toISOString();
      setCount(0);
      markAgentBellReadAction().catch(() => {});
    }
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <Popover
        preset="popover"
        bare
        placement="bottom-end"
        width={340}
        trigger={
          <button
            onClick={markRead}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-transparent agent-chip-hover"
            title={count > 0 ? `${count} update${count === 1 ? "" : "s"}` : "Updates"}
            aria-label="Updates"
          >
            <Bell
              className="w-4 h-4"
              style={{ color: count > 0 ? "var(--agent-coral)" : "var(--agent-text-secondary)" }}
              weight={count > 0 ? "fill" : "regular"}
            />
            {count > 0 && (
              <CountBadge count={count} tone="danger" size="sm" solid className="absolute -top-0.5 -right-0.5" aria-hidden />
            )}
          </button>
        }
      >
        {(close) => (
          <div style={{ display: "flex", flexDirection: "column", maxHeight: "min(70vh, 520px)" }}>
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
                    onClick={close}
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
              onClick={close}
              className="agent-link"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: "11px 14px", fontSize: 12, fontWeight: 600,
                borderTop: "0.5px solid var(--agent-border-subtle)",
              }}
            >
              View all updates
              <LinkArrow />
            </Link>
          </div>
        )}
      </Popover>
    </div>
  );
}
