"use client";

// Renders the eight faint white-outline ripples that sit on top of the
// mesh-shift gradient on every .claim-page. Hard-coded positions/delays
// so SSR + client render identically (no hydration mismatch, no useEffect).

const RIPPLES: { left: number; top: number; delay: number }[] = [
  { left: 18, top: 22, delay: 0    },
  { left: 72, top: 14, delay: 1.2  },
  { left: 42, top: 58, delay: 2.4  },
  { left: 86, top: 78, delay: 3.6  },
  { left: 25, top: 88, delay: 0.7  },
  { left: 58, top: 38, delay: 1.9  },
  { left: 10, top: 52, delay: 3.1  },
  { left: 92, top: 48, delay: 4.3  },
];

export function ClaimBackground() {
  return (
    <>
      {RIPPLES.map((r, i) => (
        <span
          key={i}
          className="claim-ripple"
          aria-hidden="true"
          style={{
            left: `${r.left}%`,
            top: `${r.top}%`,
            animationDelay: `${r.delay}s`,
          }}
        />
      ))}
    </>
  );
}
