"use client";

// /dev/bell-check — the bell button exactly as the experimental capsule renders
// it (same classes + CountBadge), so the "looks clicked / off" state is visible.

import { useEffect, useState } from "react";
import { Bell } from "@/components/icons/ph";
import { CountBadge } from "@/components/ui/CountBadge";
import { UserAvatar } from "@/components/ui/Avatar";

function BellReplica({ count }: { count: number }) {
  return (
    <span className="agx-hide-on-search" style={{ display: "inline-flex" }}>
      <button
        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-transparent agent-chip-hover"
        title="Updates"
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
    </span>
  );
}

export default function Page() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const v = dark ? "dark" : "custom";
    document.documentElement.dataset.theme = v;
    document.querySelectorAll<HTMLElement>("[data-theme]").forEach((el) => { el.dataset.theme = v; });
    return () => { document.documentElement.dataset.theme = "custom"; };
  }, [dark]);

  const cap = (
    <div className="agx-cap agx-frost" style={{ borderRadius: 19 }}>
      <div className="agx-cap-search" style={{ width: 240 }}>
        <div style={{ height: 36, borderRadius: 10, background: "var(--agent-surface-subtle)", display: "flex", alignItems: "center", padding: "0 12px", fontSize: 13, color: "var(--agent-text-muted)" }}>Search…</div>
      </div>
      <div className="agx-controls">
        <button className="agx-asof agent-hover-ctl" type="button"><span style={{ display: "inline-flex" }}><Bell className="w-4 h-4" style={{ opacity: 0 }} /></span></button>
        <BellReplica count={1} />
        <BellReplica count={0} />
        <UserAvatar user={{ name: "Ellis Askey", image: null }} size={26} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, padding: "28px 24px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <button onClick={() => setDark(false)} style={{ padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1px solid var(--agent-border-default)" }}>Light</button>
        <button onClick={() => setDark(true)} style={{ padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1px solid var(--agent-border-default)" }}>Dark</button>
      </div>

      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 10px" }}>Capsule context (unread = 1, then resting)</p>
      <div style={{ display: "inline-flex" }}>{cap}</div>

      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "40px 0 10px" }}>Bell alone, zoomed (unread / resting)</p>
      <div style={{ display: "flex", gap: 40, alignItems: "center", transform: "scale(3)", transformOrigin: "left center", width: "fit-content" }}>
        <BellReplica count={1} />
        <BellReplica count={0} />
      </div>
    </div>
  );
}
