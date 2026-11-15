"use client";

// StatCards — the shared "summary bar" primitive. Replaces the five hand-rolled
// stat strips (All Files, Enquiries, Completions, Chains, Clients) that each
// re-implemented the same icon-circle + value + label + sub tile. One fixed
// grid of individual glass cards: 4-up on desktop, 2-up on tablet/phone, single
// column only below any real phone width. Each card can be static, a link, or a
// filter-toggle button; selected/attention state is a coral ring (no colour
// wash — see feedback). The icon circle reuses the shipped `stat-circle` class.

import Link from "next/link";
import type { ReactNode } from "react";
import { CaretRight } from "@/components/icons/ph";

export type StatTone = "coral" | "info" | "warning" | "danger" | "success" | "neutral";

export type StatCardSpec = {
  key: string;
  // Pre-rendered icon, e.g. <HouseLine size={22} weight="regular" />. Passed as a
  // node (not a component) so Server Component callers (e.g. Completions) can feed
  // it across the client boundary, matching how every original tile passed icons.
  icon: ReactNode;
  tone: StatTone;
  value: ReactNode; // pre-formatted by the caller (number, "£8k", "72%", "—")
  label: ReactNode;
  sub?: ReactNode; // optional small sub-line; accepts rich content (e.g. split spans)
  href?: string; // renders the card as a Link
  onClick?: () => void; // renders the card as a button
  active?: boolean; // selected (e.g. a filter toggle that is on)
  highlight?: boolean; // persistent attention ring (same look as active)
  caret?: boolean; // show a trailing caret — use for cards that navigate
  ariaLabel?: string; // accessible label for link/button cards
};

export function StatCards({ cards, ariaLabel }: { cards: StatCardSpec[]; ariaLabel?: string }) {
  return (
    <div className="statcards" role="group" aria-label={ariaLabel}>
      {cards.map((c) => {
        const on = c.active || c.highlight;
        const interactive = Boolean(c.href || c.onClick);
        const cls = `statcard${interactive ? " statcard--i" : ""}${on ? " on" : ""}`;
        const inner = (
          <>
            <span className={`stat-circle stat-circle--${c.tone}`} aria-hidden>
              {c.icon}
            </span>
            <span className="statcard-txt">
              <span className="statcard-val">{c.value}</span>
              <span className="statcard-label">{c.label}</span>
              {c.sub != null && <span className="statcard-sub">{c.sub}</span>}
            </span>
            {c.caret && <CaretRight size={15} weight="bold" className="statcard-caret" aria-hidden />}
          </>
        );

        if (c.href) {
          return (
            <Link key={c.key} href={c.href} className={cls} aria-label={c.ariaLabel}>
              {inner}
            </Link>
          );
        }
        if (c.onClick) {
          return (
            <button key={c.key} type="button" className={cls} onClick={c.onClick} aria-label={c.ariaLabel} aria-pressed={c.active}>
              {inner}
            </button>
          );
        }
        return (
          <div key={c.key} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
