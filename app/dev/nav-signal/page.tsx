"use client";

// /dev/nav-signal — DESIGN EXPLORATION for critique #300.
//
// The experimental shell (now live for everyone) collapses the left nav by
// default. The only thing left on the left edge is a mute grey hamburger
// edge-tab (.agx-edge-handle, 24x92). The per-section "your move" counts
// (Reminders / Enquiries / Completions / To-Do / Chains) are live, but they're
// trapped inside the collapsed drawer, so when it's tucked away there is NO
// signal that work is waiting.
//
// This page renders the real handle spec at several signal treatments so we can
// compare them as pixels before wiring anything. Nothing here touches the real
// shell. Tokens are mirrored with explicit fallbacks so it renders standalone.

import { useState } from "react";
import { List, CaretRight } from "@phosphor-icons/react";

const CORAL = "var(--agent-coral, #FF6B4A)";
const CORAL_DEEP = "var(--agent-coral-deep, #E8512F)";
const SURFACE = "var(--agent-surface-elevated, #ffffff)";
const BORDER = "var(--agent-border-default, #e7e2db)";
const MUTED = "var(--agent-text-muted, #8b8784)";

// The live per-section counts, same source as the nav rail badges.
const SECTIONS = [
  { label: "Reminders", count: 2 },
  { label: "Enquiries", count: 1 },
  { label: "Completions", count: 0 },
  { label: "To-do", count: 3 },
  { label: "Chains", count: 1 },
];

type Variant = "current" | "dot" | "count" | "count-tint";

const VARIANT_META: { key: Variant; name: string; blurb: string }[] = [
  { key: "current", name: "A · Current", blurb: "No signal. The handle looks the same whether or not work is waiting." },
  { key: "dot", name: "B · Dot", blurb: "A coral dot appears when anything needs you. Calm. Says 'something', not 'how much'." },
  { key: "count", name: "C · Count", blurb: "One number: the total that needs you. Directly answers 'they can't see the numbers'. Tap to see the breakdown." },
  { key: "count-tint", name: "D · Count + tint", blurb: "The count, plus the handle itself warms to coral so it reads as active in peripheral vision." },
];

function EdgeHandle({ variant, total }: { variant: Variant; total: number }) {
  const hasWork = total > 0;
  const tint = variant === "count-tint" && hasWork;
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: 0,
        transform: "translateY(-50%)",
        width: 30,
        height: 92,
      }}
    >
      <button
        type="button"
        aria-label="Open navigation"
        style={{
          position: "relative",
          width: 24,
          height: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${tint ? CORAL : BORDER}`,
          borderLeft: "none",
          borderRadius: "0 15px 15px 0",
          background: tint ? "var(--agent-coral-wash, #FFF3EF)" : SURFACE,
          color: tint ? CORAL_DEEP : MUTED,
          boxShadow: "0 6px 20px rgba(24,30,54,0.12)",
          cursor: "pointer",
        }}
      >
        <List weight="bold" size={15} />

        {/* B · dot */}
        {variant === "dot" && hasWork && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 8,
              right: -3,
              width: 9,
              height: 9,
              borderRadius: 999,
              background: CORAL,
              border: "1.5px solid #fff",
            }}
          />
        )}

        {/* C / D · count pill */}
        {(variant === "count" || variant === "count-tint") && hasWork && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: -9,
              minWidth: 17,
              height: 17,
              padding: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: CORAL,
              color: "#fff",
              fontSize: 10.5,
              fontWeight: 700,
              lineHeight: 1,
              boxShadow: "0 2px 6px rgba(232,81,47,0.45)",
            }}
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>
    </div>
  );
}

export default function NavSignalPreview() {
  const [total, setTotal] = useState(7);
  const liveSum = SECTIONS.reduce((n, s) => n + s.count, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f1ec", padding: "40px 32px", color: "#2a2724" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Collapsed-nav signal — critique #300</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#5c5852", margin: "8px 0 0", maxWidth: 680 }}>
          The nav is tucked away by default, so the per-section counts are hidden until it&rsquo;s opened.
          These are the candidate ways to show &ldquo;there&rsquo;s work in here&rdquo; on the edge handle itself.
          Use the control to see each at empty, light and busy loads.
        </p>

        {/* count control */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0 28px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#7a756e" }}>Items needing you:</span>
          {[0, 3, 7, 12].map((n) => (
            <button
              key={n}
              onClick={() => setTotal(n)}
              style={{
                padding: "6px 14px",
                borderRadius: 9,
                border: `1px solid ${total === n ? CORAL : "#d9d4cc"}`,
                background: total === n ? CORAL : "#fff",
                color: total === n ? "#fff" : "#5c5852",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>

        {/* variants grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18 }}>
          {VARIANT_META.map((v) => (
            <div
              key={v.key}
              style={{
                borderRadius: 16,
                border: "1px solid #e4dfd7",
                background: "#fbf9f6",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* a little stage representing the app's left edge */}
              <div
                style={{
                  position: "relative",
                  height: 160,
                  background: "linear-gradient(135deg,#efeae3,#e7f0ef)",
                  borderBottom: "1px solid #e4dfd7",
                }}
              >
                <EdgeHandle variant={v.key} total={total} />
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{v.name}</p>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "#6c675f" }}>{v.blurb}</p>
              </div>
            </div>
          ))}
        </div>

        {/* how the aggregate relates to the open drawer */}
        <div style={{ marginTop: 34, borderRadius: 16, border: "1px solid #e4dfd7", background: "#fff", padding: 22, maxWidth: 420 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#7a756e", textTransform: "uppercase", letterSpacing: 0.4 }}>
            What the number rolls up
          </p>
          <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {SECTIONS.map((s) => (
              <li key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#4a463f" }}>
                  <CaretRight size={12} weight="bold" style={{ color: "#c9c3ba" }} />
                  {s.label}
                </span>
                {s.count > 0 ? (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      padding: "0 5px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 999,
                      border: `1.25px solid ${CORAL_DEEP}`,
                      color: CORAL_DEEP,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {s.count}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "#b3aca2" }}>—</span>
                )}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eee7dd", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>Total needing you</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: CORAL_DEEP }}>{liveSum}</span>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: "#8a857d" }}>
            The handle count is just the sum of these same live per-section figures, so it never disagrees with
            what you see inside.
          </p>
        </div>
      </div>
    </div>
  );
}
