"use client";

// /dev/whats-new-preview — shows the real "What's new" nav item (with its unread
// dot) and the real WhatsNewFeed, with mock updates, so the feature can be seen
// without publishing anything. Not a feature; a review harness.

import { useEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { AgentNavRail, type NavRailItem } from "@/components/layout/AgentNavRail";
import { WhatsNewFeed } from "@/components/whats-new/WhatsNewFeed";
import type { FeedUpdate } from "@/lib/platform-updates/feed";

// A couple of example entries, one of each category, newest first.
const UPDATES: FeedUpdate[] = [
  {
    id: "u1",
    category: "new_feature",
    title: "Solicitor firm profiles, redesigned",
    body: "Every solicitor firm now has a cleaner profile: performance timings, exchange rate, a firm-wide activity feed, private team notes and the current stage of every sale you're working with them.",
    publishedAt: "2026-11-13T09:00:00.000Z",
    linkUrl: "/agent/partners",
    imageUrl: null,
  },
  {
    id: "u2",
    category: "improvement",
    title: "Faster file pages",
    body: "Opening a sale is quicker. The timeline, milestones and client details now load with less waiting, especially on busier files.",
    publishedAt: "2026-11-06T09:00:00.000Z",
    linkUrl: null,
    imageUrl: null,
  },
  {
    id: "u3",
    category: "moved",
    title: "Billing now lives in your account menu",
    body: "We've moved billing into the account dropdown in the top right, alongside your settings, so it's easier to find when you need it.",
    publishedAt: "2026-10-28T09:00:00.000Z",
    linkUrl: null,
    imageUrl: null,
  },
];

export default function Page() {
  const [dark, setDark] = useState(false);
  const [unread, setUnread] = useState(true);

  useEffect(() => {
    const v = dark ? "dark" : "custom";
    document.documentElement.dataset.theme = v;
    document.querySelectorAll<HTMLElement>("[data-theme]").forEach((el) => { el.dataset.theme = v; });
    return () => { document.documentElement.dataset.theme = "custom"; };
  }, [dark]);

  const navItem: NavRailItem = { href: "/agent/whats-new", label: "What's new", Icon: Sparkle, dot: unread };

  const toggle = (label: string, on: boolean, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{
      padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${on ? "var(--agent-coral)" : "var(--agent-border-default)"}`,
      background: on ? "var(--agent-coral-bg-tint)" : "var(--agent-surface-elevated)",
      color: on ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "14px 20px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-muted)", marginRight: 2 }}>Theme</span>
        {toggle("Light", !dark, () => setDark(false))}
        {toggle("Dark", dark, () => setDark(true))}
        <span style={{ width: 12 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-muted)", marginRight: 2 }}>Unread dot</span>
        {toggle("On", unread, () => setUnread(true))}
        {toggle("Off", !unread, () => setUnread(false))}
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "8px 20px 60px", display: "grid", gridTemplateColumns: "220px 1fr", gap: 28, alignItems: "start" }}>
        {/* How the nav item looks in the sidebar */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 10px 4px" }}>In the sidebar</p>
          <div className="agent-glass" style={{ borderRadius: 14, padding: "10px 10px" }}>
            <AgentNavRail items={[navItem]} pathname="/agent/hub" />
          </div>
          <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "12px 4px 0", lineHeight: 1.5 }}>
            The coral dot appears when there&rsquo;s an update your users haven&rsquo;t opened. It clears the moment they open the page. The item only shows once you&rsquo;ve published an update for that audience.
          </p>
        </div>

        {/* The What's new page itself */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 10px 2px" }}>The page</p>
          <div style={{ maxWidth: 760 }}>
            <header style={{ marginBottom: 22 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 780, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>What&rsquo;s new</h1>
              <p style={{ margin: "6px 0 0", fontSize: 14.5, lineHeight: 1.5, color: "var(--agent-text-muted)", maxWidth: "56ch" }}>
                The latest features, improvements and changes across the platform.
              </p>
            </header>
            <WhatsNewFeed updates={UPDATES} />
          </div>
        </div>
      </div>
    </div>
  );
}
