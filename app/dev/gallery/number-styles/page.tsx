// Dev showcase — every "number / count badge" treatment on the agent (TSP /
// Sales Progressor) side, side by side, plus 10 completely distinct candidate
// styles to standardise onto. Pick one (say "go with 06") and the follow-up is
// a single <CountBadge tone size> primitive that replaces all the hand-rolled
// variants catalogued in the top half.
//
// Scope: agent app visual system only (sunset/coral theme via the gallery
// layout). Not the buyer/seller portal, Boardwalk, or Command Centre.
//
// Route: /dev/gallery/number-styles  (blocked in production below).

import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";

// ───────────────────────────────────────────────────────────────────────────
// Tone palette — the three semantic roles every count needs. Values map to the
// real agent tokens so the candidates read exactly as they would in-app.
// ───────────────────────────────────────────────────────────────────────────
type Tone = "accent" | "muted" | "danger";

const TONES: Record<Tone, {
  grad: string;      // gradient fill
  solid: string;     // solid fill
  deep: string;      // on-tint text colour
  tintRgb: string;   // rgb used for low-alpha tints
  shadowRgb: string; // rgb used for shadows / rings
}> = {
  accent: {
    grad: "linear-gradient(135deg, var(--agent-coral), var(--agent-coral-deep))",
    solid: "var(--agent-coral-deep)",
    deep: "var(--agent-coral-deep)",
    tintRgb: "var(--agent-coral-base-rgb)",
    shadowRgb: "var(--agent-coral-rgb)",
  },
  muted: {
    grad: "linear-gradient(135deg, #94a3b8, #64748b)",
    solid: "#64748b",
    deep: "#475569",
    tintRgb: "100, 116, 139",
    shadowRgb: "100, 116, 139",
  },
  danger: {
    grad: "linear-gradient(135deg, #E06A6A, var(--agent-danger))",
    solid: "var(--agent-danger)",
    deep: "var(--agent-danger)",
    tintRgb: "199, 62, 62",
    shadowRgb: "199, 62, 62",
  },
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

type BadgeOpts = { tone?: Tone; emphasis?: "strong" | "soft" };

// The 10 candidates. `id` is 1-based. Each returns self-contained inline-styled
// JSX so the winner is copy-paste-ready into a primitive.
function renderBadge(id: number, value: number | string, opts: BadgeOpts = {}) {
  const tone = opts.tone ?? "accent";
  const strong = (opts.emphasis ?? "strong") === "strong";
  const c = TONES[tone];
  const multi = String(value).length > 1;

  switch (id) {
    // 01 — Soft tint. Flat accent-tint pill, tone text. Quiet, brand-friendly.
    case 1:
      return (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: `rgba(${c.tintRgb}, ${strong ? 0.2 : 0.12})`, color: c.deep }}>{value}</span>
      );

    // 02 — Solid gradient. The current nav/work-queue recipe, refined. Bold, dimensional.
    case 2:
      return strong ? (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: c.grad, color: "#fff", boxShadow: `0 2px 8px rgba(${c.shadowRgb}, 0.42), inset 0 1px 0 rgba(255,255,255,0.45)` }}>{value}</span>
      ) : (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: `rgba(${c.tintRgb}, 0.14)`, color: c.deep }}>{value}</span>
      );

    // 03 — Flat solid. Solid fill, white text, no shadow. Modern, confident.
    case 3:
      return strong ? (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.solid, color: "#fff" }}>{value}</span>
      ) : (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: `rgba(${c.tintRgb}, 0.16)`, color: c.deep }}>{value}</span>
      );

    // 04 — Outline / ghost. Transparent, hairline tone border, tone text. Airy.
    case 4:
      return (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "transparent", border: `1.25px solid ${strong ? c.solid : `rgba(${c.tintRgb}, 0.5)`}`, color: c.deep }}>{value}</span>
      );

    // 05 — Ink. Neutral by default (ink on neutral tint); colour ONLY for urgent.
    //      Philosophy: a count is quiet until it needs you.
    case 5:
      return tone === "danger" ? (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: c.solid, color: "#fff" }}>{value}</span>
      ) : (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(45, 24, 16, 0.08)", color: strong ? "var(--agent-text-secondary)" : "var(--agent-text-muted)" }}>{value}</span>
      );

    // 06 — Dot + number. No enclosure: a tone dot leads a tabular number. Minimal.
    case 6:
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: tone === "muted" ? "var(--agent-text-secondary)" : c.deep, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: c.solid, boxShadow: tone === "danger" ? `0 0 0 3px rgba(${c.shadowRgb}, 0.18)` : undefined, flexShrink: 0 }} />
          {value}
        </span>
      );

    // 07 — Underline. Typographic: number with a tone underline, no pill. Editorial.
    case 7:
      return (
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--agent-text-primary)", borderBottom: `2px solid ${strong ? c.solid : `rgba(${c.tintRgb}, 0.45)`}`, paddingBottom: 1, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      );

    // 08 — Ring. Tint fill + inset hairline ring + faint lift. Tactile; echoes our
    //      hover-lift language.
    case 8:
      return (
        <span style={{ ...pillBase, minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: `rgba(${c.tintRgb}, ${strong ? 0.12 : 0.08})`, color: c.deep, boxShadow: `inset 0 0 0 1px rgba(${c.shadowRgb}, ${strong ? 0.3 : 0.18}), 0 1px 3px rgba(${c.shadowRgb}, 0.14)` }}>{value}</span>
      );

    // 09 — Micro superscript. Tiny solid dot-count, top-aligned. For nav/bell corners.
    case 9:
      return (
        <span style={{ ...pillBase, minWidth: 14, height: 14, padding: multi ? "0 4px" : 0, borderRadius: 999, fontSize: 9, fontWeight: 800, background: c.solid, color: "#fff", transform: "translateY(-1px)", boxShadow: `0 1px 3px rgba(${c.shadowRgb}, 0.4)` }}>{value}</span>
      );

    // 10 — Squared tag. Slight-radius mono tag, hairline border. Data/code aesthetic.
    case 10:
      return (
        <span style={{ ...pillBase, padding: "1px 6px", borderRadius: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", background: `rgba(${c.tintRgb}, ${strong ? 0.14 : 0.1})`, color: c.deep, border: `0.5px solid rgba(${c.shadowRgb}, 0.22)` }}>{value}</span>
      );

    default:
      return <span>{value}</span>;
  }
}

const CANDIDATES: { id: number; name: string; blurb: string }[] = [
  { id: 1, name: "Soft tint", blurb: "Flat accent-tint pill, tone text. Quiet and brand-friendly — unifies today's tab / to-do pills." },
  { id: 2, name: "Solid gradient", blurb: "Coral gradient, white text, soft shadow + sheen. Bold and dimensional — today's nav badge, made the standard." },
  { id: 3, name: "Flat solid", blurb: "Solid fill, white text, no shadow. Modern and confident; tints down when inactive." },
  { id: 4, name: "Outline", blurb: "Transparent with a hairline tone border. Airy, lowest visual weight." },
  { id: 5, name: "Ink", blurb: "Neutral by default, colour only when urgent. A count stays quiet until it needs you." },
  { id: 6, name: "Dot + number", blurb: "No enclosure — a tone dot leads a tabular number. Minimal, calm." },
  { id: 7, name: "Underline", blurb: "Number with a tone underline, no pill. Typographic and editorial." },
  { id: 8, name: "Ring", blurb: "Tint fill + inset hairline ring + faint lift. Tactile; echoes our hover-lift language." },
  { id: 9, name: "Micro superscript", blurb: "Tiny solid count, top-aligned. Smallest footprint — ideal for nav/bell corners." },
  { id: 10, name: "Squared tag", blurb: "Slight-radius mono tag with a hairline border. Data / code aesthetic, distinct from round pills." },
];

// ── Shared presentational helpers ───────────────────────────────────────────
function NavDemo({ id }: { id: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle, rgba(45,24,16,0.08))", maxWidth: 240 }}>
      <span style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(45,24,16,0.08)", flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Reminders</span>
      {renderBadge(id, 5, { tone: "accent", emphasis: "strong" })}
    </div>
  );
}

function TabDemo({ id }: { id: number }) {
  const tabs = [
    { label: "In chains", count: 20, active: true },
    { label: "Check-ins", count: 41, active: false },
    { label: "No chain", count: 17, active: false },
    { label: "Needs setup", count: 0, active: false },
  ];
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", borderBottom: "1px solid var(--agent-border-subtle, rgba(45,24,16,0.08))", flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <div
          key={t.label}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 12px", fontSize: 13,
            fontWeight: t.active ? 700 : 600,
            color: t.active ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
            borderBottom: t.active ? "2px solid var(--agent-coral-deep)" : "2px solid transparent",
            marginBottom: -1,
          }}
        >
          {t.label}
          <span style={{ opacity: t.count === 0 ? 0.4 : 1 }}>
            {renderBadge(id, t.count, { tone: "accent", emphasis: t.active ? "strong" : "soft" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function Strip({ id }: { id: number }) {
  const cell = (label: string, node: ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, minWidth: 54 }}>
      <div style={{ height: 22, display: "flex", alignItems: "center" }}>{node}</div>
      <div style={{ fontSize: 10, color: "var(--agent-text-muted)", fontWeight: 600, letterSpacing: "0.01em" }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      {cell("Large", renderBadge(id, 41, { tone: "accent" }))}
      {cell("Muted / auto", renderBadge(id, 8, { tone: "muted" }))}
      {cell("Urgent", renderBadge(id, 3, { tone: "danger" }))}
      {cell("99+", renderBadge(id, "99+", { tone: "accent" }))}
      {cell("Zero", <span style={{ opacity: 0.4 }}>{renderBadge(id, 0, { tone: "accent", emphasis: "soft" })}</span>)}
    </div>
  );
}

// ── Section A — today's variants, rendered with their REAL classes ───────────
function TodayCard({ name, where, shared, children }: { name: string; where: string; shared: "shared" | "hand-rolled" | "triplicated"; children: ReactNode }) {
  const tag = {
    shared: { label: "Shared class", bg: "rgba(31,138,74,0.12)", color: "#1F8A4A" },
    "hand-rolled": { label: "Hand-rolled", bg: "rgba(199,62,62,0.12)", color: "var(--agent-danger)" },
    triplicated: { label: "Hand-rolled ×3", bg: "rgba(199,62,62,0.14)", color: "var(--agent-danger)" },
  }[shared];
  return (
    <div style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle, rgba(45,24,16,0.08))", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{name}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: tag.bg, color: tag.color }}>{tag.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minHeight: 28 }}>{children}</div>
      <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{where}</div>
    </div>
  );
}

export default function NumberStylesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const h2: CSSProperties = { fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--agent-coral-deep)", margin: "0 0 4px" };

  return (
    <main style={{ minHeight: "100vh", padding: "56px 32px 120px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Header */}
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)", margin: "0 0 10px" }}>
          Number styles
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--agent-text-secondary)", maxWidth: 680, margin: "0 0 8px" }}>
          Every way we render a count on the agent side — nav badges, tab pills, the bell, section counts — and
          ten uniform candidates to replace them. Pick one and it becomes a single <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, background: "rgba(45,24,16,0.06)", padding: "1px 5px", borderRadius: 5 }}>&lt;CountBadge tone size /&gt;</code> that every surface routes through.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-muted)", maxWidth: 680, margin: 0 }}>
          Today there are ~9 distinct treatments: two gradient/tint recipes re-declared in 4+ places, the
          tab-count pill copy-pasted verbatim across 3 files, and one rogue red (the bell) hardcoded outside the
          danger token. No canonical count primitive exists.
        </p>

        {/* ── Section A — today ─────────────────────────────────────────── */}
        <div style={{ marginTop: 44 }}>
          <h2 style={h2}>What we have today</h2>
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 20px" }}>Rendered with the real in-app classes — this is the drift, not a mock.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            <TodayCard name="Sidebar nav badge" where="components/layout/AgentNavRail.tsx · .agent-rail-badge — coral gradient" shared="shared">
              <NavRailReal />
            </TodayCard>

            <TodayCard name="Notification bell" where="components/layout/AgentBell.tsx · inline Tailwind, literal bg-red-500" shared="hand-rolled">
              <BellReal />
            </TodayCard>

            <TodayCard name="Tab-count pill" where="ChainsWorkspace · PropertyFileTabs · FileTabsChrome — identical markup, 3 files" shared="triplicated">
              <TabPillReal />
            </TodayCard>

            <TodayCard name="To-Do tab count" where="components/agent/TodoTabs.tsx · .todotabs-count — flat tint" shared="shared">
              <span className="todotabs-count">7</span>
              <span className="todotabs-count">12</span>
            </TodayCard>

            <TodayCard name="Work-queue count" where="AgentRemindersList · .agent-wq-count — coral vs muted gradient" shared="shared">
              <span className="agent-wq-count agent-wq-count--coral">4</span>
              <span className="agent-wq-count agent-wq-count--muted">9</span>
            </TodayCard>

            <TodayCard name="Onboarding progress" where="OnboardingChecklist · .agent-progress-count — coral gradient N/M" shared="shared">
              <span className="agent-progress-count">7/12</span>
            </TodayCard>

            <TodayCard name="Segment-pill note" where="MilestonePanel + 40 sites · .agent-segment-pill-note — count inside a filter pill" shared="shared">
              <span className="agent-segment-pill on" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span>Done</span>
                <span className="agent-segment-pill-note">10/12</span>
              </span>
              <span className="agent-segment-pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span>Open</span>
                <span className="agent-segment-pill-note">2/12</span>
              </span>
            </TodayCard>
          </div>
        </div>

        {/* ── Section B — candidates ────────────────────────────────────── */}
        <div style={{ marginTop: 56 }}>
          <h2 style={h2}>Pick one — 10 candidates</h2>
          <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 24px" }}>
            Each shown across the real contexts: a nav row, a live tab bar (active + inactive + a zero), and the
            three tones with large / 99+ / zero states. Say &ldquo;go with 06&rdquo; and I&rsquo;ll build the primitive and migrate every consumer.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {CANDIDATES.map((s) => (
              <div key={s.id} style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle, rgba(45,24,16,0.08))", borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Heading */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "var(--agent-coral-deep)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{String(s.id).padStart(2, "0")}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>{s.name}</span>
                  <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)", flex: 1, minWidth: 220 }}>{s.blurb}</span>
                </div>

                {/* Contexts */}
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Caption>Nav</Caption>
                    <NavDemo id={s.id} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 320 }}>
                    <Caption>Tabs — active · inactive · zero</Caption>
                    <TabDemo id={s.id} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4, borderTop: "0.5px dashed var(--agent-border-subtle, rgba(45,24,16,0.10))" }}>
                  <Caption>Tones &amp; states</Caption>
                  <Strip id={s.id} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ marginTop: 48, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.55 }}>
          Scoped to the agent / Sales Progressor visual system (sunset theme shown; the accent token re-themes per
          agency). Next step once you choose: a <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>&lt;CountBadge&gt;</code> primitive with <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>tone</code> (accent / muted / danger) and <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>size</code>, then hand-migrate the nav badge, the 3 tab-pill copies, the bell, and the work-queue / to-do / progress counts onto it — one consumer per commit.
        </p>
      </div>
    </main>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>{children}</div>;
}

// ── Real-class reproductions for Section A ───────────────────────────────────
function NavRailReal() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(45,24,16,0.03)", maxWidth: 220, width: "100%" }}>
      <span style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(45,24,16,0.08)", flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Reminders</span>
      <span className="agent-rail-badge">5</span>
    </div>
  );
}

function BellReal() {
  return (
    <div style={{ position: "relative", width: 34, height: 34, borderRadius: 9, background: "rgba(45,24,16,0.04)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--agent-text-secondary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white px-1 leading-none">5</span>
    </div>
  );
}

function TabPillReal() {
  const pill = (count: number, isActive: boolean) => (
    <span
      className="text-xs rounded-full px-1.5 py-0.5 font-medium leading-none"
      style={isActive
        ? { background: "var(--agent-coral)", color: "var(--agent-text-on-coral, #fff)" }
        : { background: "rgba(var(--agent-coral-base-rgb),0.12)", color: "var(--agent-coral-deep)" }}
    >
      {count}
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>In chains {pill(20, true)}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>No chain {pill(17, false)}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>Needs setup {pill(0, false)}</span>
    </div>
  );
}
