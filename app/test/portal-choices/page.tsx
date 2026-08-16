"use client";

// Portal choices lab (disposable, founder-only via /test). A selection page for
// the things that AREN'T glass-variant picks: the nav/UI icons (the current set
// feels cheesy), the floating Help "?" control, and the "steps done" card at the
// top of the overview. Tap to pick, then Copy JSON and I wire the winners in.
// Delete once chosen.

import { useState } from "react";
import {
  House, HouseLine, ClockCounterClockwise, Path, ChatCircle, ChatText, ChatDots,
  Question, Lifebuoy, Info, CheckCircle, Circle, Lock, SealCheck,
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

// ── Progress-header-card mockups (the "X of Y steps done" card) ──────────────
function HdrBar() {
  return (
    <div style={{ height: 8, borderRadius: 999, background: "rgba(15,23,42,0.10)", overflow: "hidden", margin: "10px 0" }}>
      <div style={{ width: "25%", height: "100%", borderRadius: 999, background: P.accent }} />
    </div>
  );
}
function HeaderCurrent() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.textPrimary }}>5 of 13 steps done</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.accent }}>25%</span>
      </div>
      <HdrBar />
      <p style={{ margin: 0, fontSize: 12, color: P.textMuted }}>Next: <span style={{ color: P.textSecondary }}>Searches ordered</span></p>
    </div>
  );
}
function HeaderStage() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: P.textMuted }}>Current stage</p>
          <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: P.textPrimary }}>Conveyancing</p>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.accent }}>25%</span>
      </div>
      <HdrBar />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: P.textMuted }}>5 of 13 done</span>
        <span style={{ color: P.textSecondary }}>Next: Searches ordered</span>
      </div>
    </div>
  );
}
function HeaderTarget() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.textPrimary }}>5 of 13 steps done</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: P.accent }}>25%</span>
      </div>
      <HdrBar />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(16,185,129,0.10)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#047857" }}>On track for exchange by 5 Nov</span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: P.textMuted }}>Next: Searches ordered</p>
    </div>
  );
}

// ── Step status icon mockups (done / your turn / locked) ─────────────────────
function StepIconRow({ variant }: { variant: "current" | "phosphor" | "seal" }) {
  function icon(state: "done" | "active" | "locked") {
    if (variant === "current") {
      if (state === "done") return <div style={{ width: 24, height: 24, borderRadius: 999, background: P.success, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>;
      if (state === "active") return <div style={{ width: 24, height: 24, borderRadius: 999, border: `2px solid ${P.primary}`, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 8, height: 8, borderRadius: 999, background: P.primary }} /></div>;
      return <div style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(15,23,42,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={12} color={P.textMuted} /></div>;
    }
    if (variant === "phosphor") {
      if (state === "done") return <CheckCircle size={26} weight="fill" color={P.success} />;
      if (state === "active") return <Circle size={26} weight="bold" color={P.primary} />;
      return <Lock size={24} weight="regular" color={P.textMuted} />;
    }
    if (state === "done") return <SealCheck size={26} weight="fill" color={P.success} />;
    if (state === "active") return <Circle size={26} weight="duotone" color={P.primary} />;
    return <Lock size={24} weight="duotone" color={P.textMuted} />;
  }
  const states: ["done" | "active" | "locked", string][] = [["done", "Done"], ["active", "Your turn"], ["locked", "Locked"]];
  return (
    <div style={{ display: "flex", gap: 22 }}>
      {states.map(([s, lbl]) => (
        <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {icon(s)}
          <span style={{ fontSize: 10, color: P.textMuted }}>{lbl}</span>
        </div>
      ))}
    </div>
  );
}

// ── Updates card layout mockups ──────────────────────────────────────────────
// Two distinct dates per update:
//   EVENT date (orange, prominent) = when the thing actually happened
//   CONFIRMED date + time (muted)  = when it was logged / confirmed
const U = { sentence: "Ellis Askey confirmed your solicitor has received the draft contract pack", event: "13 August 2026", confirmed: "13 Aug", time: "09:05" };
function UAvatar() { return <div style={{ width: 32, height: 32, borderRadius: 999, background: P.primaryBg, color: P.primaryText, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: 12 }}>EA</div>; }
function UPill() { return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 999, background: "#fff", color: "#CC4A2E", border: "0.5px solid #FF6B4A", boxShadow: "0 1px 2px rgba(15,23,42,0.05)", whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: "#FF6B4A" }} />Purchase</span>; }
function USentence() { return <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary, lineHeight: 1.35 }}>{U.sentence}</p>; }
// Orange event date with a calendar glyph so it reads as "the date this is about".
function UEvent() { return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: P.primary }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>{U.event}</span>; }
// Muted audit line — clearly the "when it was confirmed" stamp.
function UConfirmed() { return <span style={{ fontSize: 12, color: P.textMuted }}>Confirmed {U.confirmed} · {U.time}</span>; }

function UpdatesLayout({ v }: { v: string }) {
  if (v === "meta-top") return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}><UAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}><UPill /><UConfirmed /></div>
        <USentence /><div style={{ marginTop: 6 }}><UEvent /></div>
      </div>
    </div>
  );
  if (v === "event-lead") return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}><UAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <USentence /><div style={{ marginTop: 6 }}><UEvent /></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}><UConfirmed /><UPill /></div>
      </div>
    </div>
  );
  if (v === "pill-top") return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}><UAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 6 }}><UPill /></div><USentence />
        <div style={{ marginTop: 6 }}><UEvent /></div>
        <p style={{ margin: "3px 0 0" }}><UConfirmed /></p>
      </div>
    </div>
  );
  if (v === "split") return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}><UAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <USentence />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}><UEvent /><UPill /></div>
        <p style={{ margin: "4px 0 0" }}><UConfirmed /></p>
      </div>
    </div>
  );
  if (v === "confirmed-corner") return (
    <div style={{ position: "relative", display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ position: "absolute", top: 0, right: 0 }}><UConfirmed /></span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}><UAvatar /><UPill /></div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 20 }}>
        <USentence /><div style={{ marginTop: 6 }}><UEvent /></div>
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}><UAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <USentence />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <UEvent /><span style={{ color: P.border }}>|</span><UConfirmed />
        </div>
        <div style={{ marginTop: 7 }}><UPill /></div>
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

        <Section title="Progress header card" blurb="The card above the steps on the Progress tab (X of Y steps done). Same info, three ways to bring a bit more to it.">
          <Selectable cat="progressHeader" id="HEADER-CURRENT" note="Current - count, %, bar, next step" picks={picks} onPick={onPick}>
            <HeaderCurrent />
          </Selectable>
          <Selectable cat="progressHeader" id="HEADER-STAGE" note="Leads with the current stage name" picks={picks} onPick={onPick}>
            <HeaderStage />
          </Selectable>
          <Selectable cat="progressHeader" id="HEADER-TARGET" note="Adds an on-track target-exchange line" picks={picks} onPick={onPick}>
            <HeaderTarget />
          </Selectable>
        </Section>

        <Section title="Step status icons" blurb="The little icons next to each step on the Progress tab: done / your turn / locked.">
          <Selectable cat="stepIcons" id="STEPICONS-CURRENT" note="Current - filled circle, coral ring, lock" picks={picks} onPick={onPick}>
            <StepIconRow variant="current" />
          </Selectable>
          <Selectable cat="stepIcons" id="STEPICONS-PHOSPHOR" note="Phosphor - CheckCircle / Circle / Lock" picks={picks} onPick={onPick}>
            <StepIconRow variant="phosphor" />
          </Selectable>
          <Selectable cat="stepIcons" id="STEPICONS-SEAL" note="Phosphor SealCheck + duotone" picks={picks} onPick={onPick}>
            <StepIconRow variant="seal" />
          </Selectable>
        </Section>

        <Section title="Updates card layout" blurb="Six ways to lay out one update. Two distinct dates: the ORANGE event date (when it happened) and the muted 'Confirmed 13 Aug · 09:05' (when it was logged). The sentence spans full width; the pill says whose side it is.">
          <Selectable cat="updatesLayout" id="UL-META-TOP" note="Pill + Confirmed stamp header, update, then the orange event date" picks={picks} onPick={onPick}><UpdatesLayout v="meta-top" /></Selectable>
          <Selectable cat="updatesLayout" id="UL-EVENT-LEAD" note="Update, orange event date, then Confirmed stamp + pill row" picks={picks} onPick={onPick}><UpdatesLayout v="event-lead" /></Selectable>
          <Selectable cat="updatesLayout" id="UL-PILL-TOP" note="Pill on top; event date then Confirmed stamp stacked" picks={picks} onPick={onPick}><UpdatesLayout v="pill-top" /></Selectable>
          <Selectable cat="updatesLayout" id="UL-SPLIT" note="Event date left / pill right, Confirmed stamp beneath" picks={picks} onPick={onPick}><UpdatesLayout v="split" /></Selectable>
          <Selectable cat="updatesLayout" id="UL-CONFIRMED-CORNER" note="Confirmed stamp tucked top-right, pill under the avatar" picks={picks} onPick={onPick}><UpdatesLayout v="confirmed-corner" /></Selectable>
          <Selectable cat="updatesLayout" id="UL-INLINE" note="Event date | Confirmed stamp on one line, pill beneath" picks={picks} onPick={onPick}><UpdatesLayout v="inline" /></Selectable>
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
