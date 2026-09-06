"use client";

// Types a string in on mount, one character at a time (a light typewriter).
// The server passes the already-resolved value, so this only renders once the
// real text is known — no placeholder/flash. The full string is exposed via
// aria-label for screen readers, and prefers-reduced-motion shows it at once.
//
// Emoji-safe: splits by code point (Array.from) so a surrogate pair like 👋
// is revealed as one unit, never half a character.

import { useState, useEffect, useRef } from "react";

export function TypedText({
  text,
  speed = 32,
  startDelay = 0,
  showCaret = true,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
  showCaret?: boolean;
}) {
  const chars = useRef<string[]>(Array.from(text));
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    chars.current = Array.from(text);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(chars.current.length);
      setDone(true);
      return;
    }

    setShown(0);
    setDone(false);
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startT = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= chars.current.length) {
          if (interval) clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startT);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return (
    <span aria-label={text}>
      <span aria-hidden="true">{chars.current.slice(0, shown).join("")}</span>
      {showCaret && !done && <span aria-hidden="true" className="tsp-type-caret" />}
    </span>
  );
}
