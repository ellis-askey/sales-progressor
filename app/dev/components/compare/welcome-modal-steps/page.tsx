"use client";
// Design-system before/after — the welcome modal, steps 2 (chases) and 3 (ready).
// The alignment is already live in the shared CSS, so the right card is the
// shipped version; the left card re-applies the OLD treatment via .pw-old
// overrides (cool navy ink, weight-800 type, gradient CTA, 26px X) so the change
// reads exactly like the step-1 comparison. Dev-only.

import { notFound } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, ArrowLeft, Play, Plus, X } from "@phosphor-icons/react";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";

const INK = "#2D1810";

// Re-applies the pre-alignment treatment on top of the current shared styles.
// Higher specificity than the base rules so it wins where it overlaps.
const OLD_CSS = `
.pw-card.pw-old[data-pw-theme="light"] { --heading:#0F1B2D; --body:#54617d; --muted:#9aa3b2; --row-bg:rgba(45,24,16,0.015); }
.pw-old .pw-eyebrow { font-size:11.5px; font-weight:800; letter-spacing:0.14em; }
.pw-old .pw-title { margin:11px 0 0; font-size:25px; line-height:1.12; font-weight:800; letter-spacing:-0.5px; }
.pw-old .pw-lede { margin:11px 0 0; font-size:14.5px; line-height:1.55; }
.pw-old .pw-close { width:26px; height:26px; }
.pw-old .pw-cta { gap:10px; border:0; border-radius:14px; min-height:0; padding:14px 26px; font-size:15px; font-weight:700;
  background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%); box-shadow:0 6px 16px rgba(240,81,26,0.30);
  transition:transform 140ms ease,box-shadow 160ms ease,filter 160ms ease; }
.pw-old .pw-cta:hover { opacity:1; transform:translateY(-1px); box-shadow:0 10px 24px rgba(240,81,26,0.42); filter:saturate(1.05) brightness(1.02); }
.pw-old .pw-ghost { min-height:0; padding:8px 10px; border:0; border-radius:10px; font-size:13.5px; font-weight:600; }
.pw-old .pw-ghost:hover { color:#F0511A; background:transparent; }
`;

const CHASES: { t: string; d: string; on: boolean }[] = [
  { t: "Client chases", d: "When something’s waiting on a buyer or seller, we’ll ask them to confirm it through their portal and follow up if needed, so nothing gets forgotten.", on: true },
  { t: "Solicitor chases", d: "When something’s sitting with a solicitor, we’ll follow up for confirmation and bring it to your attention if it stays outstanding.", on: true },
  { t: "Enquiry chases", d: "When enquiries need raising or a solicitor owes replies, we’ll keep following up until they come back.", on: true },
  { t: "Weekly client updates", d: "Your buyers and sellers get a simple weekly update on where things stand and what happens next, without you having to write a thing.", on: true },
  { t: "Chain updates", d: "When something changes on a linked sale, connected agents are kept updated, helping everyone stay on the same page as the chain moves towards exchange.", on: false },
];

function ToggleRow({ t, d, on }: { t: string; d: string; on: boolean }) {
  const [checked, setChecked] = useState(on);
  return (
    <div className="pw-trow">
      <div className="pw-tx"><span className="pw-tr-t">{t}</span><span className="pw-tr-d">{d}</span></div>
      <LiquidToggle checked={checked} onChange={setChecked} width={38} height={22} color="var(--agent-coral, #FF8A65)" aria-label={t} />
    </div>
  );
}

function Step2Card({ old }: { old?: boolean }) {
  return (
    <div className={`pw-card${old ? " pw-old" : ""}`} data-pw-theme="light" style={{ width: 520, maxWidth: "100%", animation: "none", borderRadius: 16 }}>
      <button className="pw-close" aria-label="Close"><X size={14} weight="bold" /></button>
      <div className="pw-col" style={{ padding: "32px 34px 26px" }}>
        <div className="pw-dots"><span className="pw-dot" /><span className="pw-dot on" /><span className="pw-dot" /></div>
        <div className="pw-stepbody">
          <span className="pw-eyebrow">Set up · your chases</span>
          <h2 className="pw-title">We&rsquo;ll do the chasing.</h2>
          <p className="pw-lede">These run automatically on every sale. They&rsquo;re all switched on, but you can turn off anything you&rsquo;d rather handle yourself.</p>
          <div className="pw-toggles">
            {CHASES.map((c) => <ToggleRow key={c.t} {...c} />)}
          </div>
          <p className="pw-footnote">You&rsquo;re always in control. Change any of these at any time in Settings. We&rsquo;ll never chase more than twice for the same step.</p>
          <div className="pw-foot">
            <button className="pw-back"><ArrowLeft size={15} weight="bold" /> Back</button>
            <button className="pw-cta">Save and continue <ArrowRight size={18} weight="bold" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3Card({ old }: { old?: boolean }) {
  return (
    <div className={`pw-card${old ? " pw-old" : ""}`} data-pw-theme="light" style={{ width: 500, maxWidth: "100%", animation: "none", borderRadius: 16, position: "relative", overflow: "hidden" }}>
      <div className="pw-ready-bg" aria-hidden />
      <button className="pw-close" aria-label="Close"><X size={14} weight="bold" /></button>
      <div className="pw-col" style={{ padding: "32px 34px 26px" }}>
        <div className="pw-dots"><span className="pw-dot" /><span className="pw-dot" /><span className="pw-dot on" /></div>
        <div className="pw-stepbody">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-icon.png" alt="TSP" className="pw-ready-logo" width={54} height={54} />
          <span className="pw-eyebrow" style={{ marginTop: 16 }}>All set</span>
          <h2 className="pw-title">You&rsquo;re ready to go.</h2>
          <p className="pw-lede">Add your first sale to get started, and we&rsquo;ll take it from there. Or take a quick look around first.</p>
          <div className="pw-foot" style={{ justifyContent: "center" }}>
            <button className="pw-ghost"><Play size={15} weight="fill" /> Take a quick tour</button>
            <button className="pw-cta"><Plus size={18} weight="bold" /> Add your first sale</button>
          </div>
          <div className="pw-linkrow" style={{ justifyContent: "center" }}>
            <button className="pw-back"><ArrowLeft size={15} weight="bold" /> Back to chases</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Col({ tag, title, children }: { tag: string; title: string; children: ReactNode }) {
  const before = tag.toLowerCase() === "before";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 9px", borderRadius: 999, color: before ? "#9a8d84" : INK, background: before ? "rgba(45,24,16,0.06)" : "rgba(255,107,74,0.14)" }}>{tag}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section style={{ paddingTop: 36, marginTop: 36, borderTop: "1px solid rgba(45,24,16,0.1)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 22 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B4A", fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>{title}</h2>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#1F8A4A", background: "rgba(31,138,74,0.1)", padding: "2px 9px", borderRadius: 999 }}>Aligned version now live</span>
      </div>
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>{children}</div>
    </section>
  );
}

export default function WelcomeModalStepsCompare() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ minHeight: "100vh", background: "#F1EEEA", color: INK, fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 140px" }}>
      <style dangerouslySetInnerHTML={{ __html: WELCOME_STEPS_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: OLD_CSS }} />
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · before / after</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Welcome modal — steps 2 &amp; 3</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 740 }}>
            The same alignment as step 1, now carried across the whole modal by the shared CSS. <strong>Before</strong> re-applies the old treatment; <strong>After</strong> is what&rsquo;s shipping. Same diffs: warm ink, the 600 weight ramp, the flat-coral primary + ghost at equal height, the 30px X. The toggles and the step-3 street-sketch are unchanged.
          </p>
        </header>

        <Section n={2} title="Choose your chases">
          <Col tag="Before" title="Old treatment"><Step2Card old /></Col>
          <Col tag="After" title="Aligned (shipped)"><Step2Card /></Col>
        </Section>

        <Section n={3} title="You’re ready to go">
          <Col tag="Before" title="Old treatment"><Step3Card old /></Col>
          <Col tag="After" title="Aligned (shipped)"><Step3Card /></Col>
        </Section>
      </div>
    </div>
  );
}
