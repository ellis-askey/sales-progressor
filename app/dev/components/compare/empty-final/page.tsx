"use client";
// Design-system before/after — the FINAL empty-state gaps, for sign-off approval.
// Nothing shipped is touched until approved. Three remaining pieces:
//   1. EmailSetupPrompt's secondary controls — "Not now", the dismiss X, the link
//   2. The generic ui/EmptyState (search / "no matches") — the blue default
//   3. The Chains workspace CTA — a glossy gradient pill
// Each shown current vs the canon it would become. Dev-only.

import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/arc/button/button";
import { X, ChatCircleText } from "@phosphor-icons/react";
import "@/components/arc/cookie-consent/scope.css";

const CORAL = "#FF6B4A";
const CORAL_DEEP = "#E55B3D";
const INK = "#2D1810";
const MUTED = "rgba(45,24,16,0.55)";

function Section({ n, title, note, children }: { n: number; title: string; note: ReactNode; children: ReactNode }) {
  return (
    <section style={{ paddingTop: 34, marginTop: 34, borderTop: "1px solid rgba(45,24,16,0.1)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: CORAL, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>{title}</h2>
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#6b6258", lineHeight: 1.55, maxWidth: 680 }}>{note}</p>
      <div style={{ display: "flex", gap: 36, flexWrap: "wrap", alignItems: "flex-start" }}>{children}</div>
    </section>
  );
}
function Panel({ tag, children }: { tag: string; children: ReactNode }) {
  const before = tag.toLowerCase() === "current";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 320, flex: 1 }}>
      <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 9px", borderRadius: 999, color: before ? "#9a8d84" : INK, background: before ? "rgba(45,24,16,0.06)" : "rgba(255,107,74,0.14)" }}>{tag}</span>
      <div style={{ background: "#F4F2EF", borderRadius: 14, border: "1px solid rgba(45,24,16,0.08)", padding: 22, display: "flex", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

/* ── 1. Email nudge secondary controls ─────────────────────────────────────── */
function NudgeRow({ canon }: { canon?: boolean }) {
  return (
    <div className="arc-scope" style={{ width: 320, display: "flex", flexDirection: "column", gap: 14, ...( { "--control-on": CORAL } as CSSProperties) }}>
      <style>{`.ef-x{display:grid;place-items:center;border:0;background:transparent;cursor:pointer}.ef-x-old{padding:4px;border-radius:6px;color:${MUTED}}.ef-x-old:hover{background:rgba(255,107,74,0.1);color:${INK}}.ef-x-canon{width:30px;height:30px;border-radius:999px;color:rgba(45,24,16,0.5)}.ef-x-canon:hover{background:rgba(45,24,16,0.07);color:${INK}}.ef-notnow-old{font-size:12.5px;font-weight:600;color:${MUTED};background:none;border:none;padding:8px 6px;cursor:pointer}.ef-notnow-old:hover{color:${INK}}.ef-link-old,.ef-link-canon{color:${CORAL_DEEP};font-weight:600;text-decoration:none}.ef-link-canon:hover{color:${CORAL_DEEP}}`}</style>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: INK }}>Send emails from your own address</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button type="button" variant="primary" size="sm" style={{ "--foreground": CORAL, "--background": "#fff" } as CSSProperties}>Set up my email</Button>
            {canon
              ? <Button type="button" variant="ghost" size="sm">Not now</Button>
              : <button type="button" className="ef-notnow-old">Not now</button>}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: MUTED }}>
            Want to change what they say? <a href="#" onClick={(e) => e.preventDefault()} className={canon ? "ef-link-canon" : "ef-link-old"}>Personalise your client emails</a>
          </p>
        </div>
        <button type="button" aria-label="Dismiss" className={`ef-x ${canon ? "ef-x-canon" : "ef-x-old"}`}><X size={14} /></button>
      </div>
    </div>
  );
}

/* ── 2. Generic ui/EmptyState (search / no-matches) ────────────────────────── */
function GenericEmpty({ canon }: { canon?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "6px 12px", gap: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", marginBottom: 12,
        background: canon ? "rgba(255,107,74,0.12)" : "linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)",
        boxShadow: canon ? "none" : "0 1px 3px rgba(59,130,246,0.12), 0 4px 12px rgba(59,130,246,0.08)" }}>
        <ChatCircleText size={20} weight="regular" color={canon ? CORAL_DEEP : "#60a5fa"} />
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: canon ? INK : "rgba(15,23,42,0.8)" }}>No matches</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: canon ? MUTED : "rgba(15,23,42,0.4)", maxWidth: 240, lineHeight: 1.5 }}>No chains match your search or filters.</p>
    </div>
  );
}

/* ── 3. Chains CTA pill ────────────────────────────────────────────────────── */
function ChainsCta({ canon }: { canon?: boolean }) {
  if (canon) {
    return (
      <div className="arc-scope" style={{ ...( { "--control-on": CORAL } as CSSProperties) }}>
        <Button type="button" variant="primary" size="md" style={{ "--foreground": CORAL, "--background": "#fff" } as CSSProperties}>Link a sale</Button>
      </div>
    );
  }
  return (
    <>
      <style>{`.ef-chains-old{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 18px;border-radius:12px;font-size:13.5px;font-weight:650;color:#fff;border:0;cursor:pointer;background:linear-gradient(180deg,#ff8a65 0%,#e55b3d 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 4px 16px rgba(255,107,74,0.28)}`}</style>
      <button type="button" className="ef-chains-old">Link a sale</button>
    </>
  );
}

export default function EmptyFinalCompare() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#FBFAF8", color: INK, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 140px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · final empty-state gaps</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Last pieces before sign-off</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 700 }}>
            The hero, info cards, banner cards and buttons are already canon across all the empty-state pages. These are the three remaining bespoke bits. Approve and I&rsquo;ll apply them, then it&rsquo;s a clean sign-off.
          </p>
        </header>

        <Section n={1} title="Email nudge — secondary controls" note={<>The “Set up my email” primary is already canon. <strong>Current</strong> still has a bespoke “Not now”, dismiss <strong>X</strong> and link. <strong>Proposed</strong> swaps them for the canon <strong>ghost</strong>, canon <strong>close (X)</strong> and canon <strong>coral link</strong>.</>}>
          <Panel tag="Current"><NudgeRow /></Panel>
          <Panel tag="Proposed"><NudgeRow canon /></Panel>
        </Section>

        <Section n={2} title="Generic empty state — the blue default" note={<>Used for search / “no matches” (Chains workspace). <strong>Current</strong> is the blue shadcn default (blue icon, slate text). <strong>Proposed</strong> brings it onto the coral token + warm ink, matching everything else.</>}>
          <Panel tag="Current"><GenericEmpty /></Panel>
          <Panel tag="Proposed"><GenericEmpty canon /></Panel>
        </Section>

        <Section n={3} title="Chains workspace CTA" note={<>The external-business empty CTA is a bespoke <strong>glossy gradient pill</strong>. <strong>Proposed</strong> makes it the flat canonical primary, like every other empty-state button.</>}>
          <Panel tag="Current"><ChainsCta /></Panel>
          <Panel tag="Proposed"><ChainsCta canon /></Panel>
        </Section>
      </div>
    </div>
  );
}
