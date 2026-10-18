"use client";

// Shared property thumbnail. When the file has a photo: while it loads we show a
// soft neutral gradient tile (Apple-style) — NOT the coral house — then fade the
// photo in once it's ready, so the placeholder no longer flashes on files that DO
// have a photo (critique #284). The coral line-art house shows only when there is
// genuinely no photo, or if a photo truly fails to load after retries (so we never
// leave a blank box). Photos are signed upstream via getSignedUrlMap and passed in
// as photoUrl. Placeholder art + its light/dark switch live in
// .property-photo-fallback; the loading gradient in .property-thumb-loading (globals.css).
//
// Resilience (2026-09-25): a failed load retries a few times with backoff, and a
// regained connection retries again, so a transient network miss heals itself.

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
  const [loaded, setLoaded] = useState(false);
  const [givenUp, setGivenUp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // New photo (or a freshly-signed URL) → start the load/retry over.
  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setGivenUp(false);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [photoUrl]);

  // A cached image can finish loading before React attaches onLoad — catch that
  // so a cached photo shows instantly (opacity 1) instead of staying hidden.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
  }, [attempt, photoUrl]);

  // Connection came back → give a given-up image a fresh set of tries. The key
  // change on <img> remounts it, forcing the browser to re-request the bytes.
  useEffect(() => {
    if (!photoUrl || typeof window === "undefined") return;
    const onOnline = () => { setGivenUp(false); setLoaded(false); setAttempt(0); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [photoUrl]);

  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
  };

  // No photo, or a photo that truly failed after retries → coral house (never blank).
  if (!photoUrl || givenUp) {
    return <span aria-hidden className="property-photo-fallback property-thumb" style={{ ...box, display: "inline-block" }} />;
  }

  function handleError() {
    setLoaded(false);
    if (attempt >= MAX_RETRIES) { setGivenUp(true); return; } // show the house instead of a blank
    const delay = 400 * 2 ** attempt; // 400ms, 800ms, 1600ms
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAttempt((a) => a + 1), delay);
  }

  // A real photo exists: soft neutral gradient tile while it loads, photo fades in.
  return (
    <span
      aria-hidden
      className="property-thumb property-thumb-loading"
      style={{ ...box, position: "relative", display: "inline-block", overflow: "hidden" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        key={attempt}
        src={photoUrl}
        alt=""
        aria-hidden
        onLoad={() => setLoaded(true)}
        onError={handleError}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: radius,
          opacity: loaded ? 1 : 0,
          transition: "opacity 260ms ease",
        }}
      />
    </span>
  );
}
