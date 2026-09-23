"use client";

// Hub "Wins this month" card — rotating linked pairs (Ellis, 2026-09-18).
//
// Each rotation is a story: the spotlight (kicker + big number) and the
// footnote line under the divider change TOGETHER as headline + supporting
// detail. One 6s timer, crossfade, clickable dots, pause on hover; reduced
// motion gets the first slide static with the dots as manual tabs.
//
// The 4-tier cascade is unchanged — slides only exist when their number does,
// so a quiet month simply rotates through fewer stories:
//   Tier 1 (exchanges)   — exchanges (+£ exchanged), fastest, biggest,
//                          momentum, completions
//   Tier 2 (completions) — completions, momentum, new files
//   Tier 3 (progress)    — momentum, new files
//   Tier 4 (fresh)       — static motivational fallback (no rotation)
//
// The card deliberately does NOT repeat Pipeline Health facts (£ closing this
// month, exchanging soon, +N files) — no same-screen duplication.
//
// Data shape from lib/services/hub.ts getHubWins(). Presentation only.

import { useEffect, useRef, useState } from "react";
import { Trophy, Flag, Sparkle, Rocket } from "@phosphor-icons/react";
import { fmtCurrencyPence } from "@/lib/utils";
import type { HubWins } from "@/lib/services/hub";

type Tier = "exchanges" | "completions" | "progress" | "fresh";

function pickTier(wins: HubWins): Tier {
  if (wins.exchangesThisMonth > 0) return "exchanges";
  if (wins.completionsThisMonth > 0) return "completions";
  if (wins.stepsConfirmedThisWeek > 0 || wins.newFilesThisMonth > 0) return "progress";
  return "fresh";
}

function trendCopy(current: number, prior: number): { text: string; tone: "up" | "flat" | "down" } | null {
  if (prior === 0 && current > 0) return { text: "New this month", tone: "up" };
  const delta = current - prior;
  if (delta > 0) return { text: `↑ ${delta} vs last month`, tone: "up" };
  if (delta < 0) return { text: `↓ ${Math.abs(delta)} vs last month`, tone: "down" };
  return { text: "Same as last month", tone: "flat" };
}

const toneColor: Record<"up" | "flat" | "down", string> = {
  up: "var(--agent-success)",
  flat: "var(--agent-text-muted)",
  down: "var(--agent-warning)",
};

// One rotation story: spotlight (kicker/big/label/trend) + linked footnote.
type Slide = {
  key: string;
  kicker: string;
  big: string;
  bigColor?: string;
  label: string;
  trend?: { text: string; tone: "up" | "flat" | "down" } | null;
  // Footnote pair: left text, optional bold right value. Right inherits the
  // spotlight accent when footRight is money/days so the link reads.
  footLeft: string;
  footRight?: string;
};

function buildSlides(wins: HubWins, tier: Tier): Slide[] {
  const slides: Slide[] = [];
  const momentumSlide: Slide | null = wins.stepsConfirmedThisWeek > 0
    ? {
        key: "momentum",
        kicker: "Momentum",
        big: String(wins.stepsConfirmedThisWeek),
        label: wins.stepsConfirmedThisWeek === 1 ? "step confirmed this week" : "steps confirmed this week",
        footLeft: wins.stepsFilesThisWeek > 1 ? `Across ${wins.stepsFilesThisWeek} files` : "Keep them moving",
      }
    : null;
  const newFilesSlide: Slide | null = wins.newFilesThisMonth > 0
    ? {
        key: "newfiles",
        kicker: "New business",
        big: String(wins.newFilesThisMonth),
        label: wins.newFilesThisMonth === 1 ? "new file this month" : "new files this month",
        footLeft: "Fresh instructions in the pipeline",
      }
    : null;

  if (tier === "exchanges") {
    slides.push({
      key: "exchanges",
      kicker: "Exchanges",
      big: String(wins.exchangesThisMonth),
      label: wins.exchangesThisMonth === 1 ? "exchange completed" : "exchanges completed",
      trend: trendCopy(wins.exchangesThisMonth, wins.exchangesLastMonth),
      footLeft: wins.valueExchangedPence > 0 ? "Agreed sales exchanged" : "Contracts exchanged this month",
      footRight: wins.valueExchangedPence > 0 ? fmtCurrencyPence(wins.valueExchangedPence) : undefined,
    });
    if (wins.fastestExchangeDays !== null && wins.fastestExchangeAddress) {
      slides.push({
        key: "fastest",
        kicker: "Fastest exchange",
        big: `${wins.fastestExchangeDays}d`,
        bigColor: "var(--agent-coral-deep)",
        label: "offer to exchange",
        footLeft: wins.fastestExchangeAddress,
      });
    }
    // Biggest only earns a slide when there's more than one exchange —
    // with one, it IS the exchanges slide's value.
    if (wins.exchangesThisMonth > 1 && wins.biggestExchangePence !== null && wins.biggestExchangeAddress) {
      slides.push({
        key: "biggest",
        kicker: "Biggest exchange",
        big: fmtCurrencyPence(wins.biggestExchangePence),
        label: "agreed sale exchanged",
        footLeft: wins.biggestExchangeAddress,
      });
    }
    if (momentumSlide) slides.push(momentumSlide);
    if (wins.completionsThisMonth > 0) {
      slides.push({
        key: "completions",
        kicker: "Completions",
        big: String(wins.completionsThisMonth),
        label: wins.completionsThisMonth === 1 ? "completion this month" : "completions this month",
        footLeft: "Keys handed over",
      });
    }
    return slides;
  }

  if (tier === "completions") {
    slides.push({
      key: "completions",
      kicker: "Completions",
      big: String(wins.completionsThisMonth),
      label: wins.completionsThisMonth === 1 ? "completion" : "completions",
      trend: trendCopy(wins.completionsThisMonth, wins.completionsLastMonth),
      footLeft: "Keys handed over this month",
    });
    if (momentumSlide) slides.push(momentumSlide);
    if (newFilesSlide) slides.push(newFilesSlide);
    return slides;
  }

  // Tier 3 — progress only.
  if (momentumSlide) slides.push(momentumSlide);
  if (newFilesSlide) slides.push(newFilesSlide);
  return slides;
}

const TIER_META: Record<Tier, { icon: React.ReactNode; subtitle: string }> = {
  exchanges:   { icon: <Trophy size={24} weight="bold" />,  subtitle: "You're moving fast." },
  completions: { icon: <Flag size={24} weight="bold" />,    subtitle: "Files across the line." },
  progress:    { icon: <Sparkle size={24} weight="bold" />, subtitle: "Pipeline is moving." },
  fresh:       { icon: <Rocket size={24} weight="bold" />,  subtitle: "Nothing to celebrate yet." },
};

const ROTATE_MS = 6000;

export function WinsCard({ wins }: { wins: HubWins }) {
  const tier = pickTier(wins);
  const slides = buildSlides(wins, tier);
  const [idx, setIdx] = useState(0);
  const pausedRef = useRef(false);
  const [reduced, setReduced] = useState(false);

  // Swipe between stories on touch (critique, 2026-09-23): a horizontal swipe
  // of 40px+ moves next/previous, wrapping, and holds the auto-rotation for a
  // beat so the timer doesn't immediately fight the reader's choice.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || slides.length < 2) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return; // not a horizontal swipe
    setIdx((i) => (i + (dx < 0 ? 1 : -1) + slides.length) % slides.length);
    pausedRef.current = true;
    setTimeout(() => { pausedRef.current = false; }, ROTATE_MS);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches || slides.length < 2) return;
    const t = setInterval(() => {
      if (!pausedRef.current) setIdx((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const meta = TIER_META[tier];

  const header = (
    <div className="agent-card-hdr-internal" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Bare bold icon, no faded backer — matches the other hub card headers. */}
      <span aria-hidden style={{ color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", flexShrink: 0 }}>
        {meta.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Wins this month</p>
        <p className="agent-card-subtitle" style={{ margin: 0 }}>{meta.subtitle}</p>
      </div>
    </div>
  );

  // Tier 4 — brand-new account, static.
  if (tier === "fresh" || slides.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 200 }}>
        {header}
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
          Add your first sale to start tracking wins. Exchanges, completions, and fastest-exchange records will show up here as files progress.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 200, touchAction: "pan-y" }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {header}

      {/* Spotlight — slides stacked, crossfading. Fixed height so the card
          never shifts as stories change. */}
      <div style={{ position: "relative", minHeight: 88, flex: 1 }}>
        {slides.map((s, i) => (
          <div
            key={s.key}
            aria-hidden={i !== idx}
            style={{
              position: "absolute", inset: 0,
              opacity: i === idx ? 1 : 0,
              transition: reduced ? "none" : "opacity 500ms ease",
              pointerEvents: i === idx ? "auto" : "none",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--agent-coral-deep)" }}>
              {s.kicker}
            </p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: s.bigColor ?? "var(--agent-text-primary)", lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              {s.big}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", fontWeight: 500 }}>
              {s.label}
            </p>
            {s.trend && (
              <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: toneColor[s.trend.tone] }}>
                {s.trend.text}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Linked footnote — changes with the spotlight. */}
      <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 12 }}>
        <div style={{ position: "relative", minHeight: 18 }}>
          {slides.map((s, i) => (
            <div
              key={s.key}
              aria-hidden={i !== idx}
              style={{
                position: "absolute", inset: 0,
                display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                opacity: i === idx ? 1 : 0,
                transition: reduced ? "none" : "opacity 500ms ease",
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {s.footLeft}
              </p>
              {s.footRight && (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-coral-deep)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {s.footRight}
                </p>
              )}
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center" }}>
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Show ${s.kicker.toLowerCase()}`}
                onClick={() => setIdx(i)}
                style={{
                  width: i === idx ? 18 : 6, height: 6, borderRadius: 999,
                  background: i === idx ? "var(--agent-coral)" : "rgba(var(--agent-shadow-rgb), 0.16)",
                  border: "none", padding: 0, cursor: "pointer",
                  transition: reduced ? "none" : "width 250ms ease, background 250ms ease",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
