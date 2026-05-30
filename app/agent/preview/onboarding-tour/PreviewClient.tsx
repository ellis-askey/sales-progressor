"use client";

// Throwaway preview: four graphic directions for the welcome modal + 4-step
// tour. Copy is identical across variants (em-dash-free, self-managed copy
// for steps 2 & 4 so it reads concretely). Only graphics + layout change.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import {
  X, Lightning, Funnel, CheckSquare, Globe, Bell,
  HandWaving, ArrowRight,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

type Variant = "A" | "B" | "C" | "D";

const ENTRY = {
  heading: "Welcome, Sam",
  subhead: "Let's get your first file set up. It takes less than a minute.",
  primary: "Add my first sale",
  secondary: "Take a quick tour",
  footnote: "You can add files any time from the dashboard.",
};

const STEPS = [
  {
    title: "Your pipeline, at a glance",
    description:
      "Every sale in one place. Filter by status to see what's active, on hold, or done.",
  },
  {
    title: "Always know where a sale stands",
    description:
      "Every sale has a step-by-step tracker. Tick off each step as it happens and the file stays current. No spreadsheet, no guesswork.",
  },
  {
    title: "Clients stay in the loop",
    description:
      "Every client gets their own portal link to follow progress online. Fewer chase calls, calmer buyers and sellers.",
  },
  {
    title: "Nothing slips through",
    description:
      "The Reminders tab flags any sale that needs attention before it turns into a problem.",
  },
];

const VARIANT_META: Record<Variant, { name: string; blurb: string }> = {
  A: {
    name: "A · Polished mock-UI",
    blurb:
      "Refined faux product panels. Familiar, concrete, low-risk. Closest to today's flow.",
  },
  B: {
    name: "B · Flat illustration",
    blurb:
      "Custom flat illustrations per step. Warmer, less literal. Reads like onboarding for a consumer app.",
  },
  C: {
    name: "C · Split layout",
    blurb:
      "Annotated product mock side-by-side with copy. Wider modal. Treats the tour as a guided look at the real surface.",
  },
  D: {
    name: "D · Bold iconographic",
    blurb:
      "Large branded icon on a coral gradient panel per step. Minimal, fast, brand-forward.",
  },
};

// ─── Preview page ───────────────────────────────────────────────────────────

export function PreviewClient() {
  const [variant, setVariant] = useState<Variant>("A");
  const [open, setOpen] = useState(false);

  function launch(v: Variant) {
    setVariant(v);
    setOpen(true);
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 880, margin: "0 auto" }}>
      <p style={{
        margin: 0, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--agent-coral-deep)", opacity: 0.7,
      }}>
        Preview · throwaway
      </p>
      <h1 style={{
        margin: "6px 0 8px", fontSize: 28, fontWeight: 700,
        letterSpacing: "-0.02em", color: "var(--agent-text-primary)",
      }}>
        Welcome tour · graphic direction
      </h1>
      <p style={{
        margin: "0 0 24px", fontSize: 14, lineHeight: 1.6,
        color: "var(--agent-text-secondary)", maxWidth: 640,
      }}>
        Four visual treatments of the same modal + 4-step tour. Copy is identical across all
        four so the graphic is the only variable. Pick a direction and the live modal will
        ship that treatment.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {(Object.keys(VARIANT_META) as Variant[]).map((v) => {
          const meta = VARIANT_META[v];
          const isActive = variant === v;
          return (
            <button
              key={v}
              onClick={() => launch(v)}
              className="agent-glass-strong"
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "16px 20px",
                borderRadius: "var(--agent-radius-lg)",
                border: isActive
                  ? "1.5px solid var(--agent-coral-deep)"
                  : "0.5px solid var(--agent-border-default)",
                background: "var(--agent-surface-elevated)",
                cursor: "pointer", textAlign: "left",
                transition: "border-color 150ms, transform 120ms",
                width: "100%",
              }}
            >
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: "rgba(var(--agent-coral-rgb), 0.10)",
                color: "var(--agent-coral-deep)",
                fontSize: 16, fontWeight: 700,
              }}>
                {v}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{
                  display: "block", fontSize: 14, fontWeight: 700,
                  color: "var(--agent-text-primary)", marginBottom: 2,
                }}>
                  {meta.name}
                </span>
                <span style={{
                  display: "block", fontSize: 13, lineHeight: 1.5,
                  color: "var(--agent-text-secondary)",
                }}>
                  {meta.blurb}
                </span>
              </span>
              <ArrowRight size={16} weight="bold" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: 0 }}>
        Click a card to open that variant's full flow: entry modal → 4 tour steps. Back/Next
        work; close with X, Escape, or clicking the backdrop.
      </p>

      {open && (
        <PreviewModal variant={variant} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

// ─── Modal frame ─────────────────────────────────────────────────────────────

function PreviewModal({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const { theme, isNight } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const isSplit = variant === "C" && showTour;
  const maxWidth = !showTour ? 460 : isSplit ? 720 : 540;

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div className="fixed inset-0 agent-backdrop-overlay" />
      <div
        className="agent-modal"
        style={{
          maxWidth, width: "calc(100vw - 48px)",
          position: "relative", padding: 0, overflow: "hidden",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!showTour ? (
          <EntryStage
            variant={variant}
            onPrimary={onClose}
            onSecondary={() => setShowTour(true)}
            onClose={onClose}
          />
        ) : (
          <TourStage
            variant={variant}
            slide={slide}
            onPrev={() => setSlide((s) => Math.max(0, s - 1))}
            onNext={() => setSlide((s) => s + 1)}
            onFinish={onClose}
            onClose={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Entry stage (per-variant) ───────────────────────────────────────────────

function EntryStage({
  variant, onPrimary, onSecondary, onClose,
}: {
  variant: Variant;
  onPrimary: () => void;
  onSecondary: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <EntryHero variant={variant} />
      <div style={{
        display: "flex", alignItems: "center",
        height: 48, padding: "0 20px",
        borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12,
        position: "relative",
      }}>
        <p style={{
          flex: 1, margin: 0, fontSize: 14, fontWeight: 600,
          color: "var(--agent-text-primary)",
        }}>
          {ENTRY.heading}
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="agent-icon-btn agent-icon-btn-sm"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{
          margin: 0, fontSize: 14, lineHeight: 1.6,
          color: "var(--agent-text-secondary)",
        }}>
          {ENTRY.subhead}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={onPrimary}
            className="agent-btn agent-btn-color-primary"
            style={{
              width: "100%", justifyContent: "center",
              padding: "14px 20px", fontSize: 15, fontWeight: 700,
            }}
          >
            <Lightning size={18} weight="fill" />
            {ENTRY.primary}
          </button>
          <button
            onClick={onSecondary}
            style={{
              background: "none", border: "none", cursor: "pointer",
              textAlign: "center", padding: "2px 0",
            }}
            className="text-sm text-slate-900/60 hover:text-slate-900/85 hover:underline transition-colors"
          >
            {ENTRY.secondary}
          </button>
          <p style={{
            textAlign: "center", fontSize: 12,
            color: "var(--agent-text-muted)", margin: "4px 0 0",
          }}>
            {ENTRY.footnote}
          </p>
        </div>
      </div>
    </>
  );
}

function EntryHero({ variant }: { variant: Variant }) {
  if (variant === "A") {
    return (
      <div style={{
        padding: "20px 20px 16px",
        background: "linear-gradient(180deg, rgba(255,107,74,0.08) 0%, transparent 100%)",
        borderBottom: "0.5px solid rgba(0,0,0,0.04)",
      }}>
        <MiniPipelinePreview />
      </div>
    );
  }
  if (variant === "B") {
    return (
      <div style={{
        padding: "24px 20px 16px",
        background: "rgba(255,107,74,0.05)",
        borderBottom: "0.5px solid rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <FlatHandWaveIllustration />
      </div>
    );
  }
  if (variant === "C") {
    return (
      <div style={{
        padding: "20px 20px 16px",
        background: "rgba(255,107,74,0.06)",
        borderBottom: "0.5px solid rgba(0,0,0,0.04)",
      }}>
        <AnnotatedMiniPreview />
      </div>
    );
  }
  return (
    <div style={{
      padding: "28px 20px 22px",
      background: "linear-gradient(135deg, #FF6B4A 0%, #FF8A65 60%, #FFB74D 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: "rgba(255,255,255,0.22)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}>
        <HandWaving size={32} weight="fill" color="#fff" />
      </div>
    </div>
  );
}

// ─── Tour stage (per-variant) ────────────────────────────────────────────────

function TourStage({
  variant, slide, onPrev, onNext, onFinish, onClose,
}: {
  variant: Variant;
  slide: number;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const step = STEPS[slide]!;
  const isFirst = slide === 0;
  const isLast = slide === STEPS.length - 1;
  const split = variant === "C";

  return (
    <div style={{ padding: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--agent-coral-deep)", opacity: 0.7,
        }}>
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

      {split ? (
        <div style={{
          display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 24, alignItems: "center", marginBottom: 24,
        }}>
          <div style={{
            borderRadius: "var(--agent-radius-lg)", overflow: "hidden",
            background: "rgba(255,255,255,0.55)",
            border: "0.5px solid rgba(255,255,255,0.70)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          }}>
            <StepVisual variant={variant} slide={slide} />
          </div>
          <div>
            <h2 style={{
              margin: "0 0 8px", fontSize: 20, fontWeight: 700,
              letterSpacing: "-0.02em", lineHeight: 1.25,
              color: "var(--agent-text-primary)",
            }}>
              {step.title}
            </h2>
            <p style={{
              margin: 0, fontSize: 14, lineHeight: 1.6,
              color: "var(--agent-text-secondary)",
            }}>
              {step.description}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div style={{
            borderRadius: "var(--agent-radius-lg)", overflow: "hidden",
            marginBottom: 24,
            background: "rgba(255,255,255,0.40)",
            border: "0.5px solid rgba(255,255,255,0.60)",
          }}>
            <StepVisual variant={variant} slide={slide} />
          </div>
          <h2 style={{
            margin: "0 0 8px", fontSize: 20, fontWeight: 700,
            letterSpacing: "-0.02em", lineHeight: 1.25,
            color: "var(--agent-text-primary)",
          }}>
            {step.title}
          </h2>
          <p style={{
            margin: "0 0 28px", fontSize: 14, lineHeight: 1.6,
            color: "var(--agent-text-secondary)",
          }}>
            {step.description}
          </p>
        </>
      )}

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: split ? 8 : 0,
      }}>
        <button
          onClick={onPrev}
          disabled={isFirst}
          style={{
            padding: "8px 16px", borderRadius: "var(--agent-radius-lg)",
            border: "1.5px solid var(--agent-border-default)",
            background: "none", fontSize: 13, fontWeight: 600,
            color: "var(--agent-text-secondary)",
            cursor: isFirst ? "default" : "pointer",
            opacity: isFirst ? 0 : 1, transition: "opacity 150ms",
          }}
        >
          ← Back
        </button>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                width: i === slide ? 20 : 6, height: 6, borderRadius: 99,
                background: i === slide ? "var(--agent-coral-deep)" : "rgba(0,0,0,0.15)",
                transition: "width 200ms ease, background 150ms",
              }}
            />
          ))}
        </div>
        <button
          onClick={isLast ? onFinish : onNext}
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ minWidth: 110, justifyContent: "center" }}
        >
          {isLast ? "Get started →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

function StepVisual({ variant, slide }: { variant: Variant; slide: number }) {
  if (variant === "A") return [<PipelineMockA />, <FileMockA />, <PortalMockA />, <AlertMockA />][slide];
  if (variant === "B") return [<PipelineFlatB />, <FileFlatB />, <PortalFlatB />, <AlertFlatB />][slide];
  if (variant === "C") return [<PipelineAnnotatedC />, <FileAnnotatedC />, <PortalAnnotatedC />, <AlertAnnotatedC />][slide];
  return [<PipelineIconD />, <FileIconD />, <PortalIconD />, <AlertIconD />][slide];
}

// ─── A · Polished mock-UI ────────────────────────────────────────────────────

function MiniPipelinePreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[
        { dot: "#1F8A4A", addr: "14 Birchwood Ave", price: "£425k" },
        { dot: "#C97D1A", addr: "7 The Maltings", price: "£310k" },
      ].map((r, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.55)",
          border: "0.5px solid rgba(0,0,0,0.05)",
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: r.dot, flexShrink: 0 }} />
          <span style={{
            fontSize: 12, color: "var(--agent-text-secondary)",
            flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{r.addr}</span>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: "var(--agent-text-primary)", flexShrink: 0,
          }}>{r.price}</span>
        </div>
      ))}
    </div>
  );
}

function PipelineMockA() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["All", "Active", "On hold", "Done"].map((p, i) => (
          <span key={p} style={{
            fontSize: 10, fontWeight: 600,
            padding: "4px 10px", borderRadius: 99,
            background: i === 1 ? "rgba(var(--agent-coral-rgb),0.18)" : "rgba(0,0,0,0.04)",
            color: i === 1 ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
            border: i === 1 ? "0.5px solid rgba(var(--agent-coral-rgb),0.30)" : "0.5px solid transparent",
          }}>{p}</span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { dot: "#1F8A4A", status: "Active", addr: "14 Birchwood Ave, Knutsford", price: "£425,000" },
          { dot: "#C97D1A", status: "On Hold", addr: "7 The Maltings, Chester", price: "£310,000" },
          { dot: "#1F8A4A", status: "Active", addr: "22 Park Lane, Wilmslow", price: "£550,000" },
        ].map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.55)",
            border: "0.5px solid rgba(0,0,0,0.05)",
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: r.dot, width: 46, flexShrink: 0 }}>{r.status}</span>
            <span style={{
              fontSize: 12, color: "var(--agent-text-secondary)",
              flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{r.addr}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0 }}>{r.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileMockA() {
  const ms = [
    { label: "Memorandum of sale issued", done: true },
    { label: "Vendor solicitor instructed", done: true },
    { label: "Draft contract received", done: true },
    { label: "Searches applied for", done: false },
    { label: "Survey booked", done: false },
  ];
  return (
    <div style={{ padding: 16 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--agent-text-muted)",
        }}>Step progress</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "var(--agent-coral-deep)",
        }}>3 of 5</span>
      </div>
      <div style={{
        height: 4, borderRadius: 99, background: "rgba(0,0,0,0.08)",
        marginBottom: 12, overflow: "hidden",
      }}>
        <div style={{ width: "60%", height: "100%", background: "var(--agent-coral-deep)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {ms.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {m.done ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="8" fill="#1F8A4A" fillOpacity="0.18" />
                <path d="M5 8.5l2 2 4-4" stroke="#1F8A4A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7.25" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
              </svg>
            )}
            <span style={{
              fontSize: 12,
              color: m.done ? "var(--agent-text-muted)" : "var(--agent-text-secondary)",
              textDecoration: m.done ? "line-through" : "none",
            }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortalMockA() {
  return (
    <div style={{
      padding: 20,
      background: "linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)",
    }}>
      <p style={{
        margin: "0 0 2px", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.10em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.75)",
      }}>Your sale portal</p>
      <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#fff" }}>
        14 Birchwood Ave, Knutsford
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          flex: 1, height: 6, borderRadius: 99,
          background: "rgba(255,255,255,0.25)", overflow: "hidden",
        }}>
          <div style={{ width: "50%", height: "100%", borderRadius: 99, background: "#fff" }} />
        </div>
        <span style={{
          fontSize: 11, color: "rgba(255,255,255,0.85)",
          fontWeight: 600, flexShrink: 0,
        }}>6 of 12</span>
      </div>
      <div style={{
        fontSize: 11, padding: "6px 10px", borderRadius: 6,
        background: "rgba(255,255,255,0.18)",
        color: "#fff", display: "inline-block",
      }}>
        Updated 2 hours ago
      </div>
    </div>
  );
}

function AlertMockA() {
  const alerts = [
    { color: "#C97D1A", label: "Missing purchaser solicitor", sub: "7 The Maltings, Chester · 3 days" },
    { color: "#C97D1A", label: "Exchange date overdue", sub: "22 Park Lane, Wilmslow · 1 day" },
  ];
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "11px 12px", borderRadius: 10,
          background: "rgba(201,125,26,0.08)",
          border: "1px solid rgba(201,125,26,0.22)",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M7 1L13 12H1L7 1Z" fill={a.color} fillOpacity="0.20" stroke={a.color} strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M7 5.5V7.5M7 9.5V10" stroke={a.color} strokeWidth="1.2" strokeLinecap="round" />
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

// ─── B · Flat illustration ───────────────────────────────────────────────────

const CORAL = "#FF6B4A";
const CORAL_SOFT = "#FFDDD3";
const INK = "#1F2433";

function FlatPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "28px 16px", height: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(180deg, #FFF7F3 0%, #FFEFE8 100%)",
    }}>
      {children}
    </div>
  );
}

function FlatHandWaveIllustration() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none">
      <circle cx="80" cy="60" r="44" fill={CORAL_SOFT} />
      <path d="M68 50 Q80 38 92 50 L92 78 Q92 88 82 88 L78 88 Q68 88 68 78 Z"
        fill={CORAL} />
      <circle cx="78" cy="62" r="2.5" fill="#fff" />
      <circle cx="86" cy="62" r="2.5" fill="#fff" />
      <path d="M76 72 Q82 76 88 72" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M114 30 L122 22 M118 38 L130 36 M116 48 L128 52"
        stroke={CORAL} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PipelineFlatB() {
  return (
    <FlatPanel>
      <svg width="220" height="140" viewBox="0 0 220 140" fill="none">
        <rect x="20" y="30" width="180" height="22" rx="6" fill="#fff" stroke={CORAL_SOFT} strokeWidth="1.5" />
        <circle cx="34" cy="41" r="4" fill="#1F8A4A" />
        <rect x="46" y="37" width="80" height="8" rx="2" fill={INK} fillOpacity="0.12" />
        <rect x="158" y="37" width="32" height="8" rx="2" fill={INK} fillOpacity="0.22" />

        <rect x="20" y="60" width="180" height="22" rx="6" fill="#fff" stroke={CORAL_SOFT} strokeWidth="1.5" />
        <circle cx="34" cy="71" r="4" fill="#C97D1A" />
        <rect x="46" y="67" width="70" height="8" rx="2" fill={INK} fillOpacity="0.12" />
        <rect x="158" y="67" width="32" height="8" rx="2" fill={INK} fillOpacity="0.22" />

        <rect x="20" y="90" width="180" height="22" rx="6" fill="#fff" stroke={CORAL_SOFT} strokeWidth="1.5" />
        <circle cx="34" cy="101" r="4" fill="#1F8A4A" />
        <rect x="46" y="97" width="92" height="8" rx="2" fill={INK} fillOpacity="0.12" />
        <rect x="158" y="97" width="32" height="8" rx="2" fill={INK} fillOpacity="0.22" />
      </svg>
    </FlatPanel>
  );
}

function FileFlatB() {
  return (
    <FlatPanel>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none">
        <rect x="30" y="14" width="140" height="120" rx="10" fill="#fff" stroke={CORAL_SOFT} strokeWidth="1.5" />
        <rect x="44" y="28" width="60" height="8" rx="2" fill={INK} fillOpacity="0.30" />

        {[0, 1, 2, 3].map(i => {
          const y = 50 + i * 18;
          const done = i < 2;
          return (
            <g key={i}>
              {done ? (
                <>
                  <circle cx="52" cy={y} r="6" fill={CORAL} />
                  <path d={`M48 ${y} l3 3 6 -6`} stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <circle cx="52" cy={y} r="6" fill="none" stroke={INK} strokeOpacity="0.25" strokeWidth="1.4" />
              )}
              <rect x="66" y={y - 4} width={i === 0 ? 86 : i === 1 ? 72 : i === 2 ? 92 : 64}
                height="8" rx="2"
                fill={INK} fillOpacity={done ? 0.18 : 0.30} />
            </g>
          );
        })}
      </svg>
    </FlatPanel>
  );
}

function PortalFlatB() {
  return (
    <FlatPanel>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none">
        <rect x="58" y="14" width="84" height="124" rx="14" fill="#fff" stroke={CORAL_SOFT} strokeWidth="1.5" />
        <rect x="58" y="14" width="84" height="32" rx="14" fill={CORAL} />
        <path d="M58 30 H142" stroke={CORAL} strokeWidth="0" />
        <rect x="68" y="26" width="36" height="6" rx="2" fill="#fff" fillOpacity="0.85" />
        <rect x="68" y="58" width="64" height="6" rx="2" fill={INK} fillOpacity="0.20" />
        <rect x="68" y="74" width="48" height="6" rx="2" fill={INK} fillOpacity="0.20" />
        <rect x="68" y="98" width="64" height="6" rx="3" fill={INK} fillOpacity="0.10" />
        <rect x="68" y="98" width="34" height="6" rx="3" fill={CORAL} />
        <rect x="68" y="112" width="40" height="6" rx="2" fill={INK} fillOpacity="0.15" />

        <circle cx="42" cy="76" r="8" fill={CORAL_SOFT} />
        <circle cx="42" cy="73" r="3" fill={CORAL} />
        <path d="M36 84 Q42 79 48 84" stroke={CORAL} strokeWidth="1.6" strokeLinecap="round" fill="none" />

        <circle cx="158" cy="76" r="8" fill={CORAL_SOFT} />
        <circle cx="158" cy="73" r="3" fill={CORAL} />
        <path d="M152 84 Q158 79 164 84" stroke={CORAL} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
    </FlatPanel>
  );
}

function AlertFlatB() {
  return (
    <FlatPanel>
      <svg width="200" height="150" viewBox="0 0 200 150" fill="none">
        <path d="M100 22 C112 22 122 32 122 44 L122 70 L130 80 L70 80 L78 70 L78 44 C78 32 88 22 100 22 Z"
          fill={CORAL} />
        <circle cx="100" cy="92" r="6" fill={CORAL} />
        <circle cx="100" cy="40" r="14" fill="#fff" />
        <path d="M100 34 V44 M100 48 V49" stroke={CORAL} strokeWidth="2" strokeLinecap="round" />

        <circle cx="58" cy="56" r="3" fill={CORAL} fillOpacity="0.4" />
        <circle cx="142" cy="56" r="3" fill={CORAL} fillOpacity="0.4" />
        <circle cx="50" cy="100" r="2" fill={CORAL} fillOpacity="0.3" />
        <circle cx="150" cy="100" r="2" fill={CORAL} fillOpacity="0.3" />

        <rect x="56" y="116" width="88" height="8" rx="2" fill={INK} fillOpacity="0.12" />
        <rect x="68" y="130" width="64" height="6" rx="2" fill={INK} fillOpacity="0.08" />
      </svg>
    </FlatPanel>
  );
}

// ─── C · Split layout (annotated screenshots) ────────────────────────────────

function AnnotationDot({ children, top, left }: { children: string; top: number; left: number }) {
  return (
    <div style={{
      position: "absolute", top, left,
      display: "flex", alignItems: "center", gap: 8,
      pointerEvents: "none",
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "var(--agent-coral-deep)",
        color: "#fff", fontSize: 10, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 6px rgba(255,107,74,0.40)",
      }}>{children}</span>
    </div>
  );
}

function AnnotatedMiniPreview() {
  return (
    <div style={{ position: "relative" }}>
      <MiniPipelinePreview />
      <AnnotationDot top={-4} left={-6}>1</AnnotationDot>
    </div>
  );
}

function PipelineAnnotatedC() {
  return (
    <div style={{ position: "relative" }}>
      <PipelineMockA />
      <AnnotationDot top={12} left={6}>1</AnnotationDot>
      <AnnotationDot top={42} left={120}>2</AnnotationDot>
    </div>
  );
}

function FileAnnotatedC() {
  return (
    <div style={{ position: "relative" }}>
      <FileMockA />
      <AnnotationDot top={8} left={100}>1</AnnotationDot>
      <AnnotationDot top={68} left={6}>2</AnnotationDot>
    </div>
  );
}

function PortalAnnotatedC() {
  return (
    <div style={{ position: "relative" }}>
      <PortalMockA />
      <AnnotationDot top={50} left={6}>1</AnnotationDot>
    </div>
  );
}

function AlertAnnotatedC() {
  return (
    <div style={{ position: "relative" }}>
      <AlertMockA />
      <AnnotationDot top={6} left={6}>1</AnnotationDot>
    </div>
  );
}

// ─── D · Bold iconographic ───────────────────────────────────────────────────

function IconPanel({
  Icon, gradient,
}: {
  Icon: PhosphorIcon;
  gradient: string;
}) {
  return (
    <div style={{
      height: 220, padding: 24,
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.22), transparent 60%)",
      }} />
      <div style={{
        width: 96, height: 96, borderRadius: 24,
        background: "rgba(255,255,255,0.18)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
        position: "relative",
      }}>
        <Icon size={48} weight="fill" color="#fff" />
      </div>
    </div>
  );
}

function PipelineIconD() {
  return <IconPanel Icon={Funnel} gradient="linear-gradient(135deg, #FF6B4A 0%, #FF8A65 100%)" />;
}
function FileIconD() {
  return <IconPanel Icon={CheckSquare} gradient="linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)" />;
}
function PortalIconD() {
  return <IconPanel Icon={Globe} gradient="linear-gradient(135deg, #F06292 0%, #FF8A65 100%)" />;
}
function AlertIconD() {
  return <IconPanel Icon={Bell} gradient="linear-gradient(135deg, #E53E3E 0%, #FF6B4A 100%)" />;
}
