"use client";

// Overview restyle 2026-07-03 — small sidebar card with a stack of
// icon-and-label link rows. Mock uses this for: Open in client portal /
// View file documents / Send secure message.
//
// Links can be href strings (Link) OR onClick handlers (button). Right-side
// arrow icon is shown for hrefs; onClicks get no arrow so the affordance
// stays "opens something in place" (drawer / modal / picker).

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type QuickLinkItem = {
  key: string;
  label: string;
  Icon: Icon;
} & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

export type QuickLinksCardProps = {
  title?: string;
  links: QuickLinkItem[];
};

export function QuickLinksCard({ title = "Quick links", links }: QuickLinksCardProps) {
  if (links.length === 0) return null;
  return (
    <div className="agent-glass" style={{ padding: "16px 18px" }}>
      <p className="agent-eyebrow" style={{ marginBottom: 10 }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {links.map((link) => (
          <QuickLinkRow key={link.key} link={link} />
        ))}
      </div>
    </div>
  );
}

function QuickLinkRow({ link }: { link: QuickLinkItem }) {
  const Icon = link.Icon;
  const inner: ReactNode = (
    <>
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
      }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "rgba(15,23,42,0.05)",
          color: "var(--agent-text-secondary)",
          flexShrink: 0,
        }}>
          <Icon size={14} weight="regular" />
        </span>
        <span style={{
          fontSize: 13,
          color: "var(--agent-text-primary)",
          fontWeight: 500,
        }}>{link.label}</span>
      </span>
      {"href" in link && link.href && (
        <ArrowUpRight
          size={14}
          weight="regular"
          style={{ color: "var(--agent-text-muted)", flexShrink: 0 }}
        />
      )}
    </>
  );

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 8px 8px 4px",
    borderRadius: 8,
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    transition: "background 140ms ease",
    background: "transparent",
    border: "none",
    fontFamily: "inherit",
    width: "100%",
    textAlign: "left",
  };

  if ("href" in link && link.href) {
    return (
      <Link href={link.href} style={rowStyle} className="hover:bg-black/[0.03]">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={link.onClick} style={rowStyle} className="hover:bg-black/[0.03]">
      {inner}
    </button>
  );
}
