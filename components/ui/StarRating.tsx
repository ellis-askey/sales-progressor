"use client";

import { useState } from "react";

// Canonical star rating. A row of pressable stars that fill up to the hovered /
// selected value. Light surface, coral accent. No text label on hover (the star
// count is self-explanatory, and a label that appears/disappears reflows the
// card). Keyboard + screen-reader friendly (a radiogroup of star buttons).

function Star({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : 1.6} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.6Z" />
    </svg>
  );
}

export function StarRating({
  value,
  onChange,
  max = 5,
  accent = "#FF6B4A",
  size = 44,
  ariaLabel = "Rating",
}: {
  /** The selected rating (1..max), or null for none. */
  value: number | null;
  onChange: (n: number) => void;
  max?: number;
  /** Fill + active-border colour. */
  accent?: string;
  /** Square tile size in px. */
  size?: number;
  ariaLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value ?? 0;

  return (
    <div style={{ display: "flex", gap: 8 }} role="radiogroup" aria-label={ariaLabel}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const on = n <= active;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(n)}
            onBlur={() => setHovered(null)}
            style={{
              width: size,
              height: size,
              padding: Math.round(size * 0.22),
              borderRadius: 12,
              background: on ? "rgba(255,107,74,0.10)" : "#fff",
              border: `1px solid ${on ? accent : "rgba(23,23,30,0.12)"}`,
              cursor: "pointer",
              transition: "background 0.12s ease, border-color 0.12s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Star filled={on} color={on ? accent : "rgba(23,23,30,0.28)"} />
          </button>
        );
      })}
    </div>
  );
}
