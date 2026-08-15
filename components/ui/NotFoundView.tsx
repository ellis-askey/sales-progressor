"use client";

// Shared, on-brand 404 view. Used by both the app-wide not-found and the portal
// not-found — same animation + design; only the message and (optional) button
// change with context. The Lottie player is loaded client-side only (it touches
// window/document on mount), with a fixed-size box so the layout never jumps.

import Link from "next/link";
import dynamic from "next/dynamic";

const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((m) => m.Player),
  { ssr: false, loading: () => <div style={{ width: 320, height: 320 }} aria-hidden /> },
);

export function NotFoundView({
  title,
  message,
  cta,
}: {
  title: string;
  message: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #F3F6FC 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Sales Progressor" style={{ height: 26, marginBottom: 8, opacity: 0.9 }} />

      <div style={{ width: 320, height: 320, maxWidth: "80vw", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Player src="/animations/404.json" autoplay loop style={{ width: "100%", height: "100%" }} />
      </div>

      <h1 className="text-[24px] font-bold" style={{ color: "#1A1D29", marginTop: -8, letterSpacing: "-0.01em" }}>
        {title}
      </h1>
      <p className="text-[14px] leading-relaxed" style={{ color: "#4A5162", maxWidth: 380, marginTop: 8 }}>
        {message}
      </p>

      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-2 mt-7 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #FF8A65, #FF6B4A)", boxShadow: "0 6px 18px -6px rgba(255,107,74,0.5)" }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
