"use client";

// /dev/focus-contact — layout lab for the Focus "last contact per side" readout.
//
// The data wiring (lib/services/focus.ts) is correct and shipped; this page is ONLY
// about how it's laid out. The live version boxes three tall cells under every side,
// which doubles each card's height. Below are leaner candidates, all rendered against
// the real agent tokens over realistic mock data (incl. a bounce + a never-contacted
// side). Pick one — "ship candidate N" — or mix. Dev-only; blocks in production.

import { notFound } from "next/navigation";
import { EnvelopeSimple, WhatsappLogo, Phone, CaretDown } from "@phosphor-icons/react";

type Tone = "ok" | "neutral" | "warn" | "danger";
type Dir = "you" | "they" | "auto";
type Channel = "email" | "whatsapp" | "call";

type Contact =
  | { empty: true }
  | { empty?: false; dir: Dir; state: string; tone: Tone; when: string; exact: string };

type Side = {
  role: "seller" | "buyer";
  name: string;
  initials: string;
  quiet?: string;
  email: Contact;
  whatsapp: Contact;
  call: Contact;
};

type File = { addr: string; loc: string; sides: Side[] };

const E = (dir: Dir, state: string, tone: Tone, when: string, exact: string): Contact => ({ dir, state, tone, when, exact });
const NONE: Contact = { empty: true };

// Mirrors the real screenshot + two edge cases (bounce, never-contacted).
const FILES: File[] = [
  {
    addr: "16 Miles Drive", loc: "London, SE28 0JA",
    sides: [
      { role: "seller", name: "Lizzy Dick", initials: "LD", quiet: "Quiet 15d",
        email: E("auto", "Delivered", "neutral", "today", "20 Oct 2026, 11:00 · automated send"),
        whatsapp: E("they", "Replied", "ok", "2 weeks ago", "6 Oct 2026, 09:14 · they replied"),
        call: NONE },
      { role: "buyer", name: "Olawale & Angela Oshunkeye", initials: "OO", quiet: "Quiet 15d",
        email: E("auto", "Logged", "warn", "2 weeks ago", "6 Oct 2026 · self-reported, no send to prove"),
        whatsapp: E("you", "Messaged", "neutral", "2 weeks ago", "6 Oct 2026, 16:38 · you messaged"),
        call: NONE },
    ],
  },
  {
    addr: "83 Highfield Road", loc: "Tring, HP23 4DS",
    sides: [
      { role: "seller", name: "Ben & Jessica Palser", initials: "BP",
        email: E("auto", "Logged", "warn", "2 months ago", "18 Aug 2026 · self-reported"),
        whatsapp: E("you", "Messaged", "neutral", "7 days ago", "13 Oct 2026, 10:02 · you messaged"),
        call: E("you", "Called", "neutral", "3 months ago", "20 Jul 2026 · logged by you") },
      { role: "buyer", name: "Suzy Ruck", initials: "SR", quiet: "Quiet 19d",
        email: E("auto", "Sent", "neutral", "2 months ago", "18 Aug 2026 · automated send"),
        whatsapp: E("you", "Messaged", "neutral", "2 weeks ago", "6 Oct 2026 · you messaged"),
        call: E("you", "Called", "neutral", "3 months ago", "20 Jul 2026 · logged by you") },
    ],
  },
  {
    addr: "Edge cases", loc: "bounce · never contacted",
    sides: [
      { role: "buyer", name: "Aisha Khan", initials: "AK",
        email: E("you", "Bounced", "danger", "5 days ago", "15 Oct 2026, 10:12 · bounced, mailbox unreachable"),
        whatsapp: NONE,
        call: E("you", "Called", "neutral", "2 days ago", "18 Oct 2026 · logged by you") },
      { role: "seller", name: "Harold Benn", initials: "HB", quiet: "Never contacted",
        email: NONE, whatsapp: NONE, call: NONE },
    ],
  },
];

const EMPTY_LABEL: Record<Channel, string> = { email: "No email", whatsapp: "No WhatsApp", call: "No call" };
const EMPTY_LONG: Record<Channel, string> = { email: "No email on record", whatsapp: "No WhatsApp on record", call: "No call logged" };
const ICON: Record<Channel, typeof EnvelopeSimple> = { email: EnvelopeSimple, whatsapp: WhatsappLogo, call: Phone };
const DIR_LABEL: Record<Dir, string> = { you: "You", they: "They", auto: "Auto" };

function cx(...xs: (string | false | undefined)[]) { return xs.filter(Boolean).join(" "); }

// ── shared card chrome ────────────────────────────────────────────────────────
function Card({ file, children }: { file: File; children: (s: Side) => React.ReactNode }) {
  return (
    <div className="dcard">
      <div className="dhead">
        <span className="dthumb" />
        <span><span className="daddr">{file.addr}</span><span className="dloc">{file.loc}</span></span>
      </div>
      {file.sides.map((s, i) => (
        <div className={cx("dside", s.role)} key={i}>{children(s)}</div>
      ))}
    </div>
  );
}
function Who({ s, children }: { s: Side; children?: React.ReactNode }) {
  return (
    <div className="dsrow">
      <span className={cx("dav", s.role)}>{s.initials}</span>
      <span className="dwho"><span className={cx("drole", s.role)}>{s.role === "seller" ? "Seller" : "Buyer"}</span><span className="dname">{s.name}</span></span>
      {s.quiet ? <span className="dquiet">{s.quiet}</span> : null}
      {children}
      <span className="dgrow" />
      <button className="dcontact">Contact <CaretDown size={12} weight="bold" /></button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Candidate 1 — one airy line (no boxes, no tiles)
function C1({ s }: { s: Side }) {
  const row = (ch: Channel) => {
    const c = s[ch]; const Icon = ICON[ch];
    if (c.empty) return <span className="c1u off"><Icon size={14} /><span className="c1dash">{EMPTY_LABEL[ch]}</span></span>;
    return (
      <span className="c1u" title={`${c.state} · ${c.exact}`}>
        <Icon size={14} className={`ch-${ch}`} />
        <span className="c1dir">{DIR_LABEL[c.dir]}</span>
        <span className={cx("c1st", `t-${c.tone}`)}>{c.state}</span>
        <span className="c1t">· {c.when}</span>
      </span>
    );
  };
  return (<><Who s={s} /><div className="c1">{row("email")}{row("whatsapp")}{row("call")}</div></>);
}

// Candidate 2 — folded onto the name row (zero extra height). Icon + time, state as
// a pip colour, word on hover.
function C2({ s }: { s: Side }) {
  const dot = (ch: Channel) => {
    const c = s[ch]; const Icon = ICON[ch];
    if (c.empty) return <span className="c2u off" title={EMPTY_LONG[ch]}><Icon size={14} /></span>;
    return (
      <span className="c2u" title={`${DIR_LABEL[c.dir]} · ${c.state} · ${c.exact}`}>
        <span className="c2ic"><Icon size={14} className={`ch-${ch}`} /><span className={cx("c2pip", `p-${c.tone}`)} /></span>
        <span className="c2t">{c.when}</span>
      </span>
    );
  };
  return <Who s={s}><span className="c2">{dot("email")}{dot("whatsapp")}{dot("call")}</span></Who>;
}

// Candidate 3 — minimal icon + time, state only as a pip; everything on hover.
function C3({ s }: { s: Side }) {
  const u = (ch: Channel) => {
    const c = s[ch]; const Icon = ICON[ch];
    if (c.empty) return <span className="c3u off" title={EMPTY_LONG[ch]}><Icon size={15} /><span className="c3t">—</span></span>;
    return (
      <span className="c3u" title={`${DIR_LABEL[c.dir]} · ${c.state} · ${c.exact}`}>
        <span className="c3ic"><Icon size={15} className={`ch-${ch}`} /><span className={cx("c3pip", `p-${c.tone}`)} /></span>
        <span className="c3t">{c.when}</span>
      </span>
    );
  };
  return (<><Who s={s} /><div className="c3">{u("email")}{u("whatsapp")}{u("call")}</div></>);
}

// Candidate 4 — tight labelled chips (one line, subtle, no glyph tiles).
function C4({ s }: { s: Side }) {
  const chip = (ch: Channel) => {
    const c = s[ch]; const Icon = ICON[ch];
    if (c.empty) return <span className="c4chip off"><Icon size={13} />{EMPTY_LABEL[ch]}</span>;
    return (
      <span className={cx("c4chip", `b-${c.tone}`)} title={c.exact}>
        <Icon size={13} className={`ch-${ch}`} />
        <span className="c4dir">{DIR_LABEL[c.dir]}</span>
        <b className={`t-${c.tone}`}>{c.state}</b>
        <span className="c4t">{c.when}</span>
      </span>
    );
  };
  return (<><Who s={s} /><div className="c4">{chip("email")}{chip("whatsapp")}{chip("call")}</div></>);
}

// Candidate 5 — present channels only, as a quiet sentence. Empty channels drop out
// entirely rather than taking space; a muted tail notes what's missing.
function C5({ s }: { s: Side }) {
  const present = (["email", "whatsapp", "call"] as Channel[]).filter((ch) => !s[ch].empty);
  const missing = (["email", "whatsapp", "call"] as Channel[]).filter((ch) => s[ch].empty);
  return (
    <><Who s={s} />
      <div className="c5">
        {present.map((ch, i) => {
          const c = s[ch] as Extract<Contact, { state: string }>; const Icon = ICON[ch];
          return (
            <span className="c5seg" key={ch} title={c.exact}>
              {i > 0 && <span className="c5sep">·</span>}
              <Icon size={13} className={`ch-${ch}`} />
              <span className="c5dir">{DIR_LABEL[c.dir]}</span>
              <b className={`t-${c.tone}`}>{c.state}</b>
              <span className="c5t">{c.when}</span>
            </span>
          );
        })}
        {present.length === 0 && <span className="c5none">Never contacted on any channel</span>}
        {missing.length > 0 && present.length > 0 && <span className="c5miss">· no {missing.join(" / ")}</span>}
      </div>
    </>
  );
}

const CANDIDATES: { n: number; title: string; blurb: string; render: (s: Side) => React.ReactNode }[] = [
  { n: 1, title: "One airy line", blurb: "Three channels on a single slim line, no boxes or tiles. Direction, state (coloured), time. Empties dim out. ~1 short row per side.", render: (s) => <C1 s={s} /> },
  { n: 2, title: "Folded onto the name row", blurb: "Indicators live on the existing name row — zero extra height. Icon + time, state as a pip colour, the word on hover. The most compact possible.", render: (s) => <C2 s={s} /> },
  { n: 3, title: "Minimal icon + time", blurb: "Just channel icon, a status pip, and the time. State word and detail on hover. Quietest of the set.", render: (s) => <C3 s={s} /> },
  { n: 4, title: "Tight chips", blurb: "Compact one-line chips with a hairline tone edge — lighter than the shipped cells, still spells the state out.", render: (s) => <C4 s={s} /> },
  { n: 5, title: "Present channels only", blurb: "Drops empty channels entirely instead of showing 'none' cells; a muted tail says what's missing. Shortest when channels are sparse.", render: (s) => <C5 s={s} /> },
];

export default function FocusContactLab() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="lab">
      <style>{CSS}</style>
      <header className="labhd">
        <h1>Focus · last-contact layout lab</h1>
        <p>Same correct data, five leaner layouts. The shipped version (boxed three-cell) is at the bottom for reference. Tell me <b>&ldquo;ship candidate N&rdquo;</b> (mixing fine). Toggle dark with your OS/theme switch.</p>
      </header>

      {CANDIDATES.map((cand) => (
        <section className="cand" key={cand.n}>
          <div className="candhd"><span className="candn">{cand.n}</span><div><h2>{cand.title}</h2><p>{cand.blurb}</p></div></div>
          <div className="cards">
            {FILES.map((f, i) => <Card file={f} key={i}>{(s) => cand.render(s)}</Card>)}
          </div>
        </section>
      ))}

      <section className="cand ref">
        <div className="candhd"><span className="candn ref">×</span><div><h2>Shipped now (for reference)</h2><p>The current boxed three-cell block — what you want to beat.</p></div></div>
        <div className="cards">
          {FILES.map((f, i) => (
            <Card file={f} key={i}>{(s) => (<><Who s={s} /><RefLedger s={s} /></>)}</Card>
          ))}
        </div>
      </section>
    </div>
  );
}

// The shipped layout, reproduced for side-by-side reference.
function RefLedger({ s }: { s: Side }) {
  const u = (ch: Channel) => {
    const c = s[ch]; const Icon = ICON[ch];
    if (c.empty) return (
      <span className="refu off"><span className="refgl"><Icon size={16} /></span><span className="refum"><span className="refst">{EMPTY_LONG[ch]}</span></span></span>
    );
    return (
      <button className={cx("refu", ch)} title={c.exact}>
        <span className="refgl"><Icon size={16} className={`ch-${ch}`} /><span className={cx("refpip", `p-${c.tone}`)} /></span>
        <span className="refum"><span className="reful"><span className="refdir">{DIR_LABEL[c.dir]}</span><span className={cx("refst", `t-${c.tone}`)}>{c.state}</span></span><span className="reft">{c.when}</span></span>
      </button>
    );
  };
  return <div className="refled">{u("email")}{u("whatsapp")}{u("call")}</div>;
}

const CSS = `
.lab { max-width: 980px; margin: 0 auto; padding: 32px 24px 100px; }
.labhd h1 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 6px; color: var(--agent-text-primary); }
.labhd p { margin: 0 0 8px; font-size: 13.5px; color: var(--agent-text-secondary); max-width: 72ch; }

.cand { margin-top: 34px; }
.cand.ref { opacity: .92; }
.candhd { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
.candn { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #fff; background: var(--agent-coral-deep); }
.candn.ref { background: var(--agent-text-muted); }
.candhd h2 { font-size: 16px; font-weight: 750; letter-spacing: -.01em; margin: 2px 0 2px; color: var(--agent-text-primary); }
.candhd p { margin: 0; font-size: 12.5px; color: var(--agent-text-muted); max-width: 74ch; }

.cards { display: flex; flex-direction: column; gap: 11px; }

/* card chrome — mirrors the real Focus card */
.dcard { background: var(--agent-surface-elevated); border: 1px solid var(--agent-border-default); border-radius: 16px; padding: 13px 16px 8px; box-shadow: 0 1px 2px rgba(45,24,16,.04), 0 7px 22px rgba(45,24,16,.05); }
.dhead { display: flex; align-items: center; gap: 11px; margin-bottom: 6px; }
.dthumb { width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0; background: linear-gradient(140deg,#d8c3b0,#b89a82); box-shadow: inset 0 0 0 1px rgba(45,24,16,.06); }
.daddr { display: block; font-size: 14.5px; font-weight: 720; letter-spacing: -.012em; color: var(--agent-text-primary); }
.dloc { display: block; font-size: 11.5px; color: var(--agent-text-muted); margin-top: 1px; }

.dside { padding: 10px 0; }
.dside + .dside { border-top: 1px solid var(--agent-border-subtle); }
.dsrow { display: flex; align-items: center; gap: 10px; }
.dav { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; font-size: 10px; font-weight: 700; color: #fff; letter-spacing: .02em; box-shadow: 0 0 0 2px var(--agent-surface-elevated); }
.dav.seller { background: linear-gradient(145deg,#4479b0,#295d8f); }
.dav.buyer { background: linear-gradient(145deg,#2f9d78,#1f7a5c); }
.dwho { min-width: 0; display: flex; flex-direction: column; }
.drole { font-size: 10px; font-weight: 700; line-height: 1.25; }
.drole.seller { color: #0c447c; } .drole.buyer { color: #0a5a44; }
.dname { font-size: 13px; font-weight: 650; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dquiet { flex-shrink: 0; font-size: 11px; font-weight: 650; color: var(--agent-warning); background: rgba(var(--agent-warning-rgb,201,138,0),.12); border: 1px solid rgba(var(--agent-warning-rgb,201,138,0),.28); padding: 2px 8px; border-radius: 99px; }
.dgrow { flex: 1; }
.dcontact { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; flex-shrink: 0; border: 1px solid var(--agent-border-strong); border-radius: 9px; background: var(--agent-surface-glass); color: var(--agent-text-secondary); font-family: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }

/* channel icon colours */
.ch-email { color: #3b6ef0; } .ch-whatsapp { color: #1fa855; } .ch-call { color: var(--agent-coral-deep); }
.t-ok { color: var(--agent-success); } .t-neutral { color: var(--agent-text-primary); } .t-warn { color: var(--agent-warning); } .t-danger { color: var(--agent-danger); }
.p-ok { background: var(--agent-success); } .p-neutral { background: var(--agent-text-muted); } .p-warn { background: var(--agent-warning); } .p-danger { background: var(--agent-danger); }

/* ── C1 airy line ── */
.c1 { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 7px 0 1px 38px; }
.c1u { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; }
.c1u svg { position: relative; top: 2px; }
.c1dir { font-size: 9px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--agent-text-muted); }
.c1st { font-weight: 700; letter-spacing: -.01em; }
.c1t { color: var(--agent-text-muted); font-variant-numeric: tabular-nums; }
.c1u.off { color: var(--agent-text-muted); opacity: .75; }
.c1u.off svg { color: var(--agent-border-strong); }
.c1dash { color: var(--agent-text-muted); }

/* ── C2 folded onto the row ── */
.c2 { display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0; margin-right: 4px; }
.c2u { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--agent-text-secondary); font-variant-numeric: tabular-nums; }
.c2ic { position: relative; display: inline-flex; }
.c2pip { position: absolute; right: -3px; bottom: -3px; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--agent-surface-elevated); }
.c2u.off { opacity: .5; }
.c2u.off svg { color: var(--agent-border-strong); }

/* ── C3 minimal ── */
.c3 { display: flex; gap: 20px; margin: 7px 0 1px 38px; }
.c3u { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--agent-text-secondary); font-variant-numeric: tabular-nums; }
.c3ic { position: relative; display: inline-flex; }
.c3pip { position: absolute; right: -3px; bottom: -3px; width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--agent-surface-elevated); }
.c3t { color: var(--agent-text-secondary); }
.c3u.off { opacity: .5; } .c3u.off svg { color: var(--agent-border-strong); } .c3u.off .c3t { color: var(--agent-text-muted); }

/* ── C4 tight chips ── */
.c4 { display: flex; flex-wrap: wrap; gap: 6px; margin: 7px 0 1px 38px; }
.c4chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 7px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-glass); font-size: 11.5px; color: var(--agent-text-secondary); }
.c4chip svg { flex-shrink: 0; }
.c4chip b { font-weight: 700; }
.c4dir { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--agent-text-muted); }
.c4t { color: var(--agent-text-muted); font-variant-numeric: tabular-nums; }
.c4chip.b-ok { border-left: 2px solid var(--agent-success); } .c4chip.b-warn { border-left: 2px solid var(--agent-warning); } .c4chip.b-danger { border-left: 2px solid var(--agent-danger); } .c4chip.b-neutral { border-left: 2px solid var(--agent-border-strong); }
.c4chip.off { border-style: dashed; color: var(--agent-text-muted); opacity: .8; }
.c4chip.off svg { color: var(--agent-border-strong); }

/* ── C5 sentence, present only ── */
.c5 { margin: 7px 0 1px 38px; font-size: 12px; color: var(--agent-text-secondary); display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px; }
.c5seg { display: inline-flex; align-items: baseline; gap: 5px; }
.c5seg svg { position: relative; top: 2px; }
.c5sep { color: var(--agent-border-strong); margin: 0 3px; }
.c5dir { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--agent-text-muted); }
.c5seg b { font-weight: 700; }
.c5t { color: var(--agent-text-muted); font-variant-numeric: tabular-nums; }
.c5miss { color: var(--agent-text-muted); opacity: .8; }
.c5none { color: var(--agent-text-muted); font-style: italic; }

/* ── reference (shipped) ── */
.refled { display: flex; align-items: stretch; margin: 9px 0 1px 38px; border: 1px solid var(--agent-border-subtle); border-radius: 11px; background: var(--agent-surface-glass); }
.refu { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; padding: 9px 12px; background: none; border: 0; font-family: inherit; text-align: left; color: inherit; cursor: pointer; }
.refu + .refu { box-shadow: inset 1px 0 0 var(--agent-border-subtle); }
.refgl { position: relative; width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px; display: grid; place-items: center; background: var(--agent-surface-subtle); color: var(--agent-text-muted); }
.refpip { position: absolute; right: -2px; bottom: -2px; width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--agent-surface-elevated); }
.refum { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.reful { display: flex; align-items: baseline; gap: 6px; }
.refdir { font-size: 9px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--agent-text-muted); }
.refst { font-size: 12.5px; font-weight: 700; }
.reft { font-size: 11px; color: var(--agent-text-muted); font-variant-numeric: tabular-nums; margin-top: 1px; }
.refu.off .refgl { background: transparent; color: var(--agent-border-strong); box-shadow: inset 0 0 0 1px var(--agent-border-default); }
.refu.off .refst { color: var(--agent-text-muted); font-weight: 600; }
`;
