"use client";

// Native messaging — staff file tab (Phase 1).
//
// Two strictly-separated conversations (Buyer / Seller) on one property file.
// Staff send + read through the DB (server actions in app/actions/messaging.ts);
// there is NO real-time, NO client portal, NO attachments and NO notifications in
// this phase — those are later phases. "Receiving" is covered by a refetch on
// window focus and on side switch (not a polling loop).
//
// Sending is optimistic: a pending bubble appears instantly, then reconciles to
// the server message (idempotent on its clientMsgId) or shows Failed + Retry.
//
// Visual language follows the agent-app tokens (coral accent, frosted surface,
// light+dark peers). Self-contained styles below so it drops into the file tab
// without touching shared CSS.

import { useState, useRef, useEffect, useCallback } from "react";
import { extractFirstName } from "@/lib/contacts/displayName";
import {
  sendStaffMessageAction,
  markStaffConversationReadAction,
  fetchStaffSideAction,
} from "@/app/actions/messaging";
import type { MessagingSide } from "@/lib/services/messaging/side";
import type { StaffSideData } from "@/lib/services/messaging/types";
import {
  type LocalMsg,
  makeOptimistic,
  reconcileSend,
  markRetrying,
  mergeServerMessages,
} from "@/lib/services/messaging/client-state";

const LONDON = "Europe/London";
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { timeZone: LONDON, hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}
function dayKey(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { timeZone: LONDON, day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}
function dayLabel(iso: string): string {
  const today = dayKey(new Date().toISOString());
  const yest = dayKey(new Date(Date.now() - 86400000).toISOString());
  const k = dayKey(iso);
  if (k === today) return "Today";
  if (k === yest) return "Yesterday";
  return k;
}
export function StaffMessagesTab({
  transactionId,
  initialSides,
}: {
  transactionId: string;
  initialSides: StaffSideData[];
}) {
  const metaFor = useCallback(
    (side: MessagingSide): StaffSideData =>
      initialSides.find((s) => s.side === side) ?? {
        side,
        label: side === "buyer" ? "Buyer" : "Seller",
        participantNames: [],
        conversationId: null,
        messages: [],
        unread: 0,
      },
    [initialSides],
  );

  const [bySide, setBySide] = useState<Record<MessagingSide, LocalMsg[]>>(() => ({
    buyer: metaFor("buyer").messages.map((m) => ({ ...m })),
    seller: metaFor("seller").messages.map((m) => ({ ...m })),
  }));
  const [unread, setUnread] = useState<Record<MessagingSide, number>>(() => ({
    buyer: metaFor("buyer").unread,
    seller: metaFor("seller").unread,
  }));
  const [drafts, setDrafts] = useState<Record<MessagingSide, string>>({ buyer: "", seller: "" });

  const [active, setActive] = useState<MessagingSide>(() => {
    const b = metaFor("buyer");
    const s = metaFor("seller");
    if (b.unread > 0) return "buyer";
    if (s.unread > 0) return "seller";
    if (b.participantNames.length > 0) return "buyer";
    if (s.participantNames.length > 0) return "seller";
    return "buyer";
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const openedRef = useRef(false);

  const activeMeta = metaFor(active);
  const activeMsgs = bySide[active];
  const canSend = activeMeta.participantNames.length > 0;

  // ── read-state + focus/switch refetch ──────────────────────────────────────
  const markRead = useCallback(
    (side: MessagingSide) => {
      setUnread((u) => (u[side] === 0 ? u : { ...u, [side]: 0 }));
      void markStaffConversationReadAction({ transactionId, side });
    },
    [transactionId],
  );

  const refresh = useCallback(
    async (side: MessagingSide) => {
      const res = await fetchStaffSideAction({ transactionId, side });
      if (!res.ok) return;
      setBySide((prev) => ({ ...prev, [side]: mergeServerMessages(prev[side], res.side.messages) }));
    },
    [transactionId],
  );

  // Freshness on first open: the route payload may have been prefetched/cached
  // (unstable_dynamicStaleTime=300), so refetch the active side once on mount so
  // history + unread are current on entry. Event-driven refetches (focus /
  // visibility / side switch) handle later updates; the ref guard keeps this to a
  // single request.
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void refresh(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount + whenever the active side changes: mark read.
  useEffect(() => {
    markRead(active);
  }, [active, markRead]);

  // Refetch the active side when the window regains focus (pick up messages
  // sent elsewhere) — this is the Phase-1 stand-in for real-time.
  useEffect(() => {
    const onFocus = () => {
      void refresh(active);
      markRead(active);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => window.removeEventListener("focus", onFocus);
  }, [active, refresh, markRead]);

  // Auto-scroll to the latest message on load, side switch, and new message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active, activeMsgs.length]);

  function switchSide(side: MessagingSide) {
    if (side === active) return;
    setActive(side);
    void refresh(side);
  }

  // ── sending ────────────────────────────────────────────────────────────────
  const doSend = useCallback(
    async (side: MessagingSide, body: string, clientMsgId: string) => {
      try {
        const res = await sendStaffMessageAction({ transactionId, side, body, clientMsgId });
        const outcome = res.ok ? { ok: true as const, message: res.message } : { ok: false as const };
        setBySide((prev) => ({ ...prev, [side]: reconcileSend(prev[side], clientMsgId, outcome) }));
      } catch {
        // Transport-level failure (network drop, aborted action). The DB write may
        // or may not have landed; either way flip the bubble to Failed so Retry is
        // offered. Retry reuses the same clientMsgId, so a landed write is never
        // duplicated (idempotent upsert) and a refetch dedups a stuck bubble.
        setBySide((prev) => ({ ...prev, [side]: reconcileSend(prev[side], clientMsgId, { ok: false }) }));
      }
    },
    [transactionId],
  );

  function send() {
    const body = drafts[active].trim();
    if (!body || !canSend) return;
    const clientMsgId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `tmp_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const optimistic = makeOptimistic(clientMsgId, body, new Date().toISOString());
    setBySide((prev) => ({ ...prev, [active]: [...prev[active], optimistic] }));
    setDrafts((d) => ({ ...d, [active]: "" }));
    if (taRef.current) taRef.current.style.height = "auto";
    void doSend(active, body, clientMsgId);
  }

  function retry(msg: LocalMsg) {
    setBySide((prev) => ({ ...prev, [active]: markRetrying(prev[active], msg.clientMsgId) }));
    void doSend(active, msg.body, msg.clientMsgId);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
  function onInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    setDrafts((d) => ({ ...d, [active]: el.value }));
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="smt-wrap" data-bloom>
      {/* Side switcher */}
      <div className="smt-head" role="tablist" aria-label="Conversation side">
        {(["buyer", "seller"] as const).map((side) => {
          const m = metaFor(side);
          const isActive = active === side;
          return (
            <button
              key={side}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`smt-side${isActive ? " smt-side-on" : ""}`}
              onClick={() => switchSide(side)}
            >
              <span>{m.label}</span>
              {unread[side] > 0 && !isActive && <span className="smt-dot" aria-label={`${unread[side]} unread`} />}
            </button>
          );
        })}
        <div className="smt-head-who">
          {activeMeta.participantNames.length > 0 ? (
            <>Messaging {activeMeta.participantNames.join(" & ")}</>
          ) : (
            <>No {active} with portal access on this file</>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="smt-scroll" ref={scrollRef}>
        {!canSend ? (
          <div className="smt-empty">
            <p className="smt-empty-title">No {active} to message yet</p>
            <p className="smt-empty-sub">
              This file has no {active}-side client with portal access. Once a principal {active} is added and given a
              portal, their conversation opens here.
            </p>
          </div>
        ) : activeMsgs.length === 0 ? (
          <div className="smt-empty">
            <p className="smt-empty-title">No messages yet</p>
            <p className="smt-empty-sub">
              Start the conversation with {extractFirstName(activeMeta.participantNames[0] ?? "") || "them"}. Messages you send are
              kept on this file.
            </p>
          </div>
        ) : (
          activeMsgs.map((m, i) => {
            const prev = activeMsgs[i - 1];
            const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            return (
              <div key={m.clientMsgId}>
                {showDay && (
                  <div className="smt-day">
                    <span>{dayLabel(m.createdAt)}</span>
                  </div>
                )}
                <div className={`smt-row${m.mine ? " smt-row-mine" : ""}`}>
                  <div className={`smt-bubble${m.mine ? " smt-bubble-mine" : ""}`}>
                    {!m.mine && m.senderName && <span className="smt-sender">{m.senderName}</span>}
                    <span className="smt-body">{m.body}</span>
                    <span className="smt-meta">
                      {m.status === "sending" ? "Sending…" : fmtTime(m.createdAt)}
                      {m.status === "failed" && (
                        <>
                          {" "}
                          <span className="smt-failed">Failed.</span>{" "}
                          <button type="button" className="smt-retry" onClick={() => retry(m)}>
                            Retry
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="smt-composer">
        <textarea
          ref={taRef}
          className="smt-input"
          rows={1}
          placeholder={canSend ? `Message the ${active}…` : "No one to message on this side"}
          value={drafts[active]}
          disabled={!canSend}
          onKeyDown={onKeyDown}
          onInput={onInput}
          aria-label={`Message the ${active}`}
        />
        <button
          type="button"
          className="smt-send"
          onClick={send}
          disabled={!canSend || drafts[active].trim().length === 0}
          aria-label="Send message"
        >
          Send
        </button>
      </div>

      <style>{`
        .smt-wrap { display: flex; flex-direction: column; height: min(68vh, 640px); min-height: 420px;
          border: 0.5px solid var(--agent-border-default, rgba(20,12,6,0.12)); border-radius: 18px; overflow: hidden;
          background: var(--agent-glass-bg, rgba(255,255,255,0.55)); -webkit-backdrop-filter: blur(20px) saturate(160%); backdrop-filter: blur(20px) saturate(160%);
          box-shadow: 0 10px 30px rgba(20,12,6,0.08); }
        .smt-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 0.5px solid var(--agent-border-subtle, rgba(20,12,6,0.08)); flex-wrap: wrap; }
        .smt-side { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 14px; border-radius: 9px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 650; font-family: inherit; color: var(--agent-text-secondary, #6b5b52); background: transparent; transition: background .14s, color .14s; }
        .smt-side:hover { color: var(--agent-text-primary, #2d1810); background: var(--agent-hover-tint, rgba(20,12,6,0.05)); }
        .smt-side-on { color: #fff; background: var(--agent-coral, #FF6B4A); box-shadow: 0 2px 8px rgba(255,107,74,0.3); }
        .smt-side-on:hover { color: #fff; background: var(--agent-coral, #FF6B4A); }
        .smt-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--agent-coral, #FF6B4A); }
        .smt-head-who { margin-left: auto; font-size: 12px; color: var(--agent-text-muted, #9b8a80); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; }
        .smt-scroll { flex: 1; overflow-y: auto; padding: 16px 16px 8px; display: flex; flex-direction: column; gap: 2px; }
        .smt-day { display: flex; justify-content: center; margin: 12px 0 8px; }
        .smt-day span { font-size: 11px; font-weight: 650; color: var(--agent-text-muted, #9b8a80); background: var(--agent-hover-tint, rgba(20,12,6,0.05)); padding: 3px 10px; border-radius: 999px; }
        .smt-row { display: flex; justify-content: flex-start; margin: 1px 0; }
        .smt-row-mine { justify-content: flex-end; }
        .smt-bubble { display: inline-flex; flex-direction: column; max-width: min(78%, 520px); padding: 8px 12px 6px; border-radius: 16px; border-top-left-radius: 5px;
          background: var(--agent-surface-elevated, #fff); border: 0.5px solid var(--agent-border-subtle, rgba(20,12,6,0.08)); }
        .smt-bubble-mine { border-top-left-radius: 16px; border-top-right-radius: 5px; background: var(--agent-coral, #FF6B4A); border-color: transparent; }
        .smt-sender { font-size: 11.5px; font-weight: 700; color: var(--agent-coral, #FF6B4A); margin-bottom: 2px; }
        .smt-body { font-size: 14px; line-height: 1.45; color: var(--agent-text-primary, #2d1810); white-space: pre-wrap; word-break: break-word; }
        .smt-bubble-mine .smt-body { color: #fff; }
        .smt-meta { font-size: 10.5px; margin-top: 3px; align-self: flex-end; color: var(--agent-text-muted, #9b8a80); }
        .smt-bubble-mine .smt-meta { color: rgba(255,255,255,0.82); }
        .smt-failed { color: #b91c1c; font-weight: 650; }
        .smt-bubble-mine .smt-failed { color: #fff; }
        .smt-retry { background: none; border: none; padding: 0; font: inherit; font-size: 10.5px; font-weight: 700; color: inherit; text-decoration: underline; cursor: pointer; }
        .smt-empty { margin: auto; text-align: center; max-width: 360px; padding: 24px; }
        .smt-empty-title { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--agent-text-primary, #2d1810); }
        .smt-empty-sub { margin: 7px 0 0; font-size: 13px; line-height: 1.55; color: var(--agent-text-muted, #9b8a80); }
        .smt-composer { display: flex; align-items: flex-end; gap: 8px; padding: 12px 14px; border-top: 0.5px solid var(--agent-border-subtle, rgba(20,12,6,0.08)); }
        .smt-input { flex: 1; resize: none; min-height: 40px; max-height: 160px; padding: 9px 13px; border-radius: 13px; font: inherit; font-size: 14px; line-height: 1.4;
          color: var(--agent-text-primary, #2d1810); background: var(--agent-surface-elevated, #fff); border: 0.5px solid var(--agent-border-default, rgba(20,12,6,0.14)); outline: none; transition: border-color .14s; }
        .smt-input:focus { border-color: var(--agent-coral, #FF6B4A); box-shadow: none; }
        .smt-input:disabled { opacity: 0.6; cursor: not-allowed; }
        .smt-send { flex-shrink: 0; height: 40px; padding: 0 18px; border-radius: 13px; border: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; color: #fff;
          background: var(--agent-coral, #FF6B4A); box-shadow: 0 2px 10px rgba(255,107,74,0.3); transition: filter .14s, opacity .14s; }
        .smt-send:hover:not(:disabled) { filter: brightness(1.05); }
        .smt-send:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
        :root[data-theme="dark"] .smt-wrap { background: var(--agent-glass-bg, rgba(22,26,34,0.6)); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        :root[data-theme="dark"] .smt-bubble { background: rgba(255,255,255,0.07); }
        :root[data-theme="dark"] .smt-input { background: rgba(255,255,255,0.06); }
        @media (max-width: 640px) { .smt-wrap { height: 72vh; min-height: 0; } .smt-head-who { display: none; } }
      `}</style>
    </div>
  );
}
