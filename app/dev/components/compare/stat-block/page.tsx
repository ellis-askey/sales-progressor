"use client";

// StatBlock — the hub's scoped stat-header canonical, rendered REAL (the actual component the
// hub uses), not a code reproduction. Shows the approved look AND proves the scoping: it does
// not touch the shared .agent-eyebrow (36 files), so tweaking the hub stat header never ripples.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { StatBlock } from "@/components/ui/StatBlock";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";

export default function StatBlockComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const restore = useRef<string | null>(null);
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const vars = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-pane" as string]: theme === "dark" ? "rgba(255,255,255,0.03)" : "#faf8f5",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
  } as CSSProperties;
  const toggle = (active: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: active ? CORAL : "transparent", color: active ? "#fff" : "var(--compare-body)" });

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>StatBlock — scoped hub stat header</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px 120px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · hub · StatBlock</span>
        <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 680, letterSpacing: "-0.02em" }}>The real component, and why it's its own group</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6 }}>
          This is the <strong>actual <code>&lt;StatBlock&gt;</code></strong> component the hub renders — not a reproduction of its code. It's eyebrow + the 30/750 <code>StatNumber</code> + subtitle, bundled into one self-contained canonical.
        </p>

        <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CORAL, marginBottom: 8 }}>Live &lt;StatBlock&gt;</span>
        <div className="agent-glass-strong" style={{ borderRadius: 18, padding: "20px 24px", border: `1.5px solid ${CORAL}`, marginBottom: 28 }}>
          <StatBlock
            eyebrow="Pipeline at a glance"
            value={<>12 active sales</>}
            sub="Here's where every file sits right now."
          />
        </div>

        <section style={{ borderTop: "1px solid var(--compare-line)", paddingTop: 22 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 650 }}>Scoping — your blast-radius concern, handled</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.75 }}>
            <li><strong>Its own component</strong> — <code>components/ui/StatBlock.tsx</code>. Change the hub stat header → edit StatBlock only. Nothing else moves.</li>
            <li><strong>Does NOT use the shared <code>.agent-eyebrow</code></strong> (36 files) or <code>.agent-card-subtitle</code> — so it can't drag those around, and they can't drag it.</li>
            <li><strong>Still on-system</strong> — it draws the same design <em>tokens</em> (<code>--agent-text-eyebrow</code>, <code>--agent-text-muted</code>, etc.) for colour + scale, so it stays consistent without the class coupling.</li>
            <li><strong>Number</strong> = the canonical <code>StatNumber</code> (30/750/tabular), also its own component. WinsCard keeps its distinct coral kicker + shares <code>StatNumber</code> for the figure.</li>
          </ul>
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.6 }}>
            Applied to <code>PipelineAtAGlance</code>. If the live hub still looks different, it's a stale dev build — hard-refresh and it becomes exactly this.
          </p>
        </section>
      </div>
    </div>
  );
}
