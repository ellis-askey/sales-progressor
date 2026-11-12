"use client";

// Client-preview toasts: a "here's exactly what your client will see" window that
// floats bottom-right while you compose. Reuses the REAL portal pieces
// (PortalGlassCard + ActorAvatar + the P tokens + the exact checkpoint-row
// markup), so the preview IS the client view, not a mock-up of it.
//
// ClientPreviewStack renders a reflowing column: one toast per thing that will
// actually be sent. Two-sided updates show two stacked toasts; clear one side
// and its toast animates out while the other settles into place. The stack
// portals to <body> at a high z-index so it floats above the compose modal.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { ActorAvatar } from "@/components/ui/Avatar";
import { P } from "@/components/portal/portal-ui";
import { stripCommsLinksSilent } from "@/lib/utils/strip-comms-links";
import "./client-preview.css";

function nowStamp(): string {
  const now = new Date();
  const d = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const t = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${d} · ${t}`;
}

// A written client update, exactly as it lands in the portal "Updates" feed
// (the "Agent update" branch of app/portal/[token]/updates/page.tsx).
export function UpdatePreviewCard({ content, teamName = "Your team" }: { content: string; teamName?: string }) {
  const body = stripCommsLinksSilent(content);
  return (
    <PortalGlassCard glassId="updates-card" label="Update card" defaultVariant="v26" className="flex items-start gap-3.5 px-5 py-4">
      <div className="flex-shrink-0 mt-0.5">
        <ActorAvatar name={teamName} role="progressor" image={null} size={32} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: body ? P.textPrimary : P.textMuted }}>
          {body || "Start typing and your client sees it here…"}
        </p>
        <div className="mt-1.5 flex items-center gap-x-2">
          <span className="text-[12px]" style={{ color: P.textMuted }}>{nowStamp()}</span>
        </div>
      </div>
    </PortalGlassCard>
  );
}

// A checkpoint, exactly as it appears in the portal "Things to confirm" card
// (the open-item row from components/portal/PortalThingsToConfirm.tsx).
export function CheckpointPreviewCard({ label, neededBy }: { label: string; neededBy?: string | null }) {
  return (
    <PortalGlassCard glassId="things-to-confirm" label="Things to confirm" defaultVariant="v05" className="overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[12px] font-bold tracking-[0.01em]" style={{ color: P.primary }}>Things to confirm</p>
      </div>
      <div className="flex items-start gap-3 px-5 py-3.5" style={{ borderTop: `1px solid ${P.border}` }}>
        <span className="flex-none mt-0.5 w-6 h-6 rounded-full" style={{ background: "#fff", border: `2px solid ${P.primary}`, display: "grid", placeItems: "center" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: P.primary }} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium leading-snug" style={{ color: label ? P.textPrimary : P.textMuted }}>
            {label || "Your checkpoint label…"}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: neededBy ? P.primaryText : P.textMuted }}>
            {neededBy ? `Needed by ${neededBy}` : "Action needed from you"}
          </p>
        </div>
        <button
          type="button"
          className="flex-none"
          style={{ padding: "8px 15px", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)", boxShadow: "0 1px 0 #C63E20, 0 3px 8px rgba(240,78,44,0.28)", cursor: "default" }}
          tabIndex={-1}
          aria-hidden
        >
          Confirm
        </button>
      </div>
    </PortalGlassCard>
  );
}

// ── The stack ────────────────────────────────────────────────────────────────
export type ClientPreviewItem = { key: string; title: string; sent?: string | null; content: ReactNode };

function Eye() {
  return (
    <span className="cpv-eye" aria-hidden>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
    </span>
  );
}

function StackedToast({ title, sent, leaving, children }: { title: string; sent: string | null; leaving: boolean; children: ReactNode }) {
  return (
    <div className={"cpv-item" + (leaving ? " cpv-leaving" : "")}>
      <div className="cpv-item-inner">
        <aside className="cpv-toast" aria-live="polite" aria-label="Client preview">
          <div className="cpv-toast-head"><Eye />{title}</div>
          <div className="cpv-portal">
            {children}
            <div className="cpv-sent" data-on={sent ? "1" : undefined}>
              <span className="cpv-sent-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {sent}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Renders `items` as a reflowing bottom-right column, portaled to <body>.
// Items that disappear from the list animate out before unmounting; new ones
// spring in. `offsetBottom` keeps it clear of whatever already sits bottom-right.
export function ClientPreviewStack({ items, offsetBottom = 92, zIndex = 1200 }: { items: ClientPreviewItem[]; offsetBottom?: number; zIndex?: number }) {
  const [rendered, setRendered] = useState<(ClientPreviewItem & { leaving: boolean })[]>(() => items.map((i) => ({ ...i, leaving: false })));
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    setRendered((prev) => {
      const liveKeys = new Set(items.map((i) => i.key));
      for (const k of liveKeys) { if (timers.current[k]) { window.clearTimeout(timers.current[k]); delete timers.current[k]; } }
      const next: (ClientPreviewItem & { leaving: boolean })[] = items.map((i) => ({ ...i, leaving: false }));
      for (const p of prev) {
        if (!liveKeys.has(p.key) && !next.some((n) => n.key === p.key)) {
          next.push({ ...p, leaving: true });
          if (!timers.current[p.key]) {
            timers.current[p.key] = window.setTimeout(() => {
              setRendered((cur) => cur.filter((x) => x.key !== p.key));
              delete timers.current[p.key];
            }, 420);
          }
        }
      }
      return next;
    });
  }, [items]);

  useEffect(() => () => { Object.values(timers.current).forEach((t) => window.clearTimeout(t)); }, []);

  if (typeof document === "undefined" || rendered.length === 0) return null;

  return createPortal(
    <div className="cpv-stack" style={{ bottom: offsetBottom, zIndex }}>
      {rendered.map((r) => (
        <StackedToast key={r.key} title={r.title} sent={r.sent ?? null} leaving={r.leaving}>
          {r.content}
        </StackedToast>
      ))}
    </div>,
    document.body,
  );
}
