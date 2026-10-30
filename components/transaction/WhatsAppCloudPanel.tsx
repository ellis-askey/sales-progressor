"use client";

// File WhatsApp tab → the official-number conversations for this sale
// (Phase 4). Buyer-side / seller-side threads as chips, the shared
// conversation view beneath. Sits above the legacy captured history while the
// parallel run lasts (REBUILD_PLAN §E: one continuous story per file).

import { useState } from "react";
import { CloudConversation } from "@/components/whatsapp/CloudConversation";
import { listThreadMessagesAction } from "@/app/actions/whatsapp-cloud";
import type { ThreadSummary, ThreadMessage } from "@/lib/services/whatsapp-cloud-inbox";
import { useGlassTag } from "@/lib/glass/use-glass-tag";

export function WhatsAppCloudPanel({
  threads,
  initialThread,
  initialMessages,
}: {
  threads: ThreadSummary[];
  initialThread: ThreadSummary | null;
  initialMessages: ThreadMessage[];
}) {
  const [active, setActive] = useState<{ thread: ThreadSummary; messages: ThreadMessage[] } | null>(
    initialThread ? { thread: initialThread, messages: initialMessages } : null,
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const panelTag = useGlassTag("whatsapp-panel", "WhatsApp · panel");

  if (threads.length === 0) return null;

  async function open(t: ThreadSummary) {
    if (active?.thread.id === t.id) return;
    setLoadingId(t.id);
    try {
      const res = await listThreadMessagesAction(t.id);
      if (res) setActive({ thread: res.thread, messages: res.messages });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div
      {...panelTag.props}
      className={panelTag.className}
      style={{
        borderRadius: 16,
        marginBottom: 18,
        overflow: "hidden",
        ...(panelTag.picked ? {} : {
          border: "1px solid var(--agent-border-subtle)",
          background: "var(--agent-glass-bg, var(--agent-surface-elevated))",
        }),
      }}
    >
      <div style={{ padding: "12px 14px 0" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
          WhatsApp conversations
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "9px 0 10px" }}>
          {threads.map((t) => {
            const on = active?.thread.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => open(t)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: on ? "1.5px solid rgba(var(--agent-coral-rgb,255,107,74),0.55)" : "1px solid var(--agent-border-default)",
                  background: "var(--agent-surface-elevated, #fff)",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontFamily: "inherit",
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: on ? "var(--agent-coral-darker, #E55B3D)" : "var(--agent-text-secondary)",
                  cursor: "pointer",
                }}
              >
                {loadingId === t.id ? "Opening…" : (t.displayName ?? `+${t.waId}`)}
                {t.side && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--agent-text-muted)" }}>{t.side.toLowerCase()}</span>}
                {t.unreadCount > 0 && (
                  <span style={{ minWidth: 17, height: 17, borderRadius: 999, background: "var(--agent-coral-deep, #FF6B4A)", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" }}>
                    {t.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {active && (
        <div style={{ height: 420, borderTop: "1px solid var(--agent-border-subtle)" }}>
          <CloudConversation key={active.thread.id} thread={active.thread} messages={active.messages} />
        </div>
      )}
    </div>
  );
}
