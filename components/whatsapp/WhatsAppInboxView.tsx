"use client";

// Central WhatsApp inbox (Phase 4): every mapped conversation across the
// caller's permitted sales. List + conversation two-pane on desktop, stacked
// with a back button on mobile. Same CloudConversation component as the file
// tab — one history, two doors. Unlinked from the nav until go-live.

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudConversation } from "@/components/whatsapp/CloudConversation";
import { listThreadMessagesAction } from "@/app/actions/whatsapp-cloud";
import type { ThreadSummary, ThreadMessage } from "@/lib/services/whatsapp-cloud-inbox";

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (60 * 24))}d`;
}

type Filter = "all" | "unread" | "awaiting";

export function WhatsAppInboxView({ threads }: { threads: ThreadSummary[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<{ thread: ThreadSummary; messages: ThreadMessage[] } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const visible = threads.filter((t) => {
    if (filter === "unread") return t.unreadCount > 0;
    if (filter === "awaiting")
      return !!t.lastInboundAt && (!t.lastOutboundAt || new Date(t.lastInboundAt) > new Date(t.lastOutboundAt));
    return true;
  });

  async function open(t: ThreadSummary) {
    setLoadingId(t.id);
    try {
      const res = await listThreadMessagesAction(t.id);
      if (res) setActive({ thread: res.thread, messages: res.messages });
    } finally {
      setLoadingId(null);
    }
  }

  const list = (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ display: "flex", gap: 6, padding: "0 2px 10px" }}>
        {(["all", "unread", "awaiting"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              border: filter === f ? "1.5px solid rgba(var(--agent-coral-rgb,255,107,74),0.55)" : "1px solid var(--agent-border-default)",
              background: "var(--agent-surface-elevated, #fff)",
              borderRadius: 999,
              padding: "5px 12px",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 650,
              color: filter === f ? "var(--agent-coral-darker, #E55B3D)" : "var(--agent-text-secondary)",
              cursor: "pointer",
            }}
          >
            {f === "all" ? "All" : f === "unread" ? "Unread" : "Awaiting reply"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
        {visible.length === 0 && (
          <p style={{ margin: "18px 4px", fontSize: 13, color: "var(--agent-text-muted)" }}>
            {threads.length === 0
              ? "No WhatsApp conversations yet. Link your WhatsApp in Account → Connections and your property chats appear here automatically."
              : "Nothing in this filter right now."}
          </p>
        )}
        {visible.map((t) => {
          const on = active?.thread.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => open(t)}
              style={{
                textAlign: "left",
                border: on ? "1.5px solid rgba(var(--agent-coral-rgb,255,107,74),0.5)" : "1px solid var(--agent-border-subtle)",
                background: "var(--agent-surface-elevated, #fff)",
                borderRadius: 13,
                padding: "10px 12px",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {loadingId === t.id ? "Opening…" : (t.displayName ?? `+${t.waId}`)}
                </span>
                <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {ago(t.lastInboundAt ?? t.lastOutboundAt)}
                  {t.unreadCount > 0 && (
                    <span style={{ minWidth: 17, height: 17, borderRadius: 999, background: "var(--agent-coral-deep, #FF6B4A)", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" }}>
                      {t.unreadCount}
                    </span>
                  )}
                </span>
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                {t.lastPreview ?? ""}
              </span>
              <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-secondary)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.transactionAddress}
                {t.side ? ` · ${t.side.toLowerCase()}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const conversation = active ? (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, border: "1px solid var(--agent-border-subtle)", borderRadius: 14, background: "var(--agent-glass-bg, rgba(255,255,255,0.55))", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--agent-border-subtle)" }}>
        {isNarrow && (
          <button onClick={() => setActive(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "var(--agent-text-muted)", padding: 2 }} aria-label="Back to the list">
            ‹
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 750, color: "var(--agent-text-primary)" }}>{active.thread.displayName ?? `+${active.thread.waId}`}</p>
          <Link href={`/agent/transactions/${active.thread.transactionId}/whatsapp`} style={{ fontSize: 11.5, color: "var(--agent-coral-deep, #E2452A)", textDecoration: "none" }}>
            {active.thread.transactionAddress}{active.thread.side ? ` · ${active.thread.side.toLowerCase()}` : ""} →
          </Link>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CloudConversation key={active.thread.id} thread={active.thread} messages={active.messages} />
      </div>
    </div>
  ) : (
    <div style={{ display: "grid", placeItems: "center", border: "1px dashed var(--agent-border-default)", borderRadius: 14, color: "var(--agent-text-muted)", fontSize: 13 }}>
      Pick a conversation
    </div>
  );

  if (isNarrow) {
    return <div style={{ height: "calc(100vh - 220px)", minHeight: 420 }}>{active ? conversation : list}</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0,1fr)", gap: 16, height: "calc(100vh - 220px)", minHeight: 460 }}>
      {list}
      {conversation}
    </div>
  );
}
