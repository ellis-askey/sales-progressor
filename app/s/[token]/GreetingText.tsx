"use client";

import { useEffect, useState } from "react";

// Per-letter typewriter reveal for the top-bar greeting, cloned from the client
// portal's GreetingText so the solicitor portal opens with the same beat. Each
// char fades + rises with a small stagger, after a 320ms pause so the cards
// land first. Respects reduced motion.
export function GreetingText({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.getAttribute("data-portal-motion") === "reduced";
    const t = setTimeout(() => setRevealed(true), reduced ? 0 : 320);
    return () => clearTimeout(t);
  }, []);

  const reduced =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.getAttribute("data-portal-motion") === "reduced");

  return (
    <span aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(0.24em)",
            transition: reduced ? "none" : "opacity 560ms cubic-bezier(0.22,1,0.36,1), transform 560ms cubic-bezier(0.22,1,0.36,1)",
            transitionDelay: reduced ? "0ms" : `${i * 40}ms`,
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
