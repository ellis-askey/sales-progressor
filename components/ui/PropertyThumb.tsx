"use client";

// Shared property thumbnail: the file's photo when it has one, the universal
// property-photo placeholder (coral line-art house, light/dark) otherwise —
// never an empty box. Sits to the LEFT of a property address. Size to the
// address block — ~44px when the address wraps to two lines, ~30px when it's a
// single line. Photos are signed upstream via getSignedUrlMap
// (lib/supabase-storage.ts) and passed in as photoUrl. The placeholder art +
// its light/dark switch live in the .property-photo-fallback class (globals.css).
//
// Resilience (2026-09-25): the photo used to be a bare <img> with no error
// handling, so a single failed load on weak signal left a permanent blank that
// never recovered (no refresh button on a home-screen PWA). Now the placeholder
// always sits BEHIND the photo (never a blank box), a failed load retries a few
// times with backoff, and a regained connection retries again — so a transient
// network miss heals itself instead of staying empty.

import { useEffect, useRef, useState } from "react";

const MAX_RETRIES = 3;

export function PropertyThumb({
  photoUrl,
  size = 44,
}: {
  photoUrl?: string | null;
  size?: number;
}) {
  const radius = Math.max(6, Math.round(size * 0.22));
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New photo (or a freshly-signed URL) → start its retry budget over.
  useEffect(() => {
    setAttempt(0);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [photoUrl]);

  // Connection came back → give a given-up image a fresh set of tries. The key
  // change on <img> remounts it, forcing the browser to re-request the bytes.
  useEffect(() => {
    if (!photoUrl || typeof window === "undefined") return;
    const onOnline = () => setAttempt(0);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [photoUrl]);

  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
  };

  // No photo → placeholder only (unchanged behaviour).
  if (!photoUrl) {
    return <span aria-hidden className="property-photo-fallback property-thumb" style={{ ...box, display: "inline-block" }} />;
  }

  function handleError() {
    if (attempt >= MAX_RETRIES) return; // give up quietly; the placeholder shows through
    const delay = 400 * 2 ** attempt; // 400ms, 800ms, 1600ms
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAttempt((a) => a + 1), delay);
  }

  // Placeholder sits behind; the photo covers it once (and if) it loads, so a
  // slow or failed load shows the house art rather than an empty square.
  return (
    <span
      aria-hidden
      className="property-photo-fallback property-thumb"
      style={{ ...box, position: "relative", display: "inline-block", overflow: "hidden" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={photoUrl}
        alt=""
        aria-hidden
        onError={handleError}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: radius,
        }}
      />
    </span>
  );
}
