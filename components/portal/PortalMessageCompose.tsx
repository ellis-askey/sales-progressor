"use client";

import { useState, useTransition } from "react";
import { portalSendMessageAction } from "@/app/actions/portal";
import { P } from "./portal-ui";

export function PortalMessageCompose({ token }: { token: string }) {
  const [content, setContent] = useState("");
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await portalSendMessageAction({ token, content });
        setContent("");
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't send — please try again");
      }
    });
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
      <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${P.border}` }}>
        <p className="text-[14px] font-bold" style={{ color: P.textPrimary }}>
          Message your team
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>
          Ask a question or send an update — your progressor will reply by email or here
        </p>
      </div>

      <div className="px-5 py-4">
        {sent ? (
          <div className="flex items-center gap-2.5 py-3 px-4 rounded-xl" style={{ background: P.successBg }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p className="text-[13px] font-semibold" style={{ color: P.success }}>
              Message sent — your team will be in touch soon
            </p>
          </div>
        ) : (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message here…"
              rows={3}
              className="w-full resize-none rounded-xl px-4 py-3 text-[14px] leading-relaxed border focus:outline-none focus:ring-2"
              style={{
                borderColor: P.border,
                background: P.pageBg,
                color: P.textPrimary,
                fontFamily: "inherit",
              }}
            />
            {error && (
              <p className="text-[12px] mt-2" style={{ color: "#EF4444" }}>{error}</p>
            )}
            <button
              onClick={send}
              disabled={isPending || !content.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-bold text-white disabled:opacity-40 transition-opacity"
              style={{ background: P.primary }}
            >
              {isPending ? (
                "Sending…"
              ) : (
                <>
                  Send message
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
