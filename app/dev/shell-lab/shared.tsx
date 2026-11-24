"use client";

// Shared primitives for /dev/shell-lab. The chrome building blocks (nav, badges,
// New-sale, the full top-bar control cluster) mirror the REAL AgentShell /
// AgentNavRail so the space each option gives is judged against the true thing.
// Floating surfaces reuse the real LiquidGlass + the dock's fallback + scroll
// tuning. Dev-only.

import {
  createContext, useContext, useEffect, useRef, useState,
  type CSSProperties, type HTMLAttributes, type ReactNode,
} from "react";
import { LiquidGlass } from "@/components/quick-dock/LiquidGlass";
import {
  Gauge, Tray, ChatCircleDots, CalendarCheck, CheckSquare, BellSimple, Envelope,
  FolderOpen, LinkSimple, ChartBar, Buildings, NotePencil, PaperPlaneTilt,
  MagnifyingGlass, CaretRight, CaretDown, Bell, Plus, Sun, MoonStars, ArrowsClockwise,
  ClockCounterClockwise, House,
} from "@/components/icons/ph";
import { FILES, TILE_COLORS, ACCOUNT, type FileRow } from "./mock";

export type Theme = "light" | "dark";

// ── Lab context ──────────────────────────────────────────────────────────────
type LabState = { theme: Theme; setTheme: (t: Theme) => void; fallback: boolean; reduce: boolean };
const LabCtx = createContext<LabState>({ theme: "light", setTheme: () => {}, fallback: false, reduce: false });
export const LabProvider = LabCtx.Provider;
export function useLab() { return useContext(LabCtx); }

export const GLASS_TINT = { dark: "rgba(34,37,50,0.58)", light: "rgba(255,255,255,0.64)" } as const;

export function detectFallback(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(ua);
  const firefox = /firefox|fxios/i.test(ua);
  return iOS || safari || firefox;
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setR(mq.matches); read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return r;
}

// Scroll direction with the dock's exact tuning (6px dead-zone + rAF, "near top"
// always counts as up) so tiny movements never flicker the bars.
export function useScrollDir(): { down: boolean; atTop: boolean } {
  const [down, setDown] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    function handle() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY, dy = y - lastY.current;
        setAtTop(y < 60);
        if (y < 60) setDown(false); else if (dy > 6) setDown(true); else if (dy < -6) setDown(false);
        lastY.current = y; ticking = false;
      });
    }
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);
  return { down, atTop };
}

// ── Nav model (mirrors the real agent sidebar; main + secondary groups) ──────
export type NavItem = { key: string; label: string; Icon: typeof Gauge; badge?: number; active?: boolean };
export const NAV_MAIN: NavItem[] = [
  { key: "hub", label: "Hub", Icon: Gauge },
  { key: "reminders", label: "Reminders", Icon: Tray, badge: 82 },
  { key: "enquiries", label: "Enquiries", Icon: ChatCircleDots, badge: 13 },
  { key: "completions", label: "Completions", Icon: CalendarCheck },
  { key: "todo", label: "To-Do", Icon: CheckSquare },
  { key: "updates", label: "Updates", Icon: BellSimple },
  { key: "auto", label: "Auto emails", Icon: Envelope },
  { key: "files", label: "All Files", Icon: FolderOpen, active: true },
  { key: "chains", label: "Chains", Icon: LinkSimple, badge: 27 },
  { key: "analytics", label: "Analytics", Icon: ChartBar },
];
export const NAV_SECONDARY: NavItem[] = [{ key: "partners", label: "Partners", Icon: Buildings }];
const RECENTS = FILES.slice(0, 4);

// ── Glass wrapper ────────────────────────────────────────────────────────────
type GlassProps = HTMLAttributes<HTMLDivElement> & { radius?: number; tint?: string; children: ReactNode };
export function LabGlass({ radius = 20, tint, className = "", children, ...rest }: GlassProps) {
  const { theme, fallback } = useLab();
  const t = tint ?? GLASS_TINT[theme];
  if (fallback) return <div className={`lab-frost ${className}`} style={{ borderRadius: radius }} {...rest}>{children}</div>;
  return <LiquidGlass radius={radius} thickness={14} displace={42} aberration={4} tint={t} className={className} {...rest}>{children}</LiquidGlass>;
}

// ── Tooltip (hover + keyboard focus) ─────────────────────────────────────────
export function Tooltip({ label, children, side = "right" }: { label: string; children: ReactNode; side?: "right" | "bottom" }) {
  return <span className={`lab-tt lab-tt-${side}`}>{children}<span className="lab-tt-bubble" role="tooltip">{label}</span></span>;
}

// ── Sidebar chrome: brand, New sale, nav, recents ────────────────────────────
export function Brand({ markOnly }: { markOnly?: boolean }) {
  return (
    <div className="lab-brand">
      <span className="lab-brand-mark" aria-hidden />
      {!markOnly && <span className="lab-brand-txt"><b>Sales Progressor</b><small>{ACCOUNT.agency}</small></span>}
    </div>
  );
}
export function NewSale({ collapsed }: { collapsed?: boolean }) {
  return (
    <a href="#" className={`lab-newsale${collapsed ? " collapsed" : ""}`} title="New sale" onClick={(e) => e.preventDefault()}>
      <span className="lab-newsale-badge" aria-hidden><Plus size={14} weight="bold" color="#fff" /></span>
      {!collapsed && <span className="lab-newsale-label">New sale</span>}
    </a>
  );
}
function NavRow({ item, collapsed }: { item: NavItem; collapsed?: boolean }) {
  const inner = (
    <a href="#" className={`lab-rail-item${item.active ? " on" : ""}`} aria-current={item.active ? "page" : undefined} title={item.label} onClick={(e) => e.preventDefault()}>
      {item.active && <span className="lab-rail-pill" aria-hidden />}
      <item.Icon weight={item.active ? "fill" : "regular"} />
      {!collapsed && <span className="lab-rail-label">{item.label}</span>}
      {!collapsed && (item.badge != null
        ? <span className="lab-rail-badge">{item.badge}</span>
        : <span className="lab-rail-chevron" aria-hidden><CaretRight size={12} weight="bold" /></span>)}
      {collapsed && item.badge != null && <span className="lab-rail-dot" aria-hidden />}
    </a>
  );
  if (collapsed) return <Tooltip label={item.badge != null ? `${item.label} · ${item.badge}` : item.label}>{inner}</Tooltip>;
  return inner;
}
export function NavList({ collapsed, withRecents = true }: { collapsed?: boolean; withRecents?: boolean }) {
  return (
    <nav className="lab-nav" aria-label="Main">
      {NAV_MAIN.map((it) => <NavRow key={it.key} item={it} collapsed={collapsed} />)}
      <span className="lab-nav-div" aria-hidden />
      {NAV_SECONDARY.map((it) => <NavRow key={it.key} item={it} collapsed={collapsed} />)}
      {withRecents && !collapsed && (
        <div className="lab-recents">
          <span className="lab-nav-div" aria-hidden />
          <p>Recently viewed</p>
          {RECENTS.map((f) => (
            <a key={f.id} href="#" className="lab-recent" title={f.address} onClick={(e) => e.preventDefault()}>
              <ClockCounterClockwise weight="regular" /><span>{f.address}</span>
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

// ── Top-bar controls (the real cluster: search · view · as-of · theme · bell · account) ──
export function SearchPill({ compact }: { compact?: boolean }) {
  if (compact) return <button className="lab-icon-btn" type="button" aria-label="Search"><MagnifyingGlass weight="bold" /></button>;
  return <label className="lab-search"><MagnifyingGlass weight="bold" /><input placeholder="Search files, people…" aria-label="Search" /><kbd>⌘K</kbd></label>;
}
export function ViewToggle() {
  return (
    <div className="lab-viewtoggle" role="group" aria-label="File scope">
      <button className="on" type="button" aria-pressed>All files</button>
      <button type="button" aria-pressed={false}>Just mine</button>
    </div>
  );
}
export function AsOf({ compact }: { compact?: boolean }) {
  const [spin, setSpin] = useState(false);
  return (
    <button className={`lab-asof${compact ? " compact" : ""}`} type="button" title="Refresh data" aria-label="Refresh data" onClick={() => { setSpin(true); setTimeout(() => setSpin(false), 700); }}>
      <span className={spin ? "spin" : undefined}><ArrowsClockwise size={13} /></span>
      {!compact && <span>As of 11:24</span>}
    </button>
  );
}
export function ThemeToggle() {
  const { theme, setTheme } = useLab();
  return (
    <button className="lab-icon-btn" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? <MoonStars weight="duotone" /> : <Sun weight="duotone" />}
    </button>
  );
}
export function BellBtn() {
  return <button className="lab-icon-btn" type="button" aria-label="Notifications"><Bell weight="duotone" /><span className="lab-bell-dot" aria-hidden /></button>;
}
export function Account({ compact }: { compact?: boolean }) {
  return (
    <button className="lab-acct" type="button" aria-label={`Account: ${ACCOUNT.name}`}>
      <span className="lab-avatar" aria-hidden>{ACCOUNT.initials}</span>
      {!compact && <><span className="lab-acct-name">{ACCOUNT.name}</span><CaretDown weight="bold" /></>}
    </button>
  );
}
// The full right-hand cluster, consistent across options. `compact` icon-ifies.
export function TopRight({ compact }: { compact?: boolean }) {
  return (
    <div className="lab-tb-right">
      {!compact && <ViewToggle />}
      <AsOf compact={compact} />
      <ThemeToggle />
      <BellBtn />
      <Account compact={compact} />
    </div>
  );
}

// ── Content: the shared, scrollable All Files screen ─────────────────────────
function StageChip({ stage, tone }: { stage: FileRow["stage"]; tone: FileRow["tone"] }) {
  return <span className={`lab-chip lab-chip-${tone}`}>{stage}</span>;
}
export function AllFiles() {
  return (
    <div className="lab-content">
      <header className="lab-c-head">
        <div><h1>All Files</h1><p>Everything you're progressing, with who has it and what's next.</p></div>
      </header>
      <div className="lab-list">
        <div className="lab-row lab-row-head" aria-hidden><span>Property</span><span>Parties</span><span>Stage</span><span>Progress</span><span>Next</span><span className="lab-r-wait">Waiting</span></div>
        {FILES.map((f, i) => (
          <div key={f.id} className="lab-row" tabIndex={0}>
            <span className="lab-prop"><span className="lab-tile" style={{ background: TILE_COLORS[i % TILE_COLORS.length] }} aria-hidden><House weight="duotone" /></span><span className="lab-prop-txt"><b>{f.address}</b><small>{f.town} · {f.price}</small></span></span>
            <span className="lab-parties"><b>{f.seller}</b><small>→ {f.buyer}</small></span>
            <span><StageChip stage={f.stage} tone={f.tone} /></span>
            <span className="lab-prog"><span className="lab-prog-bar"><i style={{ width: `${f.progress}%` }} /></span><em>{f.progress}%</em></span>
            <span className="lab-next">{f.next}</span>
            <span className="lab-r-wait"><span className={`lab-wait lab-wait-${f.tone}`}>{f.waitingDays === 0 ? "—" : `${f.waitingDays}d`}</span></span>
          </div>
        ))}
      </div>
      <div className="lab-tail">End of list · {FILES.length} files · scroll back up to bring the shell back</div>
    </div>
  );
}

// ── Bottom dock (the reference) ──────────────────────────────────────────────
export function BottomDock() {
  const { down } = useScrollDir();
  return (
    <div className="lab-dock-wrap" data-down={down ? "1" : undefined}>
      <LabGlass radius={22} className="lab-dock">
        <button className="lab-dock-btn" type="button" onClick={() => alert("New note (simulated)")}><NotePencil weight="regular" /><span>New note</span></button>
        <span className="lab-dock-sep" />
        <button className="lab-dock-btn" type="button" onClick={() => alert("New email (simulated)")}><PaperPlaneTilt weight="regular" /><span>New email</span></button>
      </LabGlass>
    </div>
  );
}
