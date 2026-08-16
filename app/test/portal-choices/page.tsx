"use client";

// Portal choices lab (disposable, founder-only via /test). A selection page for
// the things that AREN'T glass-variant picks: the nav/UI icons (the current set
// feels cheesy), the floating Help "?" control, and the "steps done" card at the
// top of the overview. Tap to pick, then Copy JSON and I wire the winners in.
// Delete once chosen.

import { useState } from "react";
import {
  House, HouseLine, ClockCounterClockwise, Path, ChatCircle, ChatText, ChatDots,
  Question, Lifebuoy, Info,
} from "@phosphor-icons/react/dist/ssr";
import {
  Home, Activity, MessageSquare, MessageCircle, HelpCircle, LifeBuoy, Compass,
} from "lucide-react";
import { P } from "@/components/portal/portal-ui";

const WASH: React.CSSProperties = {
  backgroundColor: "#f6f8fc",
  backgroundImage: [
    "radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%)",
    "radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%)",
    "radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%)",
    "radial-gradient(85% 60% at 50% 96%, rgba(255,208,176,0.30), transparent 75%)",
  ].join(","),
  backgroundRepeat: "no-repeat",
};

type Picks = Record<string, string>;

function Selectable({ cat, id, note, picks, onPick, children }: {
  cat: string; id: string; note?: string; picks: Picks; onPick: (c: string, i: string) => void; children: React.ReactNode;
}) {
  const sel = picks[cat] === id;
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onPick(cat, id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(cat, id); } }}
      style={{ cursor: "pointer", background: "#fff", borderRadius: 16, padding: 16, boxShadow: sel ? `0 0 0 2px ${P.accent}, ${P.shadowMd}` : P.shadowSm }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${sel ? P.accent : P.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {sel && <span style={{ width: 8, height: 8, borderRadius: 999, background: P.accent }} />}
          </span>
          <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, fontWeight: 700, color: P.accent, background: P.accentBg, padding: "3px 8px", borderRadius: 6 }}>{id}</code>
        </span>
        {note && <span style={{ fontSize: 11, color: P.textMuted, textAlign: "right" }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: P.textPrimary }}>{title}</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: P.textSecondary, lineHeight: 1.5 }}>{blurb}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

// A nav trio preview: 3 tabs, the active one (Overview) in coral, the rest grey.
function NavTrio({ Over, Prog, Upd }: { Over: React.ElementType; Prog: React.ElementType; Upd: React.ElementType }) {
  const items: [React.ElementType, string, boolean][] = [[Over, "Overview", true], [Prog, "Progress", false], [Upd, "Updates", false]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "rgba(255,255,255,0.9)", borderRadius: 14, padding: "10px 4px", border: `0.5px solid ${P.border}` }}>
      {items.map(([Icon, label, active]) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? P.primary : P.textMuted }}>
          <Icon size={24} width={24} height={24} weight={active ? "fill" : "regular"} strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// A Help control preview (matches the floating pill shape).
function HelpPill({ Icon, weight }: { Icon: React.ElementType; weight?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 999, background: "rgba(255,255,255,0.9)", border: `0.5px solid ${P.border}`, boxShadow: "0 8px 24px rgba(45,24,16,0.10)", color: P.primary, fontSize: 13, fontWeight: 600 }}>
      <Icon size={17} width={17} height={17} weight={weight as never} strokeWidth={1.9} />
      <span style={{ color: "#1f2937" }}>Help</span>
    </span>
  );
}

// ── Steps-done card mockups ──────────────────────────────────────────────────
const STAGES = ["Instructed", "Draft pack", "Searches", "Enquiries", "Exchange", "Completion"];
const DONE = 1; // index of active (Instructed done, Draft pack active)

function StepsTiles() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      {STAGES.map((s, i) => {
        const done = i < DONE, active = i === DONE;
        const color = done ? P.success : active ? P.primary : "rgba(15,23,42,0.20)";
        return (
          <div key={s} style={{ display: "contents" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "1 0 0", minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", color, fontWeight: 700, fontSize: 12 }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 9, color: active ? P.primary : P.textMuted, textAlign: "center", fontWeight: active ? 700 : 500 }}>{s}</span>
            </div>
            {i < STAGES.length - 1 && <div style={{ height: 2, width: 10, marginTop: 15, background: done ? P.success : "rgba(15,23,42,0.10)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function StepsBar() {
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {STAGES.map((s, i) => {
          const done = i < DONE, active = i === DONE;
          return <div key={s} style={{ flex: 1, height: 8, borderRadius: 999, background: done ? P.success : active ? P.primary : "rgba(15,23,42,0.10)" }} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: P.textPrimary, fontWeight: 700 }}>Draft pack</span>
        <span style={{ color: P.textMuted }}>Step 2 of 6</span>
      </div>
    </div>
  );
}

function StepsDots() {
  return (
    <div style={{ position: "relative", padding: "6px 4px" }}>
      <div style={{ position: "absolute", left: 12, right: 12, top: 12, height: 2, background: "rgba(15,23,42,0.10)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
        {STAGES.map((s, i) => {
          const done = i < DONE, active = i === DONE;
          const color = done ? P.success : active ? P.primary : "rgba(15,23,42,0.22)";
          return (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 44 }}>
              <span style={{ width: active ? 14 : 10, height: active ? 14 : 10, borderRadius: 999, background: color, border: active ? `3px solid rgba(255,107,74,0.25)` : "none", marginTop: active ? 0 : 2 }} />
              <span style={{ fontSize: 8.5, color: active ? P.primary : P.textMuted, textAlign: "center", fontWeight: active ? 700 : 500 }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PortalChoicesPage() {
  const [picks, setPicks] = useState<Picks>({});
  const [copied, setCopied] = useState(false);
  const onPick = (c: string, i: string) => setPicks((p) => ({ ...p, [c]: i }));
  const json = JSON.stringify(picks, null, 2);
  const copy = () => navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  const count = Object.keys(picks).length;

  return (
    <div style={{ minHeight: "100vh", position: "relative", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, ...WASH }} />
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(246,248,252,0.85)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px" }}>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: P.primary }}>Portal choices</p>
          <p style={{ margin: 0, fontSize: 12, color: P.textSecondary }}>Icons, the Help control, and the steps card. Tap to pick, Copy JSON at the bottom.</p>
        </div>
      </div>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 100px", display: "flex", flexDirection: "column", gap: 40 }}>

        <Section title="Nav bar icons" blurb="The bottom-tab set (Overview / Progress / Updates). The active tab is coral. Pick the family that feels least cheesy.">
          <Selectable cat="navIcons" id="NAV-PHOSPHOR-FILL" note="Phosphor, filled when active" picks={picks} onPick={onPick}>
            <NavTrio Over={House} Prog={ClockCounterClockwise} Upd={ChatCircle} />
          </Selectable>
          <Selectable cat="navIcons" id="NAV-PHOSPHOR-LINE" note="Phosphor, line + house-line / path / chat-dots" picks={picks} onPick={onPick}>
            <NavTrio Over={HouseLine} Prog={Path} Upd={ChatDots} />
          </Selectable>
          <Selectable cat="navIcons" id="NAV-LUCIDE" note="Lucide, clean geometric line" picks={picks} onPick={onPick}>
            <NavTrio Over={Home} Prog={Activity} Upd={MessageSquare} />
          </Selectable>
          <Selectable cat="navIcons" id="NAV-LUCIDE-SOFT" note="Lucide, compass for progress + round chat" picks={picks} onPick={onPick}>
            <NavTrio Over={Home} Prog={Compass} Upd={MessageCircle} />
          </Selectable>
        </Section>

        <Section title="Help control" blurb="The floating support pill (bottom-right). Same pill, different glyph. Pick one.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Selectable cat="helpIcon" id="HELP-QUESTION" note="Phosphor Question" picks={picks} onPick={onPick}><HelpPill Icon={Question} weight="regular" /></Selectable>
            <Selectable cat="helpIcon" id="HELP-CHAT" note="Phosphor ChatText" picks={picks} onPick={onPick}><HelpPill Icon={ChatText} weight="regular" /></Selectable>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Selectable cat="helpIcon" id="HELP-LIFEBUOY" note="Phosphor Lifebuoy" picks={picks} onPick={onPick}><HelpPill Icon={Lifebuoy} weight="regular" /></Selectable>
            <Selectable cat="helpIcon" id="HELP-LUCIDE-CIRCLE" note="Lucide HelpCircle" picks={picks} onPick={onPick}><HelpPill Icon={HelpCircle} /></Selectable>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Selectable cat="helpIcon" id="HELP-LUCIDE-BUOY" note="Lucide LifeBuoy" picks={picks} onPick={onPick}><HelpPill Icon={LifeBuoy} /></Selectable>
            <Selectable cat="helpIcon" id="HELP-INFO" note="Phosphor Info" picks={picks} onPick={onPick}><HelpPill Icon={Info} weight="regular" /></Selectable>
          </div>
        </Section>

        <Section title="Steps card (top of overview)" blurb="How the 6 stages read at a glance. Same data, three treatments.">
          <Selectable cat="stepsCard" id="STEPS-TILES" note="Current - numbered circles + connectors" picks={picks} onPick={onPick}>
            <StepsTiles />
          </Selectable>
          <Selectable cat="stepsCard" id="STEPS-BAR" note="Segmented bar + current stage line" picks={picks} onPick={onPick}>
            <StepsBar />
          </Selectable>
          <Selectable cat="stepsCard" id="STEPS-DOTS" note="Dot stepper on a track" picks={picks} onPick={onPick}>
            <StepsDots />
          </Selectable>
        </Section>

        <section>
          <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: P.textPrimary }}>Your picks</h2>
          <pre style={{ margin: 0, background: "#0f1420", color: "#d7e0f5", borderRadius: 14, padding: 16, fontSize: 12, lineHeight: 1.6, overflowX: "auto", fontFamily: "ui-monospace, Menlo, monospace" }}>{count ? json : "{ }  - nothing picked yet"}</pre>
        </section>
      </main>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, background: "rgba(246,248,252,0.9)", backdropFilter: "blur(16px)", borderTop: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: P.textSecondary }}>{count} picked</span>
          <button onClick={copy} disabled={!count} style={{ border: 0, cursor: count ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700, color: "#fff", padding: "11px 20px", borderRadius: 12, background: copied ? P.success : count ? P.accent : "rgba(15,23,42,0.2)" }}>
            {copied ? "Copied ✓" : "Copy JSON"}
          </button>
        </div>
      </div>
    </div>
  );
}
