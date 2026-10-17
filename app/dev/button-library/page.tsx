"use client";

// /dev/button-library — THE canonical button library. Numbered, stable reference.
//
// Workflow: when you hit a wrong button anywhere in the app, say "make this #3"
// and it becomes that canonical. Need something the set doesn't cover? We append
// a new #N here (never renumber — the numbers are the contract).
//
// Every specimen renders the REAL class/component against the production gloss
// tokens (see layout.tsx), so what you see is what ships. Hover/active are live.
// Dev-only.

import { notFound } from "next/navigation";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";
import { ArrowRight, CaretDown, X, Check, Plus, PaperPlaneTilt } from "@phosphor-icons/react";

type Entry = {
  n: number;
  name: string;
  when: string;              // when to use it
  use: string;               // the code to apply
  specimen: () => React.ReactNode;
  tier: "core" | "support" | "pattern";
};

// ── Canonical pattern renders (compositions, not single classes) ──────────────

const Split = () => (
  <span className="lib-split"><button className="go"><PaperPlaneTilt size={14} weight="fill" /> Send</button><button className="caret" aria-label="More"><CaretDown size={12} weight="bold" /></button></span>
);
const Switch = () => <span className="lib-switch on" role="switch" aria-checked="true"><i /></span>;
const Seg = () => <span className="lib-seg"><span className="lib-seg-thumb" /><button className="on">Light</button><button>Dark</button></span>;
const OptionCards = () => (
  <span style={{ display: "inline-flex", gap: 8 }}>
    <button className="lib-opt on"><span className="lib-opt-radio" /><span>Freehold</span></button>
    <button className="lib-opt"><span className="lib-opt-radio" /><span>Leasehold</span></button>
  </span>
);

const ENTRIES: Entry[] = [
  // ── Core action buttons (the top 6) ──
  {
    n: 1, tier: "core", name: "Primary", when: "The one main action on a view — Save, Confirm, Send. Never more than one competing primary in the same place.",
    use: `<Button variant="primary">Save</Button>   ·   className="agent-btn agent-btn-md agent-btn-color-primary"  (in Tailwind-heavy spots)`,
    specimen: () => (
      <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="agent-btn agent-btn-md agent-btn-primary">Save changes</button>
        <button className="agent-btn agent-btn-md agent-btn-primary" disabled>Disabled</button>
      </span>
    ),
  },
  {
    n: 2, tier: "core", name: "Secondary", when: "The alternate action paired beside a primary — View, Skip, the quieter of two choices.",
    use: `<Button variant="secondary">…</Button>   ·   className="agent-btn agent-btn-md agent-btn-secondary"`,
    specimen: () => <button className="agent-btn agent-btn-md agent-btn-secondary">View timeline</button>,
  },
  {
    n: 3, tier: "core", name: "Ghost", when: "Low-emphasis inline action where even a secondary is too heavy — Dismiss, inline affordances.",
    use: `<Button variant="ghost">…</Button>   ·   className="agent-btn agent-btn-md agent-btn-ghost"`,
    specimen: () => <button className="agent-btn agent-btn-md agent-btn-ghost">Dismiss</button>,
  },
  {
    n: 4, tier: "core", name: "Neutral (Cancel)", when: "The Cancel/Close in a modal or drawer footer. Where it needn't carry weight, a link (#8) reads cleaner.",
    use: `className="agent-btn agent-btn-md agent-btn-neutral"`,
    specimen: () => <button className="agent-btn agent-btn-md agent-btn-neutral">Cancel</button>,
  },
  {
    n: 5, tier: "core", name: "Danger", when: "A destructive confirm — withdraw, remove, delete-the-thing. Pair with a neutral Cancel.",
    use: `<Button variant="danger">…</Button>   ·   className="agent-btn agent-btn-md agent-btn-danger"`,
    specimen: () => <button className="agent-btn agent-btn-md agent-btn-danger">Remove file</button>,
  },
  {
    n: 6, tier: "core", name: "Ghost-bordered", when: "A quiet bordered action inside cards/rows — Snooze, Set date, Wake. More present than a ghost, lighter than a secondary.",
    use: `className="agent-btn agent-btn-sm agent-btn-ghost-bordered"`,
    specimen: () => (
      <span style={{ display: "inline-flex", gap: 10 }}>
        <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Snooze</button>
        <button className="agent-btn agent-btn-xs agent-btn-ghost-bordered">Set date</button>
      </span>
    ),
  },

  // ── Supporting ──
  {
    n: 7, tier: "support", name: "Coral outline", when: "An alternative CTA that needs more presence than a ghost but shouldn't compete with the primary — Add a sale.",
    use: `className="pw-secondary"  (within .pw-scope)`,
    specimen: () => <span className="pw-scope"><button className="pw-secondary"><Plus size={15} weight="bold" /> Add a sale</button></span>,
  },
  {
    n: 8, tier: "support", name: "Link", when: "A text-only action — View all, Change, Not now. Muted variant for the very quiet ones, primary for emphasis.",
    use: `className="agent-link"  ·  "agent-link agent-link-muted"  ·  "agent-link agent-link-primary"`,
    specimen: () => (
      <span style={{ display: "inline-flex", gap: 18, alignItems: "center" }}>
        <button className="agent-link" style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 650 }}>View all</button>
        <button className="agent-link agent-link-muted" style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", fontSize: 13 }}>Not now</button>
      </span>
    ),
  },
  {
    n: 9, tier: "support", name: "Icon button", when: "Close crosses, row chrome, header controls. -sm for tight rows.",
    use: `className="agent-icon-btn"  ·  "agent-icon-btn agent-icon-btn-sm"`,
    specimen: () => (
      <span style={{ display: "inline-flex", gap: 10 }}>
        <button className="agent-icon-btn" aria-label="Close"><X size={16} weight="bold" /></button>
        <button className="agent-icon-btn agent-icon-btn-sm" aria-label="Close"><X size={13} weight="bold" /></button>
      </span>
    ),
  },
  {
    n: 10, tier: "support", name: "Segment pill", when: "Tab-like filters within a card — All / Notes / Nearby. The selected pill fills solid.",
    use: `className="agent-segment-pill"  ·  add "on" when selected  ·  -sm for the small size`,
    specimen: () => (
      <span style={{ display: "inline-flex", gap: 6 }}>
        <button className="agent-segment-pill on">All</button>
        <button className="agent-segment-pill">Notes</button>
        <button className="agent-segment-pill">Nearby</button>
      </span>
    ),
  },

  // ── Patterns (compositions) ──
  {
    n: 11, tier: "pattern", name: "Split primary", when: "A primary action with a dropdown of variants beside it — Send ▾, Chase ▾. Same gloss as #1 with a caret segment.",
    use: `Pattern: wrap a gloss .go button + a .caret segment (see markup in this file)`,
    specimen: () => <Split />,
  },
  {
    n: 12, tier: "pattern", name: "Switch", when: "An on/off toggle for a single setting. Coral when on.",
    use: `Pattern: role="switch" pill + knob (one canonical size)`,
    specimen: () => (
      <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
        <Switch />
        <span className="lib-switch" role="switch" aria-checked="false"><i /></span>
      </span>
    ),
  },
  {
    n: 13, tier: "pattern", name: "Segmented control", when: "Two or three mutually exclusive choices with a sliding thumb — Light / Dark, Solid / Gradient.",
    use: `Pattern: sliding-thumb segmented (measured thumb)`,
    specimen: () => <Seg />,
  },
  {
    n: 14, tier: "pattern", name: "Option card", when: "A selectable choice card — tenure, billing point, survey level. Solid gloss when selected; border lights + lifts on hover. Radio or tick both fine.",
    use: `Pattern: bordered card, add "on" for the selected (gloss) state`,
    specimen: () => <OptionCards />,
  },
];

const PW_SCOPE_CSS = `
.pw-scope { --coral:#FF6B4A; --cta-from:#FF7E57; --cta-to:#F0511A; --cta-shadow:rgba(240,78,44,0.32); --cta-shadow-hi:rgba(240,78,44,0.42); --muted:rgba(45,24,16,0.55); --body:#5A3A28; --surface:#ffffff; --row-border:rgba(45,24,16,0.10); display:inline-block; }
`;

// Pattern CSS (the compositions that aren't a single agent-btn class).
const LIB_CSS = `
.lib-split { display:inline-flex; border-radius:11px; overflow:hidden; box-shadow:var(--agent-btn-shadow, 0 2px 0 rgba(0,0,0,0.22), 0 6px 16px rgba(var(--agent-coral-rgb),0.30)); }
.lib-split .go, .lib-split .caret { border:0; cursor:pointer; color:#fff; background:var(--agent-btn-bg, linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))); box-shadow:inset 0 1px 0 rgba(255,255,255,0.32); transition:filter .16s ease; }
.lib-split .go { display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:14px; font-weight:700; padding:10px 16px; }
.lib-split .caret { display:grid; place-items:center; width:34px; box-shadow:inset 1px 0 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.32); }
.lib-split:hover .go, .lib-split:hover .caret { filter:saturate(1.05) brightness(1.03); }

.lib-switch { display:inline-block; position:relative; width:40px; height:22px; border-radius:999px; background:rgba(120,120,130,0.4); cursor:pointer; transition:background .16s; }
.lib-switch.on { background:var(--agent-coral-deep, #F0511A); }
.lib-switch i { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.3); transition:transform .16s; }
.lib-switch.on i { transform:translateX(18px); }

.lib-seg { position:relative; display:inline-flex; width:max-content; background:rgba(120,120,130,0.16); border-radius:9px; padding:3px; gap:2px; }
.lib-seg-thumb { position:absolute; top:3px; bottom:3px; left:3px; width:calc(50% - 4px); border-radius:7px; background:#fff; box-shadow:0 1px 2px rgba(40,26,20,0.14); }
.lib-seg button { position:relative; z-index:1; border:0; background:none; font:inherit; font-size:12px; font-weight:600; color:var(--agent-text-secondary, rgba(45,24,16,0.55)); padding:5px 14px; border-radius:7px; cursor:pointer; }
.lib-seg button.on { color:var(--agent-text-primary, #2D1810); }

.lib-opt { display:inline-flex; align-items:center; gap:9px; min-width:130px; text-align:left; cursor:pointer; font:inherit; font-size:13px; font-weight:650; color:var(--agent-text-primary,#111827); background:var(--agent-surface, #fff); padding:11px 13px; border-radius:11px; border:1.5px solid rgba(45,24,16,0.14); transition:border-color .15s ease, box-shadow .2s ease, transform .14s ease, background .16s ease; }
.lib-opt:not(.on):hover { border-color:var(--agent-coral, #FF8A65); transform:translateY(-1px); box-shadow:0 8px 18px -12px rgba(240,81,26,0.5); }
.lib-opt.on { color:#fff; border-color:transparent; background:var(--agent-btn-bg, linear-gradient(180deg, #FF7E57, #F0511A)); box-shadow:var(--agent-btn-shadow, 0 2px 0 rgba(0,0,0,0.22), 0 6px 16px rgba(var(--agent-coral-rgb),0.30), inset 0 1px 0 rgba(255,255,255,0.3)); }
.lib-opt-radio { width:15px; height:15px; border-radius:50%; flex-shrink:0; border:2px solid rgba(120,120,130,0.5); position:relative; }
.lib-opt.on .lib-opt-radio { border-color:#fff; }
.lib-opt.on .lib-opt-radio::after { content:""; position:absolute; inset:2px; border-radius:50%; background:#fff; }
`;

const TIER_LABEL: Record<Entry["tier"], string> = {
  core: "Core — the six you reach for most",
  support: "Supporting",
  pattern: "Patterns (compositions)",
};

export default function ButtonLibraryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const tiers: Entry["tier"][] = ["core", "support", "pattern"];

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 28px 110px", fontFamily: "var(--font-geist-sans, system-ui)", color: "var(--agent-text-primary, #2D1810)" }}>
      <style>{WELCOME_STEPS_CSS}</style>
      <style>{PW_SCOPE_CSS}</style>
      <style>{LIB_CSS}</style>

      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--agent-coral-deep, #E8542F)" }}>Dev · reference</p>
      <h1 style={{ margin: "8px 0 8px", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>Button library</h1>
      <div style={{ maxWidth: 680, fontSize: 14.5, lineHeight: 1.6, color: "var(--agent-text-secondary, #5A3A28)" }}>
        <p style={{ margin: "0 0 10px" }}>The canonical set. When you hit a wrong button in the app, say <strong>&ldquo;make this #3&rdquo;</strong> and it becomes that one. If the set doesn&rsquo;t cover what you need, we add a new <strong>#N</strong> — numbers never change, so a number always means the same button.</p>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted, rgba(45,24,16,0.55))" }}>Every specimen is the real class/component against the production gloss. Hover and press them — the states are live. Sizes are set with <span style={{ fontFamily: "ui-monospace,monospace" }}>agent-btn-xs/sm/md/lg</span> and never change when a button&rsquo;s look is swapped.</p>
      </div>

      {tiers.map((tier) => (
        <section key={tier} style={{ marginTop: 40 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 750, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-muted, rgba(45,24,16,0.5))" }}>{TIER_LABEL[tier]}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ENTRIES.filter((e) => e.tier === tier).map((e) => (
              <div key={e.n} style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 300px) 1fr", gap: 20, alignItems: "center", padding: "18px 20px", borderRadius: 16, background: "var(--agent-glass-bg, rgba(255,255,255,0.72))", border: "0.5px solid var(--agent-glass-border, rgba(45,24,16,0.10))", boxShadow: "0 2px 12px rgba(45,24,16,0.05)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: e.tier === "core" ? "var(--agent-coral-deep, #E8542F)" : "rgba(45,24,16,0.3)", fontVariantNumeric: "tabular-nums", textAlign: "center" }}>{e.n}</div>
                <div style={{ display: "flex", alignItems: "center", minHeight: 52, flexWrap: "wrap", gap: 10 }}>{e.specimen()}</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 750 }}>{e.name}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-secondary, #5A3A28)" }}>{e.when}</p>
                  <code style={{ display: "block", marginTop: 8, fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--agent-text-muted, rgba(45,24,16,0.6))", background: "rgba(45,24,16,0.05)", padding: "6px 9px", borderRadius: 7, overflowWrap: "anywhere" }}>{e.use}</code>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section style={{ marginTop: 44, padding: "16px 18px", borderRadius: 14, background: "rgba(240,81,26,0.06)", border: "0.5px solid rgba(240,81,26,0.2)", maxWidth: 680 }}>
        <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: "var(--agent-coral-deep, #C63E20)" }}>Adding a new one</p>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--agent-text-secondary, #5A3A28)" }}>Tell me &ldquo;add a button for X&rdquo; and I&rsquo;ll append it as the next number with a real class/component, then it&rsquo;s referenceable like the rest. Existing numbers never shift.</p>
      </section>
    </div>
  );
}
