"use client";

import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#F8F9FB", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-sm w-full text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(255,107,74,0.10)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="text-[20px] font-bold mb-2" style={{ color: "#1A1D29" }}>
          Something went wrong
        </h1>
        <p className="text-[14px] leading-relaxed mb-6" style={{ color: "#4A5162" }}>
          We couldn&apos;t load this page. Please try again — if the problem continues, contact your sales progressor.
        </p>
        <button
          onClick={reset}
          className="w-full py-4 rounded-2xl text-[15px] font-bold text-white"
          style={{ background: "#FF6B4A" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
