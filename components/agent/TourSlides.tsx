"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";

const SLIDES = [
  {
    title: "Your pipeline, at a glance",
    description: "Every sale in one place — filter by status, see what's active, on hold, or completed at a glance.",
    Visual: PipelineVisual,
  },
  {
    title: "A file that runs itself",
    description: "Each sale has a milestone tracker. Your progressor updates it as things happen — you always know exactly where things stand.",
    Visual: FileVisual,
  },
  {
    title: "Clients stay in the loop",
    description: "Every client gets a personal portal link. They track progress online — fewer calls, happier buyers and sellers.",
    Visual: PortalVisual,
  },
  {
    title: "Nothing slips through",
    description: "The Work Queue flags files that need attention before they become problems. Your progressor is watching too.",
    Visual: WorkQueueVisual,
  },
];

export function TourSlides({ onClose, onFinish }: { onClose: () => void; onFinish: () => void }) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide]!;
  const isLast = slide === SLIDES.length - 1;
  const isFirst = slide === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-coral-deep)", opacity: 0.7 }}>
          Quick tour
        </p>
        <button
          onClick={onClose}
          aria-label="Close tour"
          style={{
            width: 28, height: 28, borderRadius: 8,
            border: "none", background: "rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--agent-text-muted)",
          }}
          className="hover:bg-black/10"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      {/* Visual */}
      <div style={{
        borderRadius: "var(--agent-radius-lg)",
        overflow: "hidden",
        marginBottom: 24,
        background: "rgba(255,255,255,0.40)",
        border: "0.5px solid rgba(255,255,255,0.60)",
      }}>
        <current.Visual />
      </div>

      {/* Text */}
      <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
        {current.title}
      </h2>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
        {current.description}
      </p>

      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Back */}
        <button
          onClick={() => setSlide(s => s - 1)}
          disabled={isFirst}
          style={{
            padding: "8px 16px", borderRadius: "var(--agent-radius-lg)",
            border: "1.5px solid var(--agent-border-default)",
            background: "none", fontSize: 13, fontWeight: 600,
            color: "var(--agent-text-secondary)", cursor: isFirst ? "default" : "pointer",
            opacity: isFirst ? 0 : 1, transition: "opacity 150ms",
          }}
        >
          ← Back
        </button>

        {/* Dots */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: i === slide ? 20 : 6,
                height: 6,
                borderRadius: 99,
                border: "none",
                background: i === slide ? "var(--agent-coral-deep)" : "rgba(0,0,0,0.15)",
                cursor: "pointer",
                padding: 0,
                transition: "width 200ms ease, background 150ms",
              }}
            />
          ))}
        </div>

        {/* Next / Get started */}
        <button
          onClick={isLast ? onFinish : () => setSlide(s => s + 1)}
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ minWidth: 110, justifyContent: "center" }}
        >
          {isLast ? "Get started →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

// ─── Slide visuals ────────────────────────────────────────────────────────────

function PipelineVisual() {
  const rows = [
    { dot: "#1F8A4A", status: "Active",  address: "14 Birchwood Ave, Knutsford", price: "£425,000" },
    { dot: "#C97D1A", status: "On Hold", address: "7 The Maltings, Chester",      price: "£310,000" },
    { dot: "#1F8A4A", status: "Active",  address: "22 Park Lane, Wilmslow",       price: "£550,000" },
  ];
  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: r.dot, width: 46, flexShrink: 0 }}>{r.status}</span>
          <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.address}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0 }}>{r.price}</span>
        </div>
      ))}
    </div>
  );
}

function FileVisual() {
  const milestones = [
    { label: "Memorandum of sale issued",      done: true  },
    { label: "Vendor solicitor instructed",     done: true  },
    { label: "Draft contract received",         done: false },
    { label: "Searches applied for",            done: false },
  ];
  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {milestones.map((m, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {m.done ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="8" fill="#1F8A4A" fillOpacity="0.15"/>
              <path d="M5 8.5l2 2 4-4" stroke="#1F8A4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7.25" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5"/>
            </svg>
          )}
          <span style={{
            fontSize: 12,
            color: m.done ? "var(--agent-text-muted)" : "var(--agent-text-secondary)",
            textDecoration: m.done ? "line-through" : "none",
          }}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PortalVisual() {
  return (
    <div style={{
      padding: "20px",
      background: "linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)",
    }}>
      <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.70)" }}>
        Your sale portal
      </p>
      <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#fff" }}>
        14 Birchwood Ave, Knutsford
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
          <div style={{ width: "50%", height: "100%", borderRadius: 99, background: "#fff" }} />
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600, flexShrink: 0 }}>6 of 12</span>
      </div>
    </div>
  );
}

function WorkQueueVisual() {
  const alerts = [
    { color: "#C97D1A", bg: "rgba(201,125,26,0.10)", label: "Missing purchaser solicitor", sub: "7 The Maltings, Chester" },
    { color: "#C97D1A", bg: "rgba(201,125,26,0.10)", label: "Exchange date overdue",        sub: "22 Park Lane, Wilmslow" },
  ];
  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 12px", borderRadius: "var(--agent-radius-md)",
          background: a.bg, border: `1px solid rgba(201,125,26,0.25)`,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M7 1L13 12H1L7 1Z" fill={a.color} fillOpacity="0.2" stroke={a.color} strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M7 5.5V7.5M7 9.5V10" stroke={a.color} strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: a.color }}>{a.label}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{a.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
