"use client";

// Icon audit + recommendation surface. Long page, sectioned by concept.
// Each card shows the icon AT PRODUCTION SIZE plus a "real-world context"
// preview — a faux replica of how the icon appears in the live app
// (sidebar row, banner, button, role badge, etc) so Ellis can judge each
// pick against its actual usage rather than against a blank canvas.

import type { Icon } from "@phosphor-icons/react";
import {
  // Navigation
  Gauge, Tray, CalendarCheck, CheckSquare, BellSimple, EnvelopeSimple,
  Envelope, FolderOpen, ChartBar, Buildings, GearSix,
  // Status / state
  CheckCircle, Circle, XCircle, Warning, WarningCircle, Info,
  // Disclosure
  CaretDown, CaretUp, CaretLeft, CaretRight, ArrowRight, ArrowSquareOut,
  // Action
  X, Plus, PlusCircle, Pencil, PencilSimple, Trash, Copy,
  UserPlus, Eye, EyeSlash, Funnel, MagnifyingGlass, List,
  // Communication
  ChatText, PaperPlaneTilt, Sparkle, CircleNotch,
  // Time
  Clock, ClockCountdown, ArrowsClockwise, ClockCounterClockwise,
  // Theme
  Moon,
  // Entity
  HouseLine, ListChecks, Crown, Receipt, Leaf, House, User,
  // Role universals + alternatives
  Storefront, ShoppingBag, Tag, SignOut, SignIn, Target,
  Briefcase, Scales, BookOpen, Gavel,
  ChartLineUp, HandCoins, Bank, Calculator,
  UserCircle, IdentificationCard, UserSquare, IdentificationBadge,
  // Drift alternatives
  Siren, ArrowFatUp, SquaresFour, Compass,
} from "@phosphor-icons/react";

// ─── Icon registry — for dynamic name → component lookup ─────────────────

const ICON: Record<string, Icon> = {
  Gauge, Tray, CalendarCheck, CheckSquare, BellSimple, EnvelopeSimple, Envelope,
  FolderOpen, ChartBar, Buildings, GearSix,
  CheckCircle, Circle, XCircle, Warning, WarningCircle, Info,
  CaretDown, CaretUp, CaretLeft, CaretRight, ArrowRight, ArrowSquareOut,
  X, Plus, PlusCircle, Pencil, PencilSimple, Trash, Copy,
  UserPlus, Eye, EyeSlash, Funnel, MagnifyingGlass, List,
  ChatText, PaperPlaneTilt, Sparkle, CircleNotch,
  Clock, ClockCountdown, ArrowsClockwise, ClockCounterClockwise,
  Moon,
  HouseLine, ListChecks, Crown, Receipt, Leaf, House, User,
  Storefront, ShoppingBag, Tag, SignOut, SignIn, Target,
  Briefcase, Scales, BookOpen, Gavel,
  ChartLineUp, HandCoins, Bank, Calculator,
  UserCircle, IdentificationCard, UserSquare, IdentificationBadge,
  Siren, ArrowFatUp, SquaresFour, Compass,
};

function IconByName({ name, size = 18, weight = "regular" }: { name: string; size?: number; weight?: "regular" | "bold" | "fill" }) {
  const Cmp = ICON[name];
  if (!Cmp) return <span style={{ fontSize: size }}>?</span>;
  return <Cmp size={size} weight={weight} />;
}

// ─── Status tag ──────────────────────────────────────────────────────────

type Status = "keep" | "swap" | "new" | "drift";

const STATUS_META: Record<Status, { label: string; bg: string; color: string }> = {
  keep:  { label: "KEEP",       bg: "rgba(31, 138, 74, 0.14)",  color: "#1F8A4A" },
  swap:  { label: "SWAP",       bg: "rgba(201, 125, 26, 0.16)", color: "#C97D1A" },
  new:   { label: "NEW",        bg: "rgba(61, 122, 184, 0.14)", color: "#3D7AB8" },
  drift: { label: "DRIFT FIX",  bg: "rgba(199, 62, 62, 0.14)",  color: "#C73E3E" },
};

function StatusTag({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 4,
        letterSpacing: "0.05em",
        background: m.bg,
        color: m.color,
        flexShrink: 0,
      }}
    >
      {m.label}
    </span>
  );
}

// ─── Real-world context previews ─────────────────────────────────────────
// Each one mimics the layout the icon ACTUALLY appears in, so picks can be
// judged in situ rather than against a blank canvas.

function NavRowPreview({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 12px",
        borderRadius: 10,
        background: active ? "rgba(255, 107, 74, 0.10)" : "transparent",
        color: active ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        width: 180,
      }}
    >
      <IconByName name={icon} size={18} />
      <span>{label}</span>
    </div>
  );
}

function BannerPreview({ icon, kind, title, body }: { icon: string; kind: "info" | "warning" | "danger" | "success"; title: string; body: string }) {
  const tint: Record<typeof kind, string> = {
    info:    "var(--agent-info)",
    warning: "var(--agent-warning)",
    danger:  "var(--agent-danger)",
    success: "var(--agent-success)",
  };
  const border: Record<typeof kind, string> = {
    info:    "var(--agent-info-border-strong)",
    warning: "var(--agent-warning-border-strong)",
    danger:  "var(--agent-danger-border-strong)",
    success: "var(--agent-success-border-strong)",
  };
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.90)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${border[kind]}`,
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span style={{ color: tint[kind], display: "flex", marginTop: 1, flexShrink: 0 }}>
        <IconByName name={icon} size={16} weight="fill" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: tint[kind], lineHeight: 1.35 }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>{body}</p>
      </div>
    </div>
  );
}

function ButtonPreview({ icon, label, variant = "secondary" }: { icon: string; label: string; variant?: "primary" | "secondary" | "ghost" | "icon" }) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: variant === "icon" ? "6px" : "6px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid transparent",
  };
  const variants: Record<typeof variant, React.CSSProperties> = {
    primary:   { ...base, background: "var(--agent-coral-deep)", color: "#fff" },
    secondary: { ...base, background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)", border: "1px solid rgba(15,23,42,0.10)" },
    ghost:     { ...base, background: "transparent", color: "var(--agent-text-secondary)" },
    icon:      { ...base, background: "rgba(15,23,42,0.04)", color: "var(--agent-text-secondary)" },
  };
  return (
    <span style={variants[variant]}>
      <IconByName name={icon} size={variant === "icon" ? 14 : 12} weight={variant === "primary" ? "bold" : "regular"} />
      {variant !== "icon" && <span>{label}</span>}
    </span>
  );
}

function PillPreview({ icon, label, tone }: { icon: string; label: string; tone: "vendor" | "purchaser" | "neutral" }) {
  const palette: Record<typeof tone, { bg: string; fg: string }> = {
    vendor:    { bg: "#fff3e0", fg: "#ea580c" },
    purchaser: { bg: "#e0f2fe", fg: "#0369a1" },
    neutral:   { bg: "rgba(15,23,42,0.06)", fg: "var(--agent-text-secondary)" },
  };
  const p = palette[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4,
      background: p.bg, color: p.fg,
      fontSize: 11, fontWeight: 600,
      letterSpacing: "0.03em",
    }}>
      <IconByName name={icon} size={12} weight="fill" />
      <span>{label}</span>
    </span>
  );
}

function SectionHeaderPreview({ icon, label, tone = "neutral" }: { icon: string; label: string; tone?: "vendor" | "purchaser" | "neutral" }) {
  const colour = tone === "vendor" ? "#ea580c" : tone === "purchaser" ? "#0369a1" : "var(--agent-text-primary)";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 0",
      color: colour,
      fontSize: 13, fontWeight: 600,
    }}>
      <IconByName name={icon} size={16} />
      <span>{label}</span>
    </div>
  );
}

function ContactInlinePreview({ icon, name, tone }: { icon: string; name: string; tone: "vendor" | "purchaser" | "neutral" }) {
  const colour = tone === "vendor" ? "#ea580c" : tone === "purchaser" ? "#0369a1" : "var(--agent-text-muted)";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12,
      color: "var(--agent-text-primary)",
    }}>
      <span style={{ color: colour, display: "flex" }}>
        <IconByName name={icon} size={14} />
      </span>
      <span>{name}</span>
    </div>
  );
}

function DisclosureRowPreview({ caret, label }: { caret: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px",
      background: "var(--agent-surface-elevated)",
      border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 8,
      width: 180,
      fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)",
    }}>
      <span>{label}</span>
      <span style={{ color: "var(--agent-text-muted)", display: "flex" }}>
        <IconByName name={caret} size={12} weight="bold" />
      </span>
    </div>
  );
}

function ChipPreview({ icon }: { icon: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 28, height: 28, borderRadius: 6,
      background: "rgba(15,23,42,0.05)",
      color: "var(--agent-text-secondary)",
    }}>
      <IconByName name={icon} size={16} />
    </span>
  );
}

// ─── Card components ────────────────────────────────────────────────────

function AlternativesRow({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
        Alternatives
      </span>
      {names.map((n) => (
        <div key={n} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: "rgba(15,23,42,0.04)", border: "0.5px solid rgba(15,23,42,0.08)" }}>
          <IconByName name={n} size={14} />
          <span style={{ fontSize: 11, color: "var(--agent-text-secondary)" }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

function IconCard({
  status,
  name,
  weight = "regular",
  size = 24,
  context,
  recommendation,
  alternatives,
  preview,
}: {
  status: Status;
  name: string;
  weight?: "regular" | "bold" | "fill";
  size?: number;
  context: string;          // where it's used in the live app
  recommendation: string;   // "Keep" / "Swap to Storefront" / "New — adds X" / etc
  alternatives: string[];   // icon names
  preview: React.ReactNode; // real-world context replica
}) {
  return (
    <div style={{
      background: "var(--agent-surface-elevated)",
      border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 12,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 8, background: "rgba(15,23,42,0.04)" }}>
            <IconByName name={name} size={size} weight={weight} />
          </span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{weight !== "regular" ? `weight: ${weight} · ` : ""}size: {size}px</p>
          </div>
        </div>
        <StatusTag status={status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
          Currently
        </span>
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)" }}>{context}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
          In context
        </span>
        <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>{preview}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
          Recommendation
        </span>
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-primary)", fontWeight: 500 }}>{recommendation}</p>
      </div>

      {alternatives.length > 0 && <AlternativesRow names={alternatives} />}
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 24 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>{title}</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--agent-text-secondary)" }}>{intro}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Toc() {
  const items = [
    { id: "legend", label: "Legend" },
    { id: "nav", label: "Navigation" },
    { id: "status", label: "Status & state" },
    { id: "disclosure", label: "Disclosure & expand" },
    { id: "action", label: "Actions" },
    { id: "comms", label: "Communication" },
    { id: "time", label: "Time & cadence" },
    { id: "entity", label: "Entities & misc" },
    { id: "roles", label: "NEW — Role universals" },
    { id: "drift", label: "Drift fixes" },
    { id: "style", label: "Style summary" },
  ];
  return (
    <nav style={{
      position: "sticky", top: 16,
      background: "var(--agent-surface-elevated)",
      border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 10,
      padding: "10px 14px",
      marginBottom: 24,
      display: "flex", flexWrap: "wrap", gap: 6,
      fontSize: 12,
    }}>
      <span style={{ fontWeight: 700, color: "var(--agent-text-muted)", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.05em", marginRight: 4 }}>Jump to</span>
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`} style={{ color: "var(--agent-coral-deep)", textDecoration: "none", fontWeight: 500 }}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────

export function IconAuditView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Toc />

      {/* Legend */}
      <section id="legend">
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)" }}>Legend</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusTag status="keep" /> <span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>current icon stays; alternatives are FYI</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <StatusTag status="swap" /> <span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>recommended change vs current</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <StatusTag status="new" /> <span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>concept didn't have an icon before</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <StatusTag status="drift" /> <span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>same concept rendered with two different icons today; converge</span>
        </div>
      </section>

      {/* Navigation */}
      <Section id="nav" title="Navigation" intro="Sidebar nav items + the top bar. Icons render at 18px; the row replica shows them at production size with their label.">
        <IconCard status="keep" name="Gauge" context="Sidebar → Hub" recommendation="Keep — dashboard-home metaphor reads well." alternatives={["SquaresFour", "House", "Compass"]} preview={<NavRowPreview icon="Gauge" label="Hub" />} />
        <IconCard status="keep" name="Tray" context="Sidebar → Reminders (Work Queue)" recommendation="Keep — inbox/queue metaphor." alternatives={["Clock", "ListChecks"]} preview={<NavRowPreview icon="Tray" label="Reminders" />} />
        <IconCard status="keep" name="CalendarCheck" context="Sidebar → Completions" recommendation="Keep — completed milestones on a date." alternatives={["CheckSquare", "Trophy"]} preview={<NavRowPreview icon="CalendarCheck" label="Completions" />} />
        <IconCard status="keep" name="CheckSquare" context="Sidebar → To-Do" recommendation="Keep — task-list metaphor." alternatives={["ListChecks", "ClipboardText"]} preview={<NavRowPreview icon="CheckSquare" label="To-Do" />} />
        <IconCard status="keep" name="BellSimple" context="Sidebar → Updates (Comms); also the top-bar notification bell" recommendation="Keep — universal notification metaphor." alternatives={["Bell", "MegaphoneSimple"]} preview={<NavRowPreview icon="BellSimple" label="Updates" />} />
        <IconCard status="swap" name="EnvelopeSimple" context="Sidebar → Auto emails" recommendation="Swap to filled Envelope so it visually anchors the sidebar (filled icons read as more 'present' than outline for top-level nav)." alternatives={["EnvelopeSimple", "EnvelopeOpen", "PaperPlaneTilt"]} preview={<NavRowPreview icon="Envelope" label="Auto emails" />} />
        <IconCard status="keep" name="FolderOpen" context="Sidebar → All Files / My Files" recommendation="Keep — folder = file repository." alternatives={["Folders", "FolderNotch", "Files"]} preview={<NavRowPreview icon="FolderOpen" label="All Files" />} />
        <IconCard status="keep" name="ChartBar" context="Sidebar → Analytics" recommendation="Keep — universal analytics metaphor." alternatives={["ChartLineUp", "ChartPieSlice", "Presentation"]} preview={<NavRowPreview icon="ChartBar" label="Analytics" />} />
        <IconCard status="keep" name="Buildings" context="Sidebar → Partners; also broker firm display" recommendation="Keep — firm/organisation metaphor." alternatives={["Bank", "Storefront", "Building"]} preview={<NavRowPreview icon="Buildings" label="Partners" />} />
        <IconCard status="keep" name="GearSix" context="Sidebar → Settings (in user menu)" recommendation="Keep — universal settings metaphor." alternatives={["Gear", "SlidersHorizontal", "Wrench"]} preview={<NavRowPreview icon="GearSix" label="Settings" />} />
        <IconCard status="keep" name="MagnifyingGlass" context="Top-bar search + transaction list filter" recommendation="Keep — universal search metaphor." alternatives={["MagnifyingGlassPlus"]} preview={<ButtonPreview icon="MagnifyingGlass" label="Search" variant="ghost" />} />
      </Section>

      {/* Status & state */}
      <Section id="status" title="Status & state" intro="Banner icons + toast icons. Banner replicas show the icon, title, and body together — same chrome as production AgentBanner.">
        <IconCard status="keep" name="Info" weight="fill" context="Info banner + info toast (e.g. ReconcileLaterBanner)" recommendation="Keep — universal info metaphor." alternatives={["InfoCircle", "Question"]} preview={<BannerPreview icon="Info" kind="info" title="Bring this file up to date" body="Mark which milestones are already done." />} />
        <IconCard status="keep" name="Warning" weight="fill" context="Warning banner (OnHoldBanner, FileHealthBanner, ChainSetupFailedBanner)" recommendation="Keep — universal warning metaphor. Replaces lucide AlertCircle drift below." alternatives={["WarningCircle", "WarningOctagon"]} preview={<BannerPreview icon="Warning" kind="warning" title="This file is on hold." body="All automation is frozen — reactivate to resume." />} />
        <IconCard status="new" name="XCircle" weight="fill" context="Danger banner + currently used for 'escalated' badge — wrong semantic for escalated (see drift fixes)" recommendation="Keep for genuine errors / failures only. Escalated gets its own icon (Siren — see drift section)." alternatives={["WarningOctagon", "Prohibit"]} preview={<BannerPreview icon="XCircle" kind="danger" title="A chain invite was declined" body="An agent declined your invite — resend or update." />} />
        <IconCard status="keep" name="CheckCircle" weight="fill" context="Success banner, toast success, completed steps in OnboardingChecklist" recommendation="Keep — universal success metaphor." alternatives={["Check", "ShieldCheck"]} preview={<BannerPreview icon="CheckCircle" kind="success" title="Director has joined" body="They can now see all your active sales." />} />
        <IconCard status="keep" name="WarningCircle" context="Toast warning + error fallback in AgentToaster" recommendation="Keep — paired with toast severity." alternatives={["Warning", "WarningOctagon"]} preview={<ChipPreview icon="WarningCircle" />} />
        <IconCard status="keep" name="Circle" context="Onboarding checklist — incomplete step indicator" recommendation="Keep — empty circle for not-yet-done." alternatives={["CircleDashed"]} preview={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><IconByName name="Circle" size={16} /><span style={{ fontSize: 12 }}>Add your first sale</span></div>} />
      </Section>

      {/* Disclosure */}
      <Section id="disclosure" title="Disclosure & expand" intro="Carets and chevrons for collapsibles, dropdowns, and navigation arrows.">
        <IconCard status="keep" name="CaretDown" context="Dropdown toggles (ReminderCard, ChaseDrawer, AutomatedEmailsCard, etc)" recommendation="Keep — universal expand metaphor." alternatives={["ArrowDown", "CaretCircleDown"]} preview={<DisclosureRowPreview caret="CaretDown" label="Show details" />} />
        <IconCard status="keep" name="CaretUp" context="Collapse / hide for sections that were CaretDown'd open" recommendation="Keep — pairs with CaretDown." alternatives={["ArrowUp"]} preview={<DisclosureRowPreview caret="CaretUp" label="Hide details" />} />
        <IconCard status="keep" name="CaretLeft" context="Carousel back (CompletionsGroupList)" recommendation="Keep." alternatives={["ArrowLeft", "ArrowFatLeft"]} preview={<ButtonPreview icon="CaretLeft" label="Prev" variant="ghost" />} />
        <IconCard status="keep" name="CaretRight" context="Carousel forward (CompletionsGroupList)" recommendation="Keep." alternatives={["ArrowRight", "ArrowFatRight"]} preview={<ButtonPreview icon="CaretRight" label="Next" variant="ghost" />} />
        <IconCard status="drift" name="lucide ChevronRight" context="Hub page → info alert row → browse link (only lucide-react usage left in agent app)" recommendation="Swap to Phosphor CaretRight to converge on a single library." alternatives={["CaretRight", "ArrowRight"]} preview={<DisclosureRowPreview caret="CaretRight" label="Browse files" />} />
        <IconCard status="keep" name="ArrowRight" context="Hub action rows + AutomationStopModal chooser cards + new KPI card chevron" recommendation="Keep — directional CTA." alternatives={["ArrowRight", "ArrowCircleRight"]} preview={<ButtonPreview icon="ArrowRight" label="Open" variant="primary" />} />
        <IconCard status="keep" name="ArrowSquareOut" context="External link (broker website)" recommendation="Keep — clearly indicates external/new-tab." alternatives={["ArrowUpRight", "Globe"]} preview={<ButtonPreview icon="ArrowSquareOut" label="Visit site" variant="ghost" />} />
      </Section>

      {/* Action */}
      <Section id="action" title="Actions" intro="Button + interaction icons. Buttons rendered with their label where applicable.">
        <IconCard status="keep" name="X" weight="bold" context="Close on modals, banners, drawers, toasts" recommendation="Keep — universal close." alternatives={["XCircle"]} preview={<ButtonPreview icon="X" label="" variant="icon" />} />
        <IconCard status="keep" name="Plus" context="New sale, empty-state CTAs, add row" recommendation="Keep — universal add." alternatives={["PlusCircle"]} preview={<ButtonPreview icon="Plus" label="New sale" variant="primary" />} />
        <IconCard status="keep" name="PlusCircle" context="Secondary action menu items in AgentShell dropdown" recommendation="Keep — softer 'add' variant." alternatives={["Plus"]} preview={<ButtonPreview icon="PlusCircle" label="Add contact" variant="ghost" />} />
        <IconCard status="keep" name="Pencil" weight="bold" context="Edit content (EmailPreviewModal)" recommendation="Keep — universal edit." alternatives={["PencilSimple", "PencilLine"]} preview={<ButtonPreview icon="Pencil" label="Edit" variant="primary" />} />
        <IconCard status="keep" name="PencilSimple" context="Edit contact details (SolicitorSection)" recommendation="Keep — interchangeable with Pencil; use whichever weight is contextually right." alternatives={["Pencil"]} preview={<ButtonPreview icon="PencilSimple" label="Edit" variant="ghost" />} />
        <IconCard status="keep" name="Trash" context="Delete actions (TeamListView, CompletionsGroupList)" recommendation="Keep — universal delete." alternatives={["TrashSimple"]} preview={<ButtonPreview icon="Trash" label="Remove" variant="ghost" />} />
        <IconCard status="keep" name="Copy" context="Copy email address" recommendation="Keep — universal copy." alternatives={["Clipboard"]} preview={<ButtonPreview icon="Copy" label="Copy" variant="ghost" />} />
        <IconCard status="keep" name="UserPlus" context="Invite team member" recommendation="Keep — universal invite/add-person." alternatives={["UserCirclePlus"]} preview={<ButtonPreview icon="UserPlus" label="Invite" variant="primary" />} />
        <IconCard status="keep" name="Eye" context="Show file visibility for user (TeamListView)" recommendation="Keep — universal visibility." alternatives={["EyeSlash"]} preview={<ButtonPreview icon="Eye" label="" variant="icon" />} />
        <IconCard status="keep" name="EyeSlash" context="Hide file visibility for user (paired with Eye)" recommendation="Keep — pairs with Eye." alternatives={["Eye"]} preview={<ButtonPreview icon="EyeSlash" label="" variant="icon" />} />
        <IconCard status="keep" name="Funnel" context="Filter / search button (TransactionListWithSearch)" recommendation="Keep — universal filter metaphor." alternatives={["FunnelSimple", "Sliders"]} preview={<ButtonPreview icon="Funnel" label="Filter" variant="ghost" />} />
        <IconCard status="keep" name="List" context="Imported in AgentShell; minor usage" recommendation="Keep — used for list-view toggles." alternatives={["ListBullets", "ListNumbers"]} preview={<ChipPreview icon="List" />} />
      </Section>

      {/* Communication */}
      <Section id="comms" title="Communication" intro="Send / channel / AI / loading icons used inside ChaseDrawer and elsewhere.">
        <IconCard status="keep" name="EnvelopeSimple" context="ChaseDrawer email channel button (button-level usage, distinct from sidebar nav)" recommendation="Keep at this usage — disambiguated from nav by context (sidebar uses filled Envelope per swap above)." alternatives={["EnvelopeOpen", "PaperPlaneTilt"]} preview={<ButtonPreview icon="EnvelopeSimple" label="Email" variant="secondary" />} />
        <IconCard status="keep" name="ChatText" context="ChaseDrawer WhatsApp channel button" recommendation="Keep — chat bubble = messaging app." alternatives={["WhatsappLogo", "ChatCircle"]} preview={<ButtonPreview icon="ChatText" label="WhatsApp" variant="secondary" />} />
        <IconCard status="keep" name="PaperPlaneTilt" context="Send chase button + send action" recommendation="Keep — universal send metaphor." alternatives={["PaperPlane", "PaperPlaneRight"]} preview={<ButtonPreview icon="PaperPlaneTilt" label="Send chase" variant="primary" />} />
        <IconCard status="keep" name="Sparkle" context="AI-generate chase button" recommendation="Keep — Sparkle / Sparkles is the de facto AI icon convention." alternatives={["Sparkles", "Star", "MagicWand"]} preview={<ButtonPreview icon="Sparkle" label="Generate" variant="ghost" />} />
        <IconCard status="keep" name="CircleNotch" context="Loading state during generation/send" recommendation="Keep — pairs with a spin animation." alternatives={["Spinner"]} preview={<ChipPreview icon="CircleNotch" />} />
      </Section>

      {/* Time */}
      <Section id="time" title="Time & cadence" intro="Clock icons + refresh/undo. The snooze button uses Clock at button-icon size.">
        <IconCard status="keep" name="Clock" context="Snooze button on reminders, time-based reminders, timing milestones" recommendation="Keep — universal time metaphor." alternatives={["ClockAfternoon", "Hourglass"]} preview={<ButtonPreview icon="Clock" label="Snooze" variant="ghost" />} />
        <IconCard status="keep" name="ClockCountdown" context="Completions list header" recommendation="Keep — countdown variant adds 'deadline' nuance." alternatives={["Clock", "Hourglass"]} preview={<ChipPreview icon="ClockCountdown" />} />
        <IconCard status="keep" name="ArrowsClockwise" context="Top-bar refresh button" recommendation="Keep — universal refresh metaphor." alternatives={["ArrowClockwise"]} preview={<ButtonPreview icon="ArrowsClockwise" label="Refresh" variant="ghost" />} />
        <IconCard status="keep" name="ClockCounterClockwise" context="Undo / history action (user menu)" recommendation="Keep — universal undo/history." alternatives={["ArrowCounterClockwise"]} preview={<ButtonPreview icon="ClockCounterClockwise" label="History" variant="ghost" />} />
        <IconCard status="keep" name="Moon" weight="fill" context="Night-mode theme toggle" recommendation="Keep — universal dark-mode metaphor." alternatives={["Sun"]} preview={<ButtonPreview icon="Moon" label="" variant="icon" />} />
      </Section>

      {/* Entity */}
      <Section id="entity" title="Entities & misc" intro="Object icons used in lists, badges, and one-off contexts.">
        <IconCard status="keep" name="HouseLine" context="Property / transaction file icon in /agent/transactions list" recommendation="Keep — generic property metaphor. Now distinct from the new vendor/purchaser icons below." alternatives={["House", "Buildings"]} preview={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><IconByName name="HouseLine" size={18} /><span style={{ fontSize: 12 }}>40 Tresco Road, Berkhamsted</span></div>} />
        <IconCard status="keep" name="ListChecks" context="Onboarding checklist card header" recommendation="Keep — task-list metaphor." alternatives={["CheckSquare", "ClipboardText"]} preview={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><IconByName name="ListChecks" size={18} /><span style={{ fontSize: 12, fontWeight: 600 }}>Getting started</span></div>} />
        <IconCard status="keep" name="Crown" weight="fill" context="Director badge in TeamListView" recommendation="Keep — leadership metaphor." alternatives={["CrownSimple", "Shield"]} preview={<PillPreview icon="Crown" label="Director" tone="neutral" />} />
        <IconCard status="keep" name="Receipt" context="Imported, contextual" recommendation="Keep — financial-document metaphor." alternatives={["Invoice", "FileText"]} preview={<ChipPreview icon="Receipt" />} />
        <IconCard status="keep" name="Leaf" context="Imported, contextual" recommendation="Keep — nature/eco metaphor." alternatives={["Tree", "Plant"]} preview={<ChipPreview icon="Leaf" />} />
      </Section>

      {/* NEW — Role universals */}
      <Section id="roles" title="NEW — Role universals" intro="Every ContactRole shown as bare text today across 11 surfaces. Adding universal icons disambiguates faster than reading the word. Three context replicas per role: inline next to a contact name, as a section header, and as a role badge pill — matches the actual usages.">
        <IconCard
          status="new"
          name="UserCircle"
          size={28}
          context="NEW — universal vendor/seller icon. Today: bare 'vendor' / 'Vendor' / 'Vendors' text on contact rows, milestone tabs, section headers, role badges, and the automated-emails 'To Mrs Hartley · vendor' line."
          recommendation="Recommended: UserCircle in orange (#ea580c). Avatar-style icon — vendors and purchasers are PEOPLE, distinguished by the side-colour convention. Visually consistent with purchaser (same icon, different colour)."
          alternatives={["User", "UserSquare", "IdentificationBadge", "Storefront"]}
          preview={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ContactInlinePreview icon="UserCircle" name="Mrs Hartley" tone="vendor" />
              <SectionHeaderPreview icon="UserCircle" label="Vendors" tone="vendor" />
              <PillPreview icon="UserCircle" label="Vendor" tone="vendor" />
            </div>
          }
        />
        <IconCard
          status="new"
          name="UserCircle"
          size={28}
          context="NEW — universal purchaser/buyer icon. Today: bare 'purchaser' / 'Purchaser' / 'Purchasers' text on contact rows, milestone tabs, section headers, role badges."
          recommendation="Recommended: UserCircle in blue (#0369a1). Same icon as vendor — the colour does the differentiation. Both sides are people, just on different sides of the transaction."
          alternatives={["User", "UserSquare", "IdentificationBadge", "ShoppingBag"]}
          preview={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ContactInlinePreview icon="UserCircle" name="Mr Stevens" tone="purchaser" />
              <SectionHeaderPreview icon="UserCircle" label="Purchasers" tone="purchaser" />
              <PillPreview icon="UserCircle" label="Purchaser" tone="purchaser" />
            </div>
          }
        />
        <IconCard
          status="new"
          name="Briefcase"
          size={28}
          context="NEW — universal solicitor icon. Today: bare 'Solicitor' / 'Vendor solicitor' / 'Purchaser solicitor' text on contact rows, form labels, section headers."
          recommendation="Recommended: Briefcase — universal legal/business-professional symbol. Neutral tone (solicitor isn't side-specific until paired with vendor/purchaser context)."
          alternatives={["Scales", "BookOpen", "Gavel"]}
          preview={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ContactInlinePreview icon="Briefcase" name="Smith & Co" tone="neutral" />
              <SectionHeaderPreview icon="Briefcase" label="Solicitors" />
              <PillPreview icon="Briefcase" label="Solicitor" tone="neutral" />
            </div>
          }
        />
        <IconCard
          status="new"
          name="ChartLineUp"
          size={28}
          context="NEW — universal broker / IFA / mortgage advisor icon. Today: bare 'Broker / IFA' text on contact rows, form labels."
          recommendation="Recommended: ChartLineUp — financial / advisory metaphor."
          alternatives={["HandCoins", "Bank", "Calculator"]}
          preview={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ContactInlinePreview icon="ChartLineUp" name="Pinnacle Mortgages" tone="neutral" />
              <SectionHeaderPreview icon="ChartLineUp" label="Brokers" />
              <PillPreview icon="ChartLineUp" label="Broker" tone="neutral" />
            </div>
          }
        />
        <IconCard
          status="new"
          name="User"
          size={28}
          context="NEW — generic 'other' contact role. For contacts that aren't vendor/purchaser/solicitor/broker (e.g. surveyors, removal firms, neighbours)."
          recommendation="Recommended: User in neutral grey. Plain silhouette (no circle) — distinguishes from vendor/purchaser which use UserCircle. Still avatar-family for visual cohesion."
          alternatives={["UserCircle", "IdentificationBadge"]}
          preview={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ContactInlinePreview icon="User" name="The surveyor" tone="neutral" />
              <PillPreview icon="User" label="Other" tone="neutral" />
            </div>
          }
        />
      </Section>

      {/* Drift fixes */}
      <Section id="drift" title="Drift fixes" intro="Two icons today represent the same concept differently — converge.">
        <IconCard
          status="drift"
          name="lucide AlertCircle"
          context="Hub page → info alert row. Only lucide-react icon left in the agent app (everything else is Phosphor)."
          recommendation="Swap to Phosphor Warning to converge libraries. Same visual concept, different package."
          alternatives={["Warning", "WarningCircle"]}
          preview={<BannerPreview icon="Warning" kind="warning" title="Files need your attention" body="3 unassigned files waiting to be claimed." />}
        />
        <IconCard
          status="drift"
          name="XCircle"
          context="CompletionsGroupList → 'Escalated' task badge"
          recommendation="Swap to Siren — XCircle reads as 'error/failed' which an escalated task isn't (it's working as intended, just needs urgent attention)."
          alternatives={["Siren", "ArrowFatUp", "Lightning"]}
          preview={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "rgba(199, 62, 62, 0.10)", color: "#C73E3E", fontSize: 11, fontWeight: 700, letterSpacing: "0.03em" }}>
              <IconByName name="Siren" size={12} weight="fill" />
              <span>ESCALATED</span>
            </span>
          }
        />
        <IconCard
          status="drift"
          name="EnvelopeSimple (sidebar nav)"
          context="EnvelopeSimple is used in THREE places: sidebar Auto Emails nav (top-level), chase email channel button (action), invite team member button (action). Same icon for three different roles."
          recommendation="Disambiguate by use case: nav uses filled Envelope (already proposed above); channel button stays EnvelopeSimple; invite button stays UserPlus (already correct elsewhere). The nav change is the only swap needed."
          alternatives={["Envelope", "EnvelopeOpen"]}
          preview={<NavRowPreview icon="Envelope" label="Auto emails" />}
        />
      </Section>

      {/* Style summary */}
      <Section id="style" title="Style summary" intro="Reference card — recommended sizes, weights, and colour conventions.">
        <div style={{
          gridColumn: "1 / -1",
          background: "var(--agent-surface-elevated)",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 12,
          padding: 20,
          fontSize: 13,
          color: "var(--agent-text-primary)",
          lineHeight: 1.6,
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Sizes</h3>
          <p style={{ margin: "0 0 8px" }}><strong>10–12px:</strong> tiny inline (status pill, role badge, table row chip)</p>
          <p style={{ margin: "0 0 8px" }}><strong>14px:</strong> inline with text (contact name + role icon, button label)</p>
          <p style={{ margin: "0 0 8px" }}><strong>16px:</strong> banner icon, modal header X, section header</p>
          <p style={{ margin: "0 0 8px" }}><strong>18px:</strong> sidebar nav</p>
          <p style={{ margin: "0 0 16px" }}><strong>24–32px:</strong> hero / empty-state / KPI / chooser-card</p>

          <h3 style={{ margin: "16px 0 12px", fontSize: 14, fontWeight: 700 }}>Weights</h3>
          <p style={{ margin: "0 0 8px" }}><strong>regular:</strong> default — most usage</p>
          <p style={{ margin: "0 0 8px" }}><strong>bold:</strong> close X, send button (action emphasis)</p>
          <p style={{ margin: "0 0 8px" }}><strong>fill:</strong> banner icons, success/danger badges, status indicators (more presence)</p>

          <h3 style={{ margin: "16px 0 12px", fontSize: 14, fontWeight: 700 }}>Role colour convention</h3>
          <p style={{ margin: "0 0 8px" }}><strong>Vendor / seller:</strong> orange (#ea580c) — bg #fff3e0, fg #ea580c</p>
          <p style={{ margin: "0 0 8px" }}><strong>Purchaser / buyer:</strong> blue (#0369a1) — bg #e0f2fe, fg #0369a1</p>
          <p style={{ margin: "0 0 8px" }}><strong>Solicitor / broker / other:</strong> neutral (#1f2937 on rgba(15,23,42,0.06)) — no side affiliation</p>

          <h3 style={{ margin: "16px 0 12px", fontSize: 14, fontWeight: 700 }}>Pairing with text</h3>
          <p style={{ margin: "0 0 8px" }}>For NEW role icons in v1: always pair icon WITH text (e.g. "[icon] Vendor" not just "[icon]"). Once users learn the convention, future passes can drop the text in space-constrained contexts.</p>
        </div>
      </Section>
    </div>
  );
}
