"use client";
// /dev/design-system — TSP Liquid Glass showroom. Dev-only (blocks in production).
// Three areas: Foundations, Library (the accepted Updates reference set, awaiting
// formal sign-off) and Laboratory (ambitious experimental work for review). Every
// specimen is the REAL kit from components/liquid rendered live on the real
// AppBackground — no lookalikes, no static mockups. Nothing here writes data.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  MagnifyingGlass, Bell, Gear, House, PaperPlaneTilt, NotePencil, Check, ArrowRight,
  DotsThree, Copy, Trash, Sun, MoonStars, Sparkle, Command as CommandIcon, CaretRight,
  Student, ChartLine, Users, CalendarBlank,
} from "@phosphor-icons/react";
import { AppBackground } from "@/components/decor/AppBackground";
import {
  LiquidGlass, GlassCard, GlassPanel, GlassButton, GlassInput, GlassTextarea, Field,
  GlassSwitch, GlassSegmented, GlassChip, GlassSlider, GlassCheckbox, GlassRadioGroup,
  GlassBadge, StatusDot, GlassProgress, Skeleton, GlassTabs, GlassMenu, GlassMenuItem,
  MenuSep, GlassToast, GlassDock, DockButton, DockSep, GlassDialog, NavRail, NavItem,
  UserAvatar, ActorAvatar,
} from "@/components/liquid";

type Theme = "dark" | "light";

function Spec({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="ds-spec">
      <div className="ds-spec-head">
        <h3>{title}</h3>
        {note && <p>{note}</p>}
      </div>
      <div className="ds-spec-body">{children}</div>
    </section>
  );
}
function Row({ children }: { children: ReactNode }) { return <div className="ds-row">{children}</div>; }

export default function DesignSystem() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<Theme>("dark");
  const [area, setArea] = useState<"foundations" | "library" | "lab">("library");

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
    return () => { if (prev) html.setAttribute("data-theme", prev); else html.removeAttribute("data-theme"); };
  }, [theme]);

  // interactive state
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [seg, setSeg] = useState("week");
  const [tab, setTab] = useState("overview");
  const [slide, setSlide] = useState(62);
  const [chk, setChk] = useState(true);
  const [radio, setRadio] = useState("standard");
  const [chips, setChips] = useState<Record<string, boolean>>({ Freehold: true, Cash: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState(false);
  // lab
  const [cmd, setCmd] = useState(false);
  const [step, setStep] = useState(0);
  const [mat, setMat] = useState({ displace: 60, thickness: 18, aberration: 6, radius: 28 });

  const track = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget; const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const fireToast = () => { setToast(true); setTimeout(() => setToast(false), 2400); };

  return (
    <div className="lg-ds ds-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppBg />

      <div className="ds-wrap">
        <header className="ds-top">
          <div>
            <div className="ds-eyebrow"><Sparkle weight="fill" /> TSP Liquid Glass</div>
            <h1>Design system</h1>
            <p>The forward visual language. Foundations, the accepted reference library, and the experimental laboratory.</p>
          </div>
          <button className={`ds-theme ${theme === "light" ? "on" : ""}`} aria-label="Toggle theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="ds-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
          </button>
        </header>

        <div className="ds-areatabs">
          <GlassTabs value={area} onChange={(v) => setArea(v as typeof area)} tabs={[
            { value: "foundations", label: "Foundations" },
            { value: "library", label: "Library" },
            { value: "lab", label: "Laboratory" },
          ]} />
          {area === "lab" && <GlassBadge tone="warn">Experimental</GlassBadge>}
          {area === "library" && <GlassBadge tone="accent">Reference set · awaiting sign-off</GlassBadge>}
        </div>

        {/* ───────────── FOUNDATIONS ───────────── */}
        {area === "foundations" && (
          <div className="ds-sections">
            <Spec title="Colour & semantic tokens" note="Accent + semantics adapt per theme. Status uses a dot, never a loud pill.">
              <Row>
                {[["accent", "--lg-accent"], ["ok", "--lg-ok"], ["warn", "--lg-warn"], ["info", "--lg-info"], ["danger", "--lg-danger"]].map(([n, v]) => (
                  <div key={n} className="ds-swatch"><span style={{ background: `var(${v})` }} /><code>{n}</code></div>
                ))}
              </Row>
              <Row>
                <StatusDot tone="ok" label="Active" /><StatusDot tone="warn" label="On hold" /><StatusDot tone="info" label="Completed" /><StatusDot tone="neutral" label="Withdrawn" />
              </Row>
            </Spec>

            <Spec title="Typography" note="Sentence case. Hierarchy from weight, size and colour — not uppercase.">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 34, fontWeight: 780, letterSpacing: "-0.03em" }}>Display · 780</span>
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Heading · 700</span>
                <span style={{ fontSize: 15, fontWeight: 650 }}>Subheading · 650</span>
                <span style={{ fontSize: 13.5, fontWeight: 450, lineHeight: 1.5 }}>Body · 450. The quick brown fox jumps over the lazy dog.</span>
                <span style={{ fontSize: 11.5, color: "var(--lg-ink-3)" }}>Caption · muted</span>
              </div>
            </Spec>

            <Spec title="Radii & spacing">
              <Row>
                {[["xs", 8], ["sm", 12], ["md", 16], ["lg", 20], ["xl", 26]].map(([n, r]) => (
                  <div key={n} className="ds-radii"><span style={{ borderRadius: r as number }} /><code>{n} · {r}px</code></div>
                ))}
              </Row>
              <Row>
                {[4, 8, 12, 16, 24, 32].map((s) => <div key={s} className="ds-space"><span style={{ width: s, height: s }} /><code>{s}</code></div>)}
              </Row>
            </Spec>

            <Spec title="Glass materials" note="Refraction reserved for hero surfaces; lighter frost for small chrome; solid where density needs reading.">
              <Row>
                <LiquidGlass tint="var(--lg-glass-card)" radius={18} thickness={14} displace={30} aberration={1} className="ds-mat">Card</LiquidGlass>
                <LiquidGlass tint="var(--lg-glass-panel)" radius={18} thickness={12} displace={46} aberration={4} className="ds-mat">Panel</LiquidGlass>
                <LiquidGlass tint="var(--lg-glass-raised)" radius={18} thickness={18} displace={70} aberration={10} className="ds-mat">Raised</LiquidGlass>
              </Row>
            </Spec>

            <Spec title="Motion & easing" note="Spring for selection/entry; ease for surfaces. Honours prefers-reduced-motion.">
              <Row>
                <code className="ds-token">--lg-spring</code><code className="ds-token">--lg-ease</code>
                <code className="ds-token">fast 0.2s</code><code className="ds-token">mid 0.35s</code><code className="ds-token">slow 0.5s</code>
              </Row>
            </Spec>
          </div>
        )}

        {/* ───────────── LIBRARY ───────────── */}
        {area === "library" && (
          <div className="ds-sections">
            <Spec title="Buttons" note="Primary, secondary, subtle, ghost, danger. Three sizes, icon, loading and disabled.">
              <Row>
                <GlassButton variant="primary">Primary</GlassButton>
                <GlassButton variant="secondary">Secondary</GlassButton>
                <GlassButton variant="subtle">Subtle</GlassButton>
                <GlassButton variant="ghost">Ghost</GlassButton>
                <GlassButton variant="danger">Remove</GlassButton>
              </Row>
              <Row>
                <GlassButton variant="primary" size="sm">Small</GlassButton>
                <GlassButton variant="primary" size="lg">Large</GlassButton>
                <GlassButton variant="secondary" icon aria-label="Bell"><Bell weight="fill" /></GlassButton>
                <GlassButton variant="primary" loading>Saving</GlassButton>
                <GlassButton variant="secondary" disabled>Disabled</GlassButton>
                <GlassButton variant="primary">Open file <ArrowRight weight="bold" /></GlassButton>
              </Row>
            </Spec>

            <Spec title="Inputs & selection">
              <div className="ds-grid2">
                <Field label="Search"><GlassInput leading={<MagnifyingGlass weight="regular" />} placeholder="Search by address" /></Field>
                <Field label="Note"><GlassTextarea placeholder="What happened?" /></Field>
                <Field label="Error state" error="Enter a valid amount"><GlassInput defaultValue="abc" error /></Field>
                <div>
                  <label className="lglabel">Switches</label>
                  <Row><GlassSwitch checked={sw1} onChange={setSw1} /><GlassSwitch checked={sw2} onChange={setSw2} /><GlassSwitch checked={false} onChange={() => {}} disabled /></Row>
                </div>
                <div>
                  <label className="lglabel">Segmented</label>
                  <GlassSegmented value={seg} onChange={setSeg} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
                </div>
                <div>
                  <label className="lglabel">Slider · {slide}%</label>
                  <GlassSlider value={slide} onChange={setSlide} />
                </div>
                <div>
                  <label className="lglabel">Checkbox & radio</label>
                  <Row><GlassCheckbox checked={chk} onChange={setChk}>Copy solicitor</GlassCheckbox></Row>
                  <div style={{ marginTop: 10 }}><GlassRadioGroup value={radio} onChange={setRadio} options={[{ value: "standard", label: "Standard" }, { value: "priority", label: "Priority" }]} /></div>
                </div>
                <div>
                  <label className="lglabel">Filter chips</label>
                  <Row>{Object.keys(chips).map((c) => <GlassChip key={c} pressed={chips[c]} onClick={() => setChips((s) => ({ ...s, [c]: !s[c] }))}>{c}</GlassChip>)}</Row>
                </div>
              </div>
            </Spec>

            <Spec title="Status, progress & skeletons">
              <Row><GlassBadge tone="ok">Active</GlassBadge><GlassBadge tone="warn">On hold</GlassBadge><GlassBadge tone="accent">New</GlassBadge><GlassBadge tone="danger">Overdue</GlassBadge><GlassBadge tone="neutral">Draft</GlassBadge></Row>
              <div style={{ maxWidth: 320, marginTop: 14 }}><GlassProgress value={slide} /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, maxWidth: 360 }}>
                <Skeleton w="40%" /><Skeleton w="72%" /><Skeleton w="56%" />
              </div>
            </Spec>

            <Spec title="Avatars" note="Real TSP avatars: photo when present, else branded side-tinted art (staff coral, seller blue, buyer green, solicitor grey).">
              <Row>
                <UserAvatar user={{ name: "Ellis Askey", image: PHOTO }} size={40} />
                <UserAvatar user={{ name: "Priya Shah" }} size={40} />
                <ActorAvatar name="Margaret Hill" role="seller" size={40} />
                <ActorAvatar name="James Okafor" role="buyer" size={40} />
                <ActorAvatar name="Duggan & Co" role="solicitor" size={40} />
              </Row>
            </Spec>

            <Spec title="Navigation">
              <div className="ds-grid2">
                <div>
                  <label className="lglabel">Tabs</label>
                  <GlassTabs value={tab} onChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "timeline", label: "Timeline" }, { value: "docs", label: "Documents" }]} />
                </div>
                <div>
                  <label className="lglabel">Nav rail</label>
                  <div style={{ maxWidth: 220 }}>
                    <NavRail>
                      <NavItem icon={<House weight="fill" />} active>Hub</NavItem>
                      <NavItem icon={<ChartLine weight="fill" />}>Updates</NavItem>
                      <NavItem icon={<Users weight="fill" />}>People</NavItem>
                      <NavItem icon={<Gear weight="fill" />}>Settings</NavItem>
                    </NavRail>
                  </div>
                </div>
              </div>
            </Spec>

            <Spec title="Overlays & contextual actions">
              <Row>
                <GlassButton variant="primary" onClick={() => setDialog(true)}>Open dialog</GlassButton>
                <GlassButton variant="secondary" onClick={fireToast}>Fire toast</GlassButton>
                <div style={{ position: "relative" }}>
                  <GlassButton variant="secondary" icon aria-label="More" onClick={() => setMenuOpen((v) => !v)}><DotsThree weight="bold" /></GlassButton>
                  {menuOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 20 }}>
                      <GlassMenu>
                        <GlassMenuItem icon={<Copy weight="bold" />} onClick={() => setMenuOpen(false)}>Copy link</GlassMenuItem>
                        <GlassMenuItem icon={<PaperPlaneTilt weight="bold" />} onClick={() => setMenuOpen(false)}>Send update</GlassMenuItem>
                        <MenuSep />
                        <GlassMenuItem icon={<Trash weight="bold" />} danger onClick={() => setMenuOpen(false)}>Remove</GlassMenuItem>
                      </GlassMenu>
                    </div>
                  )}
                </div>
              </Row>
            </Spec>

            <Spec title="Property header & update row" note="TSP patterns: address is the hero, status is a dot, progress is a hairline. Avatar/text/time centre on single-line rows.">
              <GlassCard radius={18} className="ds-txcard" onPointerMove={track}>
                <div className="ds-txhead">
                  <span className="ds-marker"><House weight="regular" /></span>
                  <span className="ds-addr"><strong>14 Bushey Avenue</strong><em>Broxbourne, EN10 6QE</em></span>
                  <span className="ds-meta"><StatusDot tone="ok" label="Active · 62%" /><span>Enquiries · about 11 days to exchange</span></span>
                  <span className="ds-prog"><span style={{ width: "62%" }} /></span>
                </div>
                <div className="ds-row1">
                  <span className="ds-lead"><UserAvatar user={{ name: "Ellis Askey", image: PHOTO }} size={30} /></span>
                  <p>You confirmed all enquiries have been raised with the seller's solicitor.</p>
                  <time>18m ago</time>
                </div>
              </GlassCard>
            </Spec>
          </div>
        )}

        {/* ───────────── LABORATORY ───────────── */}
        {area === "lab" && (
          <div className="ds-sections">
            <Spec title="Material playground" note="Experimental. Drag to tune the live glass. These knobs map to the LiquidGlass engine props.">
              <div className="ds-grid2">
                <LiquidGlass tint="var(--lg-glass-raised)" radius={mat.radius} thickness={mat.thickness} displace={mat.displace} aberration={mat.aberration} className="ds-playglass" onPointerMove={track}>
                  <Sparkle weight="fill" /> Liquid
                </LiquidGlass>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {([["displace", 0, 120], ["thickness", 4, 40], ["aberration", 0, 16], ["radius", 8, 60]] as const).map(([k, mn, mx]) => (
                    <div key={k}>
                      <label className="lglabel" style={{ textTransform: "capitalize" }}>{k} · {mat[k]}</label>
                      <GlassSlider value={mat[k]} min={mn} max={mx} onChange={(v) => setMat((m) => ({ ...m, [k]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            </Spec>

            <Spec title="Command menu (⌘K)" note="Experimental. A glass command palette for quick navigation and actions.">
              <GlassButton variant="secondary" onClick={() => setCmd(true)}><CommandIcon weight="bold" /> Open command menu</GlassButton>
            </Spec>

            <Spec title="Multi-step form" note="Experimental. Spring-advancing steps with a progress rail — one presentation for longer flows.">
              <GlassPanel radius={18} className="ds-steps">
                <div className="ds-steprail">{[0, 1, 2].map((i) => <span key={i} data-on={i <= step} />)}</div>
                <h4>{["Choose a sale", "Write the update", "Review"][step]}</h4>
                <p>{["Pick the file this update belongs to.", "Say what happened in plain English.", "Confirm and we'll show you the preview."][step]}</p>
                <Row>
                  <GlassButton variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</GlassButton>
                  <GlassButton variant="primary" onClick={() => setStep((s) => Math.min(2, s + 1))}>{step === 2 ? "Done" : "Next"}</GlassButton>
                </Row>
              </GlassPanel>
            </Spec>

            <Spec title="TSP patterns" note="Experimental domain components: sale progress, chain status, milestone stepper, vendor/purchaser.">
              <Row>
                <div className="ds-ring" style={{ ["--p" as string]: "72" }}><span>72%</span></div>
                <GlassPanel radius={16} className="ds-chain">
                  {["You", "Buyer", "Onward", "Top"].map((l, i) => (
                    <span key={l} className="ds-link" data-on={i < 2}><i /><em>{l}</em></span>
                  ))}
                </GlassPanel>
              </Row>
              <div className="ds-stepper">
                {["Instructed", "Searches", "Enquiries", "Exchange", "Completion"].map((s, i) => (
                  <span key={s} className="ds-mstep" data-state={i < 2 ? "done" : i === 2 ? "now" : "todo"}>
                    <i>{i < 2 ? <Check weight="bold" /> : i + 1}</i><em>{s}</em>
                  </span>
                ))}
              </div>
              <Row>
                <span className="ds-side" data-side="vendor"><Student weight="fill" /> Seller’s side</span>
                <span className="ds-side" data-side="purchaser"><Users weight="fill" /> Buyer’s side</span>
              </Row>
            </Spec>
          </div>
        )}

        <footer className="ds-foot">
          Showroom of the real <code>components/liquid</code> kit on the real TSP backgrounds. Nothing here writes data or
          changes production. Statuses are tracked in <code>docs/reference/design-system/INVENTORY.md</code>.
        </footer>
      </div>

      {/* floating action dock — demonstrates the pattern from the Updates prototype */}
      <div className="ds-dock-wrap">
        <GlassDock>
          <DockButton icon={<NotePencil weight="regular" />} onClick={fireToast}>New note</DockButton>
          <DockSep />
          <DockButton icon={<PaperPlaneTilt weight="regular" />} onClick={fireToast}>New email</DockButton>
        </GlassDock>
      </div>

      <GlassDialog open={dialog} onClose={() => setDialog(false)}>
        <div className="ds-eyebrow sm"><Sparkle weight="fill" /> Confirm</div>
        <h3 style={{ fontSize: 19, fontWeight: 720, margin: "10px 0 6px" }}>Move to exchange?</h3>
        <p style={{ fontSize: 14, color: "var(--lg-ink-2)", lineHeight: 1.5 }}>This notifies both solicitors and the buyer and seller that you&apos;re ready to exchange contracts.</p>
        <Row><GlassButton variant="primary" onClick={() => setDialog(false)}>Confirm <Check weight="bold" /></GlassButton><GlassButton variant="ghost" onClick={() => setDialog(false)}>Cancel</GlassButton></Row>
      </GlassDialog>

      {cmd && (
        <div className="lg-ds-overlay" style={{ alignItems: "flex-start", paddingTop: "12vh" }} onClick={() => setCmd(false)}>
          <LiquidGlass tint="var(--lg-glass-raised)" radius={18} thickness={14} displace={40} aberration={3} className="ds-cmd" onClick={(e) => e.stopPropagation()}>
            <div className="lgfield" style={{ marginBottom: 6 }}><MagnifyingGlass weight="bold" /><input autoFocus placeholder="Type a command or search…" /></div>
            {[[ArrowRight, "Go to a file", "G F"], [PaperPlaneTilt, "Send client update", "U"], [Users, "Add a person", "A P"], [CalendarBlank, "Book a call", "C"]].map(([Ic, t, k], i) => {
              const Icon = Ic as typeof ArrowRight;
              return <button key={i} className="lgmenu-item" onClick={() => setCmd(false)}><Icon weight="bold" /><span style={{ flex: 1 }}>{t as string}</span><kbd className="ds-kbd">{k as string}</kbd></button>;
            })}
          </LiquidGlass>
        </div>
      )}

      {toast && (
        <div className="ds-toast-wrap">
          <GlassToast icon={<Check weight="bold" />}>Done (simulated)</GlassToast>
        </div>
      )}
    </div>
  );
}

// Real TSP background, theme-synced via <html data-theme>.
function AppBg() {
  return (
    <>
      <AppBackground />
      <div className="ds-scene" aria-hidden />
    </>
  );
}

const PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' fill='#6b8cc7'/><circle cx='40' cy='33' r='15' fill='#f3cda8'/><path d='M13 80c0-17 13-25 27-25s27 8 27 25z' fill='#f3cda8'/><path d='M23 31c0-16 34-16 34 0 0-6-4-14-17-14s-17 8-17 14z' fill='#4a3426'/></svg>"
);

const CSS = `
.ds-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background-color:var(--lg-base); }
.ds-scene{ position:absolute; inset:0; z-index:0; pointer-events:none;
  background:radial-gradient(60% 40% at 15% 10%, rgba(56,225,255,0.08), transparent 70%), radial-gradient(50% 35% at 85% 90%, rgba(168,255,96,0.05), transparent 70%); }
.lg-ds[data-theme="light"] .ds-scene{ background:radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%), radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%), radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%), radial-gradient(85% 60% at 50% 96%, rgba(255,208,176,0.30), transparent 75%); }

.ds-wrap{ position:relative; z-index:2; max-width:1000px; margin:0 auto; padding:52px 24px 150px; }
.ds-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:26px; }
.ds-eyebrow{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--lg-accent-ink); margin-bottom:9px; } .ds-eyebrow svg{ width:15px; height:15px; } .ds-eyebrow.sm{ font-size:11px; }
.ds-top h1{ font-size:clamp(30px,4vw,42px); font-weight:780; letter-spacing:-.035em; line-height:1; }
.ds-top p{ font-size:15px; color:var(--lg-ink-2); margin-top:9px; max-width:560px; }
.ds-theme{ width:52px; height:31px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; flex-shrink:0; }
.ds-theme.on{ background:var(--lg-accent-soft); }
.ds-theme-knob{ position:absolute; top:2px; left:2px; width:25px; height:25px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.3); transition:transform .4s var(--lg-spring); } .ds-theme-knob svg{ width:13px; height:13px; color:#33343c; }
.ds-theme.on .ds-theme-knob{ transform:translateX(21px); }

.ds-areatabs{ display:flex; align-items:center; gap:12px; margin-bottom:22px; flex-wrap:wrap; }
.ds-sections{ display:flex; flex-direction:column; gap:16px; }
.ds-spec{ padding:4px 0; }
.ds-spec-head h3{ font-size:16px; font-weight:700; letter-spacing:-.01em; }
.ds-spec-head p{ font-size:12.5px; color:var(--lg-ink-3); margin-top:3px; max-width:620px; line-height:1.45; }
.ds-spec-body{ margin-top:14px; padding:18px; border-radius:16px; border:1px solid var(--lg-line-2); background:var(--lg-hover); }
.ds-row{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.ds-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:20px; }
@media (max-width:760px){ .ds-grid2{ grid-template-columns:1fr; } }

.ds-swatch{ display:flex; flex-direction:column; gap:6px; align-items:center; } .ds-swatch span{ width:52px; height:52px; border-radius:12px; box-shadow:inset 0 0 0 1px var(--lg-line); } .ds-swatch code,.ds-radii code,.ds-space code,.ds-token{ font-family:ui-monospace,monospace; font-size:11px; color:var(--lg-ink-2); }
.ds-radii{ display:flex; flex-direction:column; gap:6px; align-items:center; } .ds-radii span{ width:52px; height:52px; background:var(--lg-fill); border:1px solid var(--lg-line); }
.ds-space{ display:flex; flex-direction:column; gap:6px; align-items:center; } .ds-space span{ background:var(--lg-accent); border-radius:3px; }
.ds-token{ padding:4px 9px; border-radius:7px; background:var(--lg-fill); }
.ds-mat{ width:120px; height:80px; display:grid; place-items:center; font-size:13px; font-weight:600; }
.ds-playglass{ min-height:150px; display:grid; place-items:center; gap:6px; font-size:16px; font-weight:650; } .ds-playglass svg{ width:20px; height:20px; color:var(--lg-accent); }

/* property card specimen */
.ds-txcard{ overflow:hidden; }
.ds-txhead{ display:flex; align-items:flex-start; gap:13px; padding:14px 16px 17px; position:relative; }
.ds-marker{ width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); } .ds-marker svg{ width:18px; height:18px; color:var(--lg-ink-2); }
.ds-addr{ flex:1; min-width:0; } .ds-addr strong{ display:block; font-size:15px; font-weight:650; } .ds-addr em{ display:block; font-style:normal; font-size:12px; color:var(--lg-ink-3); }
.ds-meta{ display:flex; flex-direction:column; align-items:flex-end; gap:3px; text-align:right; } .ds-meta > span:last-child{ font-size:11px; color:var(--lg-ink-3); }
.ds-prog{ position:absolute; left:0; right:0; bottom:0; height:2px; background:var(--lg-line-2); } .ds-prog > span{ display:block; height:100%; opacity:.85; background:linear-gradient(90deg,var(--lg-accent),#5ac8fa); }
.ds-row1{ display:flex; align-items:flex-start; gap:12px; padding:13px 16px; border-top:1px solid var(--lg-line-2); }
.ds-lead{ flex-shrink:0; height:20px; display:flex; align-items:center; } .ds-row1 p{ flex:1; font-size:13.5px; line-height:20px; } .ds-row1 time{ font-size:11px; color:var(--lg-ink-3); line-height:20px; }

/* lab: steps */
.ds-steps{ padding:20px; max-width:420px; } .ds-steps h4{ font-size:16px; font-weight:700; margin:10px 0 4px; } .ds-steps p{ font-size:13px; color:var(--lg-ink-2); margin-bottom:16px; }
.ds-steprail{ display:flex; gap:6px; } .ds-steprail span{ flex:1; height:4px; border-radius:2px; background:var(--lg-line); transition:background .3s; } .ds-steprail span[data-on="true"]{ background:var(--lg-accent); }

/* lab: TSP patterns */
.ds-ring{ --p:72; width:90px; height:90px; border-radius:50%; display:grid; place-items:center; background:radial-gradient(closest-side, var(--lg-base) 76%, transparent 78%), conic-gradient(var(--lg-accent) calc(var(--p)*1%), var(--lg-fill) 0); } .ds-ring span{ font-size:19px; font-weight:750; }
.ds-chain{ display:flex; gap:4px; padding:12px 14px; } .ds-link{ display:flex; flex-direction:column; align-items:center; gap:5px; } .ds-link i{ width:30px; height:6px; border-radius:3px; background:var(--lg-line); } .ds-link[data-on="true"] i{ background:var(--lg-accent); } .ds-link em{ font-style:normal; font-size:10.5px; color:var(--lg-ink-3); }
.ds-stepper{ display:flex; gap:6px; margin-top:16px; flex-wrap:wrap; } .ds-mstep{ display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; min-width:64px; } .ds-mstep i{ width:28px; height:28px; border-radius:50%; display:grid; place-items:center; font-size:12px; font-weight:700; background:var(--lg-fill); color:var(--lg-ink-2); } .ds-mstep i svg{ width:14px; height:14px; } .ds-mstep[data-state="done"] i{ background:var(--lg-ok); color:#fff; } .ds-mstep[data-state="now"] i{ background:var(--lg-accent); color:#fff; } .ds-mstep em{ font-style:normal; font-size:10.5px; color:var(--lg-ink-3); text-align:center; }
.ds-side{ display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600; padding:6px 12px; border-radius:999px; } .ds-side svg{ width:14px; height:14px; } .ds-side[data-side="vendor"]{ background:rgba(94,92,230,0.16); color:#9a98ff; } .ds-side[data-side="purchaser"]{ background:rgba(48,200,160,0.16); color:#3fe0c0; }

/* command menu */
.ds-cmd{ width:min(560px,100%); padding:14px; } .ds-cmd .lgmenu-item kbd{ margin-left:auto; } .ds-kbd{ font-size:11px; font-weight:700; padding:3px 7px; border-radius:6px; background:var(--lg-fill); color:var(--lg-ink-3); }

.ds-dock-wrap{ position:fixed; z-index:40; bottom:24px; left:50%; transform:translateX(-50%); }
.ds-toast-wrap{ position:fixed; z-index:70; bottom:92px; left:50%; transform:translateX(-50%); }
.ds-foot{ margin-top:34px; font-size:11.5px; color:var(--lg-ink-3); line-height:1.6; } .ds-foot code{ font-family:ui-monospace,monospace; background:var(--lg-fill); padding:1px 6px; border-radius:6px; }
`;
