"use client";

// One WhatsApp conversation (Phase 4): bubbles with real delivery ticks, a
// composer that respects the 24-hour reply window, and a quiet poll so replies
// appear without refreshing. Shared by the per-file WhatsApp tab and the
// central inbox — one component, one history (REBUILD_PLAN §7: never two).

import { useCallback, useEffect, useRef, useState } from "react";
import { listThreadMessagesAction, markThreadReadAction, sendWaMessageAction } from "@/app/actions/whatsapp-cloud";
import type { ThreadSummary, ThreadMessage } from "@/lib/services/whatsapp-cloud-inbox";

const POLL_MS = 12_000;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Delivery ticks, WhatsApp-style but honest: each glyph is a provider-confirmed
// state, never an assumption.
function Ticks({ status }: { status: string }) {
  if (status === "queued") return <span title="Sending" style={{ opacity: 0.6 }}>…</span>;
  if (status === "sent") return <span title="Sent">✓</span>;
  if (status === "delivered") return <span title="Delivered">✓✓</span>;
  if (status === "opened" || status === "clicked") return <span title="Read" style={{ color: "#3D7AB8", fontWeight: 700 }}>✓✓</span>;
  if (status === "failed" || status === "bounced") return <span title="Failed" style={{ color: "var(--agent-danger, #C73E3E)", fontWeight: 700 }}>!</span>;
  return null;
}

export function CloudConversation({ thread: initialThread, messages: initialMessages }: { thread: ThreadSummary; messages: ThreadMessage[] }) {
  const [thread, setThread] = useState(initialThread);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | undefined>(initialMessages[initialMessages.length - 1]?.at);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, []);

  useEffect(() => {
    scrollToEnd();
    markThreadReadAction(initialThread.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThread.id]);

  // Full refresh (statuses change on EXISTING rows, so polls re-fetch whole
  // history rather than only the tail — 500-row cap keeps it cheap).
  const refresh = useCallback(async () => {
    try {
      const res = await listThreadMessagesAction(thread.id);
      if (!res) return;
      setThread(res.thread);
      const grew = res.messages.length !== messages.length;
      setMessages(res.messages);
      lastAtRef.current = res.messages[res.messages.length - 1]?.at;
      if (grew) {
        scrollToEnd();
        markThreadReadAction(thread.id).catch(() => {});
      }
    } catch {
      /* next poll retries */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, messages.length]);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const windowOpen = !!thread.windowOpenUntil && new Date(thread.windowOpenUntil).getTime() > Date.now();

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await sendWaMessageAction(thread.id, body);
      if (res.ok) {
        setDraft("");
        await refresh();
      } else {
        setSendError(res.error ?? "Couldn't send. Try again.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 320 }}>
      {/* History */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px", display: "flex", flexDirection: "column", gap: 7 }}>
        {messages.length === 0 && (
          <p style={{ margin: "auto", fontSize: 13, color: "var(--agent-text-muted)" }}>
            No messages yet in this conversation.
          </p>
        )}
        {messages.map((m) => {
          const out = m.direction === "outbound";
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "76%",
                  borderRadius: 14,
                  padding: "8px 12px",
                  background: out ? "rgba(var(--agent-coral-rgb, 255,107,74), 0.10)" : "var(--agent-surface-elevated, #fff)",
                  border: "1px solid var(--agent-border-subtle)",
                }}
              >
                {!out && m.senderLabel && (
                  <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--agent-coral-deep, #E2452A)" }}>{m.senderLabel}</p>
                )}
                {/* Media (Phase 4b): photo inline, voice/audio as a player, the rest as a link */}
                {m.mediaUrl && (m.mediaKind === "image" || m.mediaKind === "sticker") && (
                  <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.mediaUrl} alt="" style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 10, display: "block" }} />
                  </a>
                )}
                {m.mediaUrl && m.mediaKind === "audio" && (
                  <audio controls src={m.mediaUrl} style={{ width: 230, maxWidth: "100%", marginBottom: 6 }} />
                )}
                {m.mediaUrl && (m.mediaKind === "document" || m.mediaKind === "video") && (
                  <a
                    href={m.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12.5, fontWeight: 650, color: "var(--agent-coral-deep, #E2452A)", textDecoration: "none", border: "1px solid var(--agent-border-default)", borderRadius: 9, padding: "6px 10px" }}
                  >
                    📄 {m.mediaFilename ?? (m.mediaKind === "video" ? "Video" : "Document")}
                  </a>
                )}
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: "var(--agent-text-primary)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {m.content}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "var(--agent-text-muted)", textAlign: "right", display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "baseline" }}>
                  {timeLabel(m.at)} {out && <Ticks status={m.status} />}
                </p>
                {(m.status === "failed" || m.status === "bounced") && m.failureReason && (
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-danger, #C73E3E)" }}>{m.failureReason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer — Cloud-number threads only. Bridge-captured conversations
          are read-only by design: people type on their own phones. */}
      {thread.canSend && (
      <div style={{ borderTop: "1px solid var(--agent-border-subtle)", padding: "10px 12px" }}>
        {!windowOpen && (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            The 24-hour reply window is closed, so WhatsApp only allows an approved template message here. Free-form replies
            re-open when {thread.displayName ?? "they"} next message.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            disabled={!windowOpen || sending}
            placeholder={windowOpen ? `Message ${thread.displayName ?? "them"}…` : "Reply window closed"}
            style={{
              flex: 1,
              resize: "none",
              fontFamily: "inherit",
              fontSize: 13.5,
              lineHeight: 1.45,
              padding: "9px 11px",
              borderRadius: 10,
              border: "1px solid var(--agent-border-default)",
              background: "var(--agent-surface-elevated, #fff)",
              color: "var(--agent-text-primary)",
              opacity: windowOpen ? 1 : 0.6,
            }}
          />
          <button
            onClick={send}
            disabled={!windowOpen || sending || !draft.trim()}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(180deg, var(--agent-coral, #FF8A65), var(--agent-coral-deep, #FF6B4A))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
              cursor: !windowOpen || sending || !draft.trim() ? "default" : "pointer",
              opacity: !windowOpen || sending || !draft.trim() ? 0.55 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        {sendError && <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--agent-danger, #C73E3E)" }}>{sendError}</p>}
      </div>
      )}
    </div>
  );
}
