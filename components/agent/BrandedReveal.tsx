"use client";

// Content reveal for the Analytics page: the branded loader fades out while the
// real content blurs up beneath it — a genuine crossfade, not a snap. It works
// because the overlay loader is visually identical to the route fallback
// (app/agent/analytics/loading.tsx) and sits in the same spot, so when Suspense
// swaps the fallback for the content, the loader appears to keep going and then
// dissolve as the page comes into focus. The overlay is removed once the fade
// completes so it never blocks interaction. Pure CSS motion; reduced-motion
// drops both the loader and the overlay.
//
// Note: on a warm (cached) navigation there was no real wait, so this shows a
// brief branded flourish rather than a wait — that's the intended trade for the
// crossfade. Analytics-only for now (founder testing on prod before any
// universal rollout).

import { useEffect, useState } from "react";
import { BrandedLoader } from "./BrandedLoader";

export function BrandedReveal({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Matches the overlay fade-out duration; remove it once it's finished.
    const id = setTimeout(() => setDone(true), 500);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="brand-reveal">
      <div className="brand-blur-in">{children}</div>
      {!done && (
        <div className="brand-reveal-overlay" aria-hidden="true">
          <div className="brand-loader-hold">
            <BrandedLoader />
          </div>
        </div>
      )}
    </div>
  );
}
