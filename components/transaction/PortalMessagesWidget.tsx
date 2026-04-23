"use client";

import { useState, useTransition } from "react";
import { replyPortalMessageAction } from "@/app/actions/portal";
import type { ContactThread } from "@/lib/services/portal-messages";

function fmtTime(d: Date | string) {
  const dt = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return dt.toLocaleDateString("en-GB", { weekday: "short" });
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ReplyForm({ transactionId, contactId }: { transactionId: string; contactId: string }) {
  const [content, setContent] = useState("");
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, start]    = useTransition();

  function send() {
    if (!content.trim()) return;
    setError(null);
    start(async () => {
      try {
        await replyPortalMessageAction({ transactionId, contactId, content });
        setContent("");
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send");
      }
    });
  }

  if (sent) {
    return (
      <p className="text-xs text-emerald-600 font-semibold py-2">
        ✓ Reply sent
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type a reply…"
        rows={2}
        className="w-full resize-none rounded-xl px-3 py-2.5 text-sm border focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white/50"
        style={{ fontFamily: "inherit" }}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={send}
        disabled={isPending || !content.trim()}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 transition-colors"
      >
        {isPending ? "Sending…" : "Reply"}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  );
}

export function PortalMessagesWidget({
  transactionId,
  threads,
}: {
  transactionId: string;
  threads: ContactThread[];
}) {
  const [activeContact, setActiveContact] = useState(threads[0]?.contactId ?? null);

  if (threads.length === 0) return null;

  const activeThread = threads.find((t) => t.contactId === activeContact) ?? threads[0];

  const totalUnread = threads.reduce((n, t) => n + t.unreadCount, 0);

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-900/10">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span className="text-sm font-semibold text-slate-800">Portal messages</span>
          {totalUnread > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white bg-orange-500">
              {totalUnread}
            </span>
          )}
        </div>
      </div>

      {/* Contact tabs (if more than one thread) */}
      {threads.length > 1 && (
        <div className="flex gap-1 px-4 pt-3">
          {threads.map((t) => (
            <button
              key={t.contactId}
              onClick={() => setActiveContact(t.contactId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeContact === t.contactId
                  ? "bg-blue-500 text-white"
                  : "bg-slate-900/5 text-slate-500 hover:bg-slate-900/10"
              }`}
            >
              {t.contactName.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Message thread */}
      <div className="px-4 pt-3 pb-2 max-h-72 overflow-y-auto space-y-2.5">
        {activeThread.messages.map((msg) => {
          const isClient = msg.fromClient;
          return (
            <div key={msg.id} className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  isClient
                    ? "bg-slate-100 text-slate-800"
                    : "bg-blue-500 text-white"
                }`}
                style={{
                  borderRadius: isClient ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
                }}
              >
                {isClient && (
                  <p className="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-wide">
                    {activeThread.contactName.split(" ")[0]}
                  </p>
                )}
                <p className="text-sm leading-snug">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isClient ? "text-slate-400" : "text-blue-200"}`}>
                  {fmtTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply form */}
      <div className="px-4 pb-4">
        <ReplyForm transactionId={transactionId} contactId={activeThread.contactId} />
      </div>
    </div>
  );
}
