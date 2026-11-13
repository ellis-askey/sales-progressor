"use client";

// Top-bar "Recently viewed" control for the agent shell (desktop). A hover
// dropdown in the SAME glass as the user-menu chip, portalled to <body> so the
// search capsule can't clip it. Reads the ids from localStorage (useRecentlyViewed)
// and fetches fresh photos + current addresses from /api/agent/recent-files the
// first time it opens (stored signed URLs would expire). Mirrors the proven
// /dev/recently-viewed-nav prototype.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ClockCounterClockwise, CaretDown } from "@phosphor-icons/react";
import { useRecentlyViewed } from "@/lib/agent/use-recently-viewed";
import { PropertyThumb } from "@/components/ui/PropertyThumb";

type FileMeta = { id: string; address: string; photoUrl: string | null };

function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

function splitAddr(a: string): [string, string] {
  const parts = a.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [a, ""];
  return [parts[0], parts.slice(1).join(", ")];
}

export function RecentlyViewedMenu({ userId }: { userId: string }) {
  const entries = useRecentlyViewed(5, userId);
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Record<string, FileMeta>>({});
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const closeT = useRef<number | undefined>(undefined);
  const fetchedKey = useRef<string>("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const idKey = entries.map((e) => e.id).join(",");

  // Fresh photos/addresses the first time this id-set is opened.
  useEffect(() => {
    if (!open || !idKey || fetchedKey.current === idKey) return;
    fetchedKey.current = idKey;
    let cancelled = false;
    fetch(`/api/agent/recent-files?ids=${encodeURIComponent(idKey)}`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d: { files: FileMeta[] }) => { if (!cancelled) setMeta(Object.fromEntries((d.files ?? []).map((f) => [f.id, f]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, idKey]);

  if (entries.length === 0) return null;

  const openMenu = () => {
    if (closeT.current) window.clearTimeout(closeT.current);
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: Math.round(r.bottom + 8), left: Math.round(r.left) });
    setOpen(true);
  };
  const scheduleClose = () => { closeT.current = window.setTimeout(() => setOpen(false), 130); };

  const cardContent = (
    <div className="rvm-card" data-open={open ? "1" : "0"} role="menu"
      onMouseEnter={openMenu} onMouseLeave={scheduleClose}
      style={{ position: "fixed", top: coords.top, left: coords.left }}>
      <p className="rvm-title">Recently viewed</p>
      <div className="rvm-list">
        {entries.map((e, i) => {
          const m = meta[e.id];
          const [l1, l2] = splitAddr(m?.address ?? e.address);
          return (
            <Link key={e.id} href={`/agent/transactions/${e.id}`} unstable_dynamicOnHover role="menuitem" className="rvm-row"
              style={{ transitionDelay: open ? `${60 + i * 36}ms` : "0ms" }} onClick={() => setOpen(false)}>
              <PropertyThumb photoUrl={m?.photoUrl ?? null} size={40} />
              <span className="rvm-row-text">
                <span className="rvm-row-l1">{l1}</span>
                {l2 && <span className="rvm-row-l2">{l2}</span>}
              </span>
              <span className="rvm-row-when">{relTime(e.visitedAt)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="rvm-wrap" data-open={open ? "1" : "0"} onMouseEnter={openMenu} onMouseLeave={scheduleClose} style={{ position: "relative", display: "inline-flex" }}>
      <button ref={triggerRef} type="button" onFocus={openMenu} onBlur={scheduleClose} className="rvm-trigger" aria-haspopup="true" aria-expanded={open}>
        <ClockCounterClockwise size={16} weight="regular" />
        <span className="rvm-trigger-label">Recently viewed</span>
        <CaretDown size={11} weight="bold" className="rvm-caret" />
      </button>
      {typeof document !== "undefined" && createPortal(cardContent, document.body)}

      <style>{`
        .rvm-trigger { display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px; border-radius: 10px; border: none; cursor: pointer;
          background: transparent; color: var(--agent-text-secondary); font-size: 13px; font-weight: 600; white-space: nowrap; transition: background .14s; font-family: inherit; }
        .rvm-wrap[data-open="1"] .rvm-trigger, .rvm-trigger:hover { background: var(--agent-hover-tint); color: var(--agent-text-primary); }
        .rvm-caret { transition: transform .18s; }
        .rvm-wrap[data-open="1"] .rvm-caret { transform: rotate(180deg); }

        .rvm-card { width: 320px; border-radius: 16px; z-index: var(--agent-z-toast, 9999); padding: 6px; overflow: hidden;
          border: 0.5px solid var(--agent-glass-border); box-shadow: 0 16px 44px rgba(20,12,6,0.22);
          --rvm-ink: 45,24,16; background: rgba(255,255,255,0.30); -webkit-backdrop-filter: blur(30px) saturate(200%); backdrop-filter: blur(30px) saturate(200%);
          opacity: 0; transform: translateY(-8px) scale(0.98); transform-origin: top left; pointer-events: none;
          transition: opacity .2s cubic-bezier(.2,.8,.2,1), transform .24s cubic-bezier(.2,.8,.2,1); }
        :root[data-theme="dark"] .rvm-card { --rvm-ink: 235,235,240; background: rgba(20,26,36,0.30); }
        .rvm-card[data-open="1"] { opacity: 1; transform: none; pointer-events: auto; }
        .rvm-title { margin: 6px 10px 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--agent-text-muted); }
        .rvm-list { display: flex; flex-direction: column; gap: 1px; }
        .rvm-row { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 11px; text-decoration: none;
          opacity: 0; transform: translateY(-7px);
          transition: opacity .26s cubic-bezier(.2,.8,.2,1), transform .26s cubic-bezier(.2,.8,.2,1), background .12s; }
        .rvm-card[data-open="1"] .rvm-row { opacity: 1; transform: none; }
        .rvm-row:hover { background: rgba(var(--rvm-ink), 0.07); }
        .rvm-row-text { flex: 1; min-width: 0; }
        .rvm-row-l1 { display: block; font-size: 13px; font-weight: 600; color: var(--agent-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rvm-row-l2 { display: block; font-size: 11.5px; color: var(--agent-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rvm-row-when { font-size: 11px; color: var(--agent-text-muted); flex-shrink: 0; }
      `}</style>
    </div>
  );
}
