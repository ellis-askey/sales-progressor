"use client";

// Read-only WhatsApp transcript for the file's WhatsApp tab. Renders captured
// messages chat-style — outbound (from the linked account) on the right in
// green, inbound on the left in white with a coloured sender name in groups,
// day dividers, and inline media. Opens scrolled to the newest message. We
// never send from here, so there is no composer.
//
// The WhatsApp look is deliberate (founder request 2026-08-25): faithful chat
// styling, not the agent-app cream/coral tokens.

import { useState, useLayoutEffect, useRef, Fragment } from "react";
import type { WhatsAppConversation, WhatsAppChatMessage } from "@/lib/services/comms";

// Stable per-name colour for group sender labels, WhatsApp-style.
const NAME_COLOURS = ["#e542a3", "#1f7aec", "#00a884", "#b8621b", "#8e6fd8", "#c9314e", "#0c8aa6", "#7a8b1a"];
function nameColour(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return NAME_COLOURS[h % NAME_COLOURS.length];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}
function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// Split text into plain runs + tappable links. The split keeps the captured
// URLs (odd indices); a URL run always starts with the scheme, so test that
// prefix rather than reusing a /g regex (whose lastIndex is stateful).
const URL_SPLIT_RE = /(https?:\/\/[^\s]+)/g;
const isUrl = (s: string) => /^https?:\/\//.test(s);
function Linkified({ text, outbound }: { text: string; outbound: boolean }) {
  const parts = text.split(URL_SPLIT_RE);
  return (
    <>
      {parts.map((part, i) =>
        isUrl(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: outbound ? "#027eb5" : "#1f7aec", textDecoration: "underline", wordBreak: "break-all" }}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// media placeholder text ("[image]", "[voice]") — hidden once the media renders.
const PLACEHOLDER_RE = /^\[[a-z ]+\]$/i;

function Media({ url, type }: { url: string; type: string | null }) {
  const t = (type ?? "").toLowerCase();
  if (t === "image" || t === "sticker") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="WhatsApp attachment" style={{ maxWidth: "100%", width: 240, maxHeight: 260, objectFit: "cover", borderRadius: 6, display: "block" }} />
      </a>
    );
  }
  if (t === "video") return <video src={url} controls style={{ width: 260, maxWidth: "100%", borderRadius: 6, display: "block" }} />;
  if (t === "voice" || t === "audio") return <audio src={url} controls style={{ width: 240, maxWidth: "100%", display: "block" }} />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#027eb5", padding: "8px 10px", borderRadius: 6, background: "rgba(0,0,0,0.04)", textDecoration: "none" }}
    >
      📎 Open attachment
    </a>
  );
}

function Bubble({ m, showSenders }: { m: WhatsAppChatMessage; showSenders: boolean }) {
  const outbound = m.direction === "outbound";
  const hasMedia = !!m.mediaUrl;
  const showText = m.content.trim().length > 0 && !(hasMedia && PLACEHOLDER_RE.test(m.content.trim()));
  return (
    <div style={{ display: "flex", justifyContent: outbound ? "flex-end" : "flex-start", padding: "1px 0" }}>
      <div
        style={{
          maxWidth: "78%",
          background: outbound ? "#d9fdd3" : "#ffffff",
          borderRadius: 8,
          borderTopRightRadius: outbound ? 2 : 8,
          borderTopLeftRadius: outbound ? 8 : 2,
          padding: "6px 9px 5px",
          boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)",
        }}
      >
        {showSenders && !outbound && m.senderLabel && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: nameColour(m.senderLabel), marginBottom: 2 }}>{m.senderLabel}</div>
        )}
        {hasMedia && m.mediaUrl && (
          <div style={{ marginBottom: showText ? 5 : 3 }}>
            <Media url={m.mediaUrl} type={m.mediaType} />
          </div>
        )}
        {showText && (
          <div style={{ fontSize: 14.2, lineHeight: 1.4, color: "#111b21", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            <Linkified text={m.content} outbound={outbound} />
          </div>
        )}
        <div style={{ fontSize: 11, color: "#667781", textAlign: "right", marginTop: 1, userSelect: "none" }}>{timeLabel(m.at)}</div>
      </div>
    </div>
  );
}

export function WhatsAppChat({ conversations }: { conversations: WhatsAppConversation[] }) {
  const [selected, setSelected] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const convo = conversations[selected] ?? conversations[0];

  // Jump to the newest message whenever the open conversation changes.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected]);

  let lastDay = "";

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: "0.5px solid var(--agent-border-subtle)", background: "#fff" }}>
      {/* Header — chat title + conversation switcher for buyer/seller groups */}
      <div style={{ background: "#f0f2f5", borderBottom: "0.5px solid rgba(11,20,26,0.1)" }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", background: "#25d366", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            💬
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111b21", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{convo.title}</div>
            <div style={{ fontSize: 12, color: "#667781" }}>
              {convo.chatId === "side:other" ? "Other messages" : `All WhatsApp with the ${convo.title.toLowerCase()}`} · read-only
            </div>
          </div>
        </div>
        {conversations.length > 1 && (
          <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", flexWrap: "wrap" }}>
            {conversations.map((c, i) => (
              <button
                key={c.chatId}
                onClick={() => setSelected(i)}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "5px 11px",
                  borderRadius: 999,
                  border: "0.5px solid",
                  borderColor: i === selected ? "#25d366" : "rgba(11,20,26,0.14)",
                  background: i === selected ? "rgba(37,211,102,0.14)" : "#fff",
                  color: i === selected ? "#0a6e3a" : "#3b4a54",
                  cursor: "pointer",
                  maxWidth: 220,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages — WhatsApp beige backdrop, scrolls internally, opens at newest */}
      <div
        ref={scrollRef}
        style={{
          background: "#efeae2",
          padding: "12px 14px",
          height: "min(66vh, 640px)",
          minHeight: 320,
          overflowY: "auto",
        }}
      >
        {convo.messages.map((m) => {
          const key = dayKey(m.at);
          const showDivider = key !== lastDay;
          lastDay = key;
          return (
            <Fragment key={m.id}>
              {showDivider && (
                <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#54656f", background: "#ffffff", padding: "5px 12px", borderRadius: 8, boxShadow: "0 1px 0.5px rgba(11,20,26,0.13)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                    {dayLabel(m.at)}
                  </span>
                </div>
              )}
              <Bubble m={m} showSenders={convo.showSenders} />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
