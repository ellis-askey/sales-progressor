"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DISMISSED_KEY = "sp_welcome_dismissed";

export function FirstSessionCard() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISSED_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function loadDemo() {
    setLoadingDemo(true);
    try {
      await fetch("/api/demo-data", { method: "POST" });
      setDemoLoaded(true);
      setTimeout(() => router.refresh(), 600);
    } finally {
      setLoadingDemo(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="glass-card overflow-hidden mb-2">
      {/* Gradient header */}
      <div
        className="px-6 py-5 relative"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.10) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.20)",
        }}
      >
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-slate-900/30 hover:text-slate-900/60 hover:bg-white/40 transition-all"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="text-base font-bold text-slate-900/90 leading-tight">Welcome to Sales Progressor</p>
        <p className="text-sm text-slate-900/50 mt-0.5">Here's how to get started</p>
      </div>

      {/* Three tiles */}
      <div className="grid grid-cols-3 divide-x divide-white/20">

        {/* Tile 1: Add first property */}
        <Link
          href="/transactions/new"
          className="flex flex-col items-center gap-3 px-5 py-6 hover:bg-white/30 transition-colors group"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.08) 100%)" }}
          >
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900/80 group-hover:text-blue-600 transition-colors">Add first property</p>
            <p className="text-xs text-slate-900/40 mt-0.5">Create your first file</p>
          </div>
        </Link>

        {/* Tile 2: Load sample data */}
        <button
          onClick={loadDemo}
          disabled={loadingDemo || demoLoaded}
          className="flex flex-col items-center gap-3 px-5 py-6 hover:bg-white/30 transition-colors group disabled:cursor-default"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.08) 100%)" }}
          >
            {demoLoaded ? (
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : loadingDemo ? (
              <svg className="w-5 h-5 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900/80 group-hover:text-emerald-600 transition-colors">
              {demoLoaded ? "Loaded!" : "Load sample data"}
            </p>
            <p className="text-xs text-slate-900/40 mt-0.5">Try with example files</p>
          </div>
        </button>

        {/* Tile 3: Watch tour (coming soon) */}
        <div className="flex flex-col items-center gap-3 px-5 py-6 opacity-60">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.08) 100%)" }}
          >
            <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <p className="text-sm font-semibold text-slate-900/80">Watch a tour</p>
              <span className="text-[9px] font-bold bg-slate-900/8 text-slate-900/40 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Soon</span>
            </div>
            <p className="text-xs text-slate-900/40">Video walkthrough</p>
          </div>
        </div>
      </div>
    </div>
  );
}
