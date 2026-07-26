"use client";

// ─── /dev/vibe · KINETIC DEPTH ─────────────────────────────────────────────
// One direction, fully committed to. Dark, spatial, glass, gradient accent.
// Not linked from production nav. Middleware exempts /dev/*.
// ───────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./vibe.module.css";

// ─── FAKE DATA (Law 20: fabricated addresses only) ────────────────────────

type SaleFile = {
  id: string;
  address1: string;
  address2: string;
  status: "escalated" | "on_track" | "on_hold" | "completed" | "due_today" | "overdue";
  reason: string;
  progress: number;
  salePrice: string;
  daysInSystem: number;
  contactInitials: string[];
  nextActionShort: string;
  nextActionMeta: string;
  peopleProse: string;
  exchangeIn: string;
};

const files: SaleFile[] = [
  { id: "1", address1: "12 Oakfield Road", address2: "Berkhamsted, HP4 3XX", status: "escalated", reason: "No response from Grange Legal in 8 days", progress: 62, salePrice: "£585,000", daysInSystem: 74, contactInitials: ["BP", "JP", "MC", "EC"], nextActionShort: "Chase Grange Legal for search results", nextActionMeta: "Waiting since 12 May", peopleProse: "Ben, Jessica, Marcus + 1", exchangeIn: "3 weeks" },
  { id: "2", address1: "43 Willowbrook Crescent", address2: "Chelmsford, CM2 8YY", status: "on_track", reason: "Progressing normally", progress: 34, salePrice: "£412,000", daysInSystem: 28, contactInitials: ["SW", "TW", "AR"], nextActionShort: "Awaiting draft contract from Ashfield & Co", nextActionMeta: "Expected by 24 Jul", peopleProse: "Sarah, Tom, Alex", exchangeIn: "8 weeks" },
  { id: "3", address1: "8 Highfield Court", address2: "Tring, HP23 5ZZ", status: "overdue", reason: "Vendor ID checks 4 days overdue", progress: 18, salePrice: "£495,000", daysInSystem: 12, contactInitials: ["RD", "LD"], nextActionShort: "Chase vendor to complete ID and AML", nextActionMeta: "Missed 17 Jul deadline", peopleProse: "Rachel, Luke", exchangeIn: "10 weeks" },
  { id: "4", address1: "27 Beech Rise", address2: "Woking, GU21 2AA", status: "completed", reason: "Sale completed on 15 Jul", progress: 100, salePrice: "£720,000", daysInSystem: 96, contactInitials: ["MG", "AG", "PN", "SN"], nextActionShort: "No action needed", nextActionMeta: "Completed 15 Jul", peopleProse: "Michael, Anna, Peter + 1", exchangeIn: "Complete" },
  { id: "5", address1: "5 Ash Grove", address2: "Guildford, GU1 4BB", status: "on_hold", reason: "Vendor paused for family reasons", progress: 44, salePrice: "£368,500", daysInSystem: 51, contactInitials: ["CD", "HD"], nextActionShort: "Hold until vendor confirms restart", nextActionMeta: "On hold since 3 Jul", peopleProse: "Claire, Harry", exchangeIn: "Paused" },
  { id: "6", address1: "91 Church Lane", address2: "Hemel Hempstead, HP1 3CC", status: "due_today", reason: "Exchange papers arrive today", progress: 88, salePrice: "£462,000", daysInSystem: 88, contactInitials: ["TM", "GM", "JB"], nextActionShort: "Confirm exchange papers received", nextActionMeta: "Solicitor sending today", peopleProse: "Tim, Gemma, Jamie", exchangeIn: "12 days" },
];

const detailFile = files[0];

type Phase = {
  id: string;
  name: string;
  state: "done" | "active" | "pending";
  milestones: { code: string; label: string; state: "complete" | "active" | "pending"; date: string }[];
};

const phases: Phase[] = [
  {
    id: "setup",
    name: "Setup",
    state: "done",
    milestones: [
      { code: "VM1", label: "Seller has instructed their solicitor", state: "complete", date: "8 May" },
      { code: "PM1", label: "Buyer has instructed their solicitor", state: "complete", date: "9 May" },
      { code: "VM4", label: "Seller has completed ID and AML checks", state: "complete", date: "12 May" },
      { code: "PM4", label: "Buyer has paid money on account", state: "complete", date: "14 May" },
    ],
  },
  {
    id: "preparation",
    name: "Preparation",
    state: "active",
    milestones: [
      { code: "VM7", label: "Seller's solicitor has issued the draft contract", state: "complete", date: "22 May" },
      { code: "PM8", label: "Buyer's solicitor has ordered searches", state: "active", date: "In progress" },
      { code: "VM10", label: "Seller's solicitor has received initial enquiries", state: "pending", date: "Waiting" },
    ],
  },
  {
    id: "enquiries",
    name: "Enquiries",
    state: "pending",
    milestones: [
      { code: "PM14", label: "Buyer's solicitor has raised initial enquiries", state: "pending", date: "" },
      { code: "VM11", label: "Seller has provided initial replies to enquiries", state: "pending", date: "" },
      { code: "PM16", label: "Buyer's solicitor has reviewed responses", state: "pending", date: "" },
    ],
  },
  {
    id: "exchange",
    name: "Exchange",
    state: "pending",
    milestones: [
      { code: "VM18", label: "Seller ready to exchange", state: "pending", date: "" },
      { code: "PM25", label: "Buyer ready to exchange", state: "pending", date: "" },
      { code: "VM19", label: "Contracts exchanged", state: "pending", date: "" },
    ],
  },
  {
    id: "completion",
    name: "Completion",
    state: "pending",
    milestones: [
      { code: "VM20", label: "Sale completed", state: "pending", date: "" },
      { code: "PM27", label: "Purchase completed", state: "pending", date: "" },
    ],
  },
];

// Attention list — the 3 files needing action right now
const attentionFiles = files.filter((f) =>
  f.status === "escalated" || f.status === "overdue" || f.status === "due_today"
).slice(0, 3);

const chain = [
  { id: "c1", name: "Sarah at Beechwood Estates", sub: "18 Meadowlark Drive, Berkhamsted", status: "CLAIMED", kind: "claimed" as const, isViewer: false, isDeclined: false },
  { id: "c2", name: "You (Akeman Residential)", sub: "12 Oakfield Road, Berkhamsted", status: "YOUR FILE", kind: "viewer" as const, isViewer: true, isDeclined: false },
  { id: "c3", name: "Philippa at Roger Platt", sub: "4 Church Terrace, Hemel Hempstead", status: "DECLINED", kind: "declined" as const, isViewer: false, isDeclined: true },
  { id: "c4", name: "Not sent — Rose Cottage", sub: "Hemel Hempstead", status: "NOT SENT", kind: "notsent" as const, isViewer: false, isDeclined: false },
];

// ─── HOOKS ────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = null;
    let frame = 0;
    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

// Pointer-following tilt + glare — the Kinetic Depth signature.
function usePointerTilt(strength = 6) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (px - 0.5) * strength * 2;
    const ry = (0.5 - py) * strength * 2;
    el.style.setProperty("--rx", rx.toFixed(2));
    el.style.setProperty("--ry", ry.toFixed(2));
    el.style.setProperty("--px", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${(py * 100).toFixed(1)}%`);
  }, [strength]);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0");
    el.style.setProperty("--ry", "0");
  }, []);

  return { ref, onMove, onLeave };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────

function ProgressRing({
  percent,
  size = 88,
  stroke = 8,
  label,
  sublabel,
  glow = false,
  small = false,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  glow?: boolean;
  small?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [rendered, setRendered] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setRendered(percent), 60);
    return () => clearTimeout(t);
  }, [percent]);
  const offset = c - (rendered / 100) * c;
  const gradId = `vibe-ring-grad-${size}-${stroke}`;
  return (
    <div
      className={`${styles.ringWrap} ${glow ? styles.ringGlow : ""} ${small ? styles.ringSmall : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--v-accent-a)" />
            <stop offset="100%" stopColor="var(--v-accent-b)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      {(label || sublabel) && (
        <div className={styles.ringLabel}>
          {label && <div className={styles.ringPct}>{label}</div>}
          {sublabel && <div className={styles.ringSub}>{sublabel}</div>}
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, w = 68, h = 22 }: { data: number[]; w?: number; h?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - ((d - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const gradId = `vibe-sl-${w}-${h}-${data.length}`;
  return (
    <svg width={w} height={h} className={styles.sparkline}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--v-accent-a)" />
          <stop offset="100%" stopColor="var(--v-accent-b)" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusPill({
  status,
  pulse = false,
}: { status: SaleFile["status"]; pulse?: boolean }) {
  const label = {
    escalated: "Escalated",
    on_track: "On track",
    on_hold: "On hold",
    completed: "Completed",
    due_today: "Due today",
    overdue: "Overdue",
  }[status];
  const cls = {
    escalated: styles.pillEscalated,
    on_track: styles.pillOnTrack,
    on_hold: styles.pillOnHold,
    completed: styles.pillCompleted,
    due_today: styles.pillDueToday,
    overdue: styles.pillOverdue,
  }[status];
  const shouldPulse = pulse && status === "escalated";
  const pillEl = (
    <span className={`${styles.pill} ${cls} ${shouldPulse ? styles.pillPulse : ""}`}>
      {label}
    </span>
  );
  if (shouldPulse) return <span className={styles.pillPulseWrap}>{pillEl}</span>;
  return pillEl;
}

function AvatarStack({ initials }: { initials: string[] }) {
  return (
    <div className={styles.avatarStack}>
      {initials.slice(0, 4).map((i, idx) => (
        <div key={idx} className={styles.avatar}>{i}</div>
      ))}
    </div>
  );
}

// Panel with pointer tilt + glare.
function TiltPanel({
  children,
  className,
  interactive = true,
  strength = 4,
  style,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  strength?: number;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const tilt = usePointerTilt(strength);
  return (
    <div
      {...props}
      ref={tilt.ref}
      onMouseMove={interactive ? tilt.onMove : undefined}
      onMouseLeave={interactive ? tilt.onLeave : undefined}
      className={`${styles.panel} ${interactive ? styles.panelInteractive : ""} ${className ?? ""}`}
      style={style}
    >
      <div className={styles.panelInner}>{children}</div>
    </div>
  );
}

// ─── HUB ──────────────────────────────────────────────────────────────────

function AvatarStackSmall({ initials }: { initials: string[] }) {
  return (
    <div className={styles.avatarStack}>
      {initials.slice(0, 4).map((i, idx) => (
        <div key={idx} className={styles.avatarSmall}>{i}</div>
      ))}
    </div>
  );
}

const attentionStatusLabel: Record<string, string> = {
  escalated: "Escalated",
  overdue: "Overdue",
  due_today: "Due today",
};

function HubSection() {
  const attentionCount = useCountUp(attentionFiles.length);
  const totalActive = useCountUp(44);
  const exchangeCount = useCountUp(6);

  const activeWeeks = [38, 39, 40, 42, 42, 43, 44];
  const exchangeWeeks = [2, 3, 3, 4, 5, 5, 6];

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Your hub</h2>
          <p className={styles.sectionSubtitle}>Where directors and negotiators start their morning</p>
        </div>
      </header>

      <div className={styles.hubTop}>
        {/* Hub hero — action list, not KPI */}
        <TiltPanel className={styles.hubHero2} interactive={false}>
          <div className={styles.hubGreeting}>Good morning, Ellis</div>
          <div className={styles.hubHeadline2}>
            <span className={styles.grad}>{attentionCount}</span> files need attention today
          </div>
          <div className={styles.attentionList}>
            {attentionFiles.map((f, i) => (
              <div key={f.id} className={styles.attentionRow} style={{ animationDelay: `${180 + i * 90}ms` }}>
                <span className={styles.attentionDot} data-status={f.status} />
                <div className={styles.attentionMeta}>
                  <div className={styles.attentionTop}>
                    <span className={styles.attentionStatus} data-status={f.status}>{attentionStatusLabel[f.status]}</span>
                    <span className={styles.attentionSep}>·</span>
                    <span className={styles.attentionAddress}>{f.address1}</span>
                  </div>
                  <div className={styles.attentionReason}>{f.reason}</div>
                </div>
                <span className={styles.attentionArrow}>→</span>
              </div>
            ))}
          </div>
        </TiltPanel>

        {/* Mini stat 1 — Active files with contextual line + bar chart */}
        <TiltPanel className={styles.miniStat2}>
          <div className={styles.miniStat2Label}>Active files</div>
          <div className={styles.miniStat2Value}>{totalActive}</div>
          <div className={styles.miniStat2Bars}>
            {activeWeeks.map((v, i) => {
              const max = Math.max(...activeWeeks);
              const heightPct = 30 + (v / max) * 70;
              const isLast = i === activeWeeks.length - 1;
              return (
                <div
                  key={i}
                  className={styles.miniStat2Bar}
                  data-highlighted={isLast}
                  style={{ height: `${heightPct}%`, animationDelay: `${300 + i * 55}ms` }}
                />
              );
            })}
          </div>
          <div>
            <div className={styles.miniStat2Line}>
              <span className={styles.miniStat2Delta}>+3 this week</span>
              <span className={styles.miniStat2Sep}>·</span>
              <span>+7 vs quarter start</span>
            </div>
            <div className={styles.miniStat2Caption}>Last 7 weeks</div>
          </div>
        </TiltPanel>

        {/* Mini stat 2 — Exchanged this month */}
        <TiltPanel className={styles.miniStat2}>
          <div className={styles.miniStat2Label}>Exchanged this month</div>
          <div className={styles.miniStat2Value}>{exchangeCount}</div>
          <div className={styles.miniStat2Bars}>
            {exchangeWeeks.map((v, i) => {
              const max = Math.max(...exchangeWeeks);
              const heightPct = 20 + (v / max) * 80;
              const isLast = i === exchangeWeeks.length - 1;
              return (
                <div
                  key={i}
                  className={styles.miniStat2Bar}
                  data-highlighted={isLast}
                  style={{ height: `${heightPct}%`, animationDelay: `${300 + i * 55}ms` }}
                />
              );
            })}
          </div>
          <div>
            <div className={styles.miniStat2Line}>
              <span className={styles.miniStat2Delta}>+2 vs last month</span>
              <span className={styles.miniStat2Sep}>·</span>
              <span>above quarter avg</span>
            </div>
            <div className={styles.miniStat2Caption}>Rolling 7 months</div>
          </div>
        </TiltPanel>
      </div>

      {/* File cards — information design, not data grid */}
      <div className={styles.hubGrid}>
        {files.map((f, idx) => (
          <TiltPanel
            key={f.id}
            className={styles.fileCard2}
            strength={5}
            style={{ animation: `vibeFadeUp 620ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 55}ms both` }}
          >
            <div className={styles.statusLead} data-status={f.status}>
              <span className={styles.dot} />
              <span>{attentionStatusLabel[f.status] ?? (f.status === "on_track" ? "On track" : f.status === "on_hold" ? "On hold" : "Completed")}</span>
              {f.status !== "on_track" && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                  <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: "-0.005em", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                    {f.reason}
                  </span>
                </>
              )}
            </div>

            <div className={styles.fileAnchor}>
              <div className={styles.address}>{f.address1}</div>
              <div className={styles.prose}>{f.address2} · {f.salePrice}</div>
            </div>

            <div className={styles.nextActionBlock} data-status={f.status}>
              <div className={styles.nextActionText}>{f.nextActionShort}</div>
              <div className={styles.nextActionMeta}>{f.nextActionMeta}</div>
            </div>

            <div className={styles.progressBlock}>
              <div className={styles.progressProse}>
                <span><span className={styles.pct}>{f.progress}%</span> complete</span>
                <span>exchange in {f.exchangeIn}</span>
              </div>
              <div className={styles.progressBarThin}>
                <div className={styles.progressBarThinFill} style={{ width: `${f.progress}%` }} />
              </div>
            </div>

            <div className={styles.peopleQuiet}>
              <AvatarStackSmall initials={f.contactInitials} />
              <span className={styles.peopleQuietText}>{f.peopleProse}</span>
            </div>
          </TiltPanel>
        ))}
      </div>
    </section>
  );
}

// ─── FILE DETAIL ──────────────────────────────────────────────────────────

function PhaseGroup({ phase, defaultOpen }: { phase: Phase; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const done = phase.milestones.filter((m) => m.state === "complete").length;
  const total = phase.milestones.length;
  const summary =
    phase.state === "done" ? `${done} of ${total} done`
    : phase.state === "active" ? `${done} of ${total} · in progress`
    : `${total} steps`;

  return (
    <div className={styles.phaseGroup} data-state={phase.state}>
      <button className={styles.phaseHeader} onClick={() => setOpen((o) => !o)}>
        <span className={styles.phaseIcon} data-state={phase.state}>
          {phase.state === "done" ? "✓" : phase.state === "active" ? "●" : ""}
        </span>
        <span className={styles.phaseName}>{phase.name}</span>
        <span className={styles.phaseSummary}>{summary}</span>
        <span className={styles.phaseChevron} data-open={open}>▸</span>
      </button>
      {/* Always render body; grid-template-rows animates 0fr → 1fr for smooth collapse */}
      <div className={styles.phaseBodyWrap} data-open={open}>
        <div className={styles.phaseBodyInner}>
          <div className={styles.phaseBody}>
            {phase.milestones.map((m, i) => (
              <div key={m.code} className={styles.milestoneRow} data-state={m.state} style={{ animationDelay: `${i * 40}ms` }}>
                <span className={styles.dot} />
                <span className={styles.label}>{m.label}</span>
                <span className={styles.meta}>{m.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarPhaseStrip({ phases }: { phases: Phase[] }) {
  return (
    <div className={styles.phaseStrip}>
      {phases.map((p) => (
        <div key={p.id} className={styles.phaseStripItem} data-state={p.state}>
          <div className={styles.phaseStripDot} data-state={p.state}>
            {p.state === "done" ? "✓" : ""}
          </div>
          <div className={styles.phaseStripLabel}>{p.name}</div>
        </div>
      ))}
    </div>
  );
}

function FileDetailSection() {
  const [tab, setTab] = useState<"overview" | "steps" | "reminders" | "activity">("overview");
  const [chainOpen, setChainOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const chaseCount = useCountUp(18, 900);
  const stepsDone = useCountUp(17, 900);

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "steps", label: "Steps" },
    { key: "reminders", label: "Reminders" },
    { key: "activity", label: "Activity" },
  ];

  const updateUnderline = useCallback(() => {
    if (!tabsRef.current) return;
    const activeBtn = tabsRef.current.querySelector<HTMLButtonElement>(`button[data-key="${tab}"]`);
    if (!activeBtn) return;
    const parentRect = tabsRef.current.getBoundingClientRect();
    const rect = activeBtn.getBoundingClientRect();
    setUnderline({ left: rect.left - parentRect.left, width: rect.width });
  }, [tab]);

  useLayoutEffect(() => { updateUnderline(); }, [updateUnderline]);
  useEffect(() => {
    window.addEventListener("resize", updateUnderline);
    return () => window.removeEventListener("resize", updateUnderline);
  }, [updateUnderline]);

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>File detail</h2>
          <p className={styles.sectionSubtitle}>The main working surface — where agents spend hours</p>
        </div>
      </header>

      {/* Hero with status ribbon + KPI hierarchy + CTAs */}
      <TiltPanel className={`${styles.panel} ${styles.fileHero2}`} strength={2} interactive={false} style={{ animation: "vibeRouteSlideIn 620ms cubic-bezier(0.34, 1.45, 0.64, 1)" }}>
        <div className={styles.statusRibbon} data-status="escalated">
          <span className={styles.ribbonDot} />
          <span className={styles.ribbonLabel}>Escalated</span>
          <span className={styles.ribbonReason}>{detailFile.reason}</span>
          <span className={styles.ribbonMeta}>Flagged 2 days ago</span>
        </div>

        <div className={styles.hero2Body}>
          <div>
            <div className={styles.hero2Address}>{detailFile.address1}</div>
            <div className={styles.hero2Subaddress}>{detailFile.address2}</div>

            <div className={styles.hero2KpiPrimary}>
              <div className={styles.hero2Kpi}>
                <div className={styles.hero2KpiLabel}>Sale price</div>
                <div className={styles.hero2KpiValue}>{detailFile.salePrice}</div>
              </div>
              <div className={styles.hero2KpiSep} />
              <div className={styles.hero2Kpi}>
                <div className={styles.hero2KpiLabel}>Exchange</div>
                <div className={styles.hero2KpiValue}>{detailFile.exchangeIn}</div>
              </div>
            </div>

            <div className={styles.hero2KpiSecondary}>
              {detailFile.daysInSystem} days in system · {detailFile.contactInitials.length} people
            </div>

            <div className={styles.hero2Ctas}>
              <button className={`${styles.btn} ${styles.btnPrimary}`}>Chase Grange Legal →</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setChainOpen(true)}>Open chain</button>
            </div>
          </div>

          <ProgressRing
            percent={detailFile.progress}
            size={168}
            stroke={12}
            label={`${detailFile.progress}%`}
            sublabel="Complete"
            glow
          />
        </div>
      </TiltPanel>

      <div className={styles.tabBar} ref={tabsRef}>
        <div className={styles.tabBg} style={{ left: underline.left, width: underline.width }} />
        {tabs.map((t) => (
          <button
            key={t.key}
            data-key={t.key}
            data-active={tab === t.key}
            className={styles.tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.fileBody} key={tab}>
        <div className={styles.fileMain}>
          <TiltPanel interactive={false} strength={2}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderTitle}>
                {tab === "overview" && "Sale timeline"}
                {tab === "steps" && "All steps"}
                {tab === "reminders" && "Active reminders"}
                {tab === "activity" && "Recent activity"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                {phases.filter((p) => p.state === "done").length} of {phases.length} phases done
              </div>
            </div>
            <div className={styles.phaseList}>
              {phases.map((p) => (
                <PhaseGroup key={p.id} phase={p} defaultOpen={p.state === "active"} />
              ))}
            </div>
          </TiltPanel>
        </div>

        <div className={styles.sidebar2}>
          {/* Anchor: Next action */}
          <TiltPanel className={`${styles.panel} ${styles.sidebarAnchor}`} strength={4} interactive={false} style={{ animation: "vibeFadeUp 560ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both" }}>
            <div className={styles.sidebarLabel}>Next action</div>
            <div className={styles.anchorTitle}>Chase Grange Legal</div>
            <div className={styles.anchorSub}>Waiting 8 days on search results. Solicitor hasn't responded to two prior chases.</div>
            <button className={`${styles.btn} ${styles.btnPrimary}`}>Send chase →</button>
          </TiltPanel>

          {/* Progress */}
          <TiltPanel className={styles.sidebarCompact} strength={3} style={{ animation: "vibeFadeUp 560ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both" }}>
            <div className={styles.sidebarLabel}>Progress</div>
            <div className={styles.progressCompact}>
              <div className={styles.progressCompactRing}>
                <ProgressRing percent={detailFile.progress} size={64} stroke={5} label={`${detailFile.progress}%`} small glow />
              </div>
              <div className={styles.progressCompactStat}>
                <div className={styles.progressCompactValue}>{stepsDone}<span style={{ fontSize: 16, color: "rgba(255,255,255,0.42)", fontWeight: 500 }}>/27</span></div>
                <div className={styles.progressCompactMeta}>10 steps to exchange</div>
              </div>
            </div>
          </TiltPanel>

          {/* Phase strip */}
          <TiltPanel className={styles.sidebarCompact} strength={3} style={{ animation: "vibeFadeUp 560ms cubic-bezier(0.16, 1, 0.3, 1) 280ms both" }}>
            <div className={styles.sidebarLabel}>Sale timeline</div>
            <SidebarPhaseStrip phases={phases} />
          </TiltPanel>

          {/* People — grouped */}
          <TiltPanel className={styles.sidebarCompact} strength={3} style={{ animation: "vibeFadeUp 560ms cubic-bezier(0.16, 1, 0.3, 1) 360ms both" }}>
            <div className={styles.sidebarLabel}>People on this sale</div>
            <div className={styles.peopleGroup}>
              <div className={styles.peopleGroupHeader}>Vendors</div>
              <div className={styles.peopleItem}><span>Ben Palmer</span></div>
              <div className={styles.peopleItem}><span>Jessica Palmer</span></div>
            </div>
            <div className={styles.peopleGroup}>
              <div className={styles.peopleGroupHeader}>Buyers</div>
              <div className={styles.peopleItem}><span>Marcus Chen</span></div>
              <div className={styles.peopleItem}><span>Emma Chen</span></div>
            </div>
            <div className={styles.peopleGroup}>
              <div className={styles.peopleGroupHeader}>Solicitors</div>
              <div className={styles.peopleItem}><span>Ashfield &amp; Co</span><span className={styles.peopleItemRole}>Vendor</span></div>
              <div className={styles.peopleItem}><span>Grange Legal</span><span className={styles.peopleItemRole}>Buyer</span></div>
            </div>
          </TiltPanel>

          {/* Chase intel — compact context */}
          <TiltPanel className={styles.sidebarCompact} strength={3} style={{ animation: "vibeFadeUp 560ms cubic-bezier(0.16, 1, 0.3, 1) 440ms both" }}>
            <div className={styles.sidebarLabel}>Chase intel</div>
            <div className={styles.chaseIntel}>
              <div className={styles.chaseIntelPrimary}>{chaseCount} chases · 8 weeks</div>
              <div className={styles.chaseIntelContext}>
                <span className={styles.chaseIntelAbove}>Above typical</span> for this stage (median is 12).
              </div>
            </div>
          </TiltPanel>
        </div>
      </div>

      {chainOpen && (
        <>
          <div className={styles.drawerBackdrop} onClick={() => setChainOpen(false)} />
          <div className={styles.drawer} role="dialog" aria-label="Chain">
            <div className={styles.drawerHead}>
              <div>
                <div className={styles.drawerTitle}>Chain</div>
                <div className={styles.drawerSub}>Every linked sale, in one place</div>
              </div>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setChainOpen(false)}>Close</button>
            </div>
            {chain.map((c, i) => (
              <div key={c.id}>
                {i > 0 && <div className={styles.chainConnector} />}
                <div className={styles.chainLink} data-viewer={c.isViewer} data-declined={c.isDeclined}>
                  <div className={styles.chainDot} data-kind={c.kind} />
                  <div className={styles.chainMeta}>
                    <div className={styles.chainName}>{c.name}</div>
                    <div className={styles.chainSub}>{c.sub}</div>
                  </div>
                  <span className={styles.chainStatus}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ─── ELEMENT GALLERY ──────────────────────────────────────────────────────

function ElementGallery() {
  const [val, setVal] = useState("");
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Elements</h2>
          <p className={styles.sectionSubtitle}>The alphabet the app is written in</p>
        </div>
      </header>

      <div className={styles.gallery}>
        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Buttons</div>
          <div className={styles.galleryTileBody}>
            <button className={`${styles.btn} ${styles.btnPrimary}`}>Confirm</button>
            <button className={`${styles.btn} ${styles.btnSecondary}`}>Cancel</button>
            <button className={`${styles.btn} ${styles.btnGhost}`}>Skip</button>
            <button className={`${styles.btn} ${styles.btnDanger}`}>Remove</button>
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnDisabled}`} disabled>Disabled</button>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Status pills</div>
          <div className={styles.galleryTileBody}>
            <StatusPill status="escalated" pulse />
            <StatusPill status="overdue" />
            <StatusPill status="due_today" />
            <StatusPill status="on_track" />
            <StatusPill status="on_hold" />
            <StatusPill status="completed" />
          </div>
        </TiltPanel>

        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Input</div>
          <div className={styles.galleryTileBody} style={{ width: "100%" }}>
            <input
              className={styles.input}
              placeholder="Search files, contacts..."
              value={val}
              onChange={(e) => setVal(e.target.value)}
            />
          </div>
        </TiltPanel>

        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Loading skeleton</div>
          <div className={styles.galleryTileBody} style={{ flexDirection: "column", alignItems: "stretch", width: "100%" }}>
            <div className={styles.skeleton} style={{ width: "80%" }} />
            <div className={styles.skeleton} style={{ width: "60%" }} />
            <div className={styles.skeleton} style={{ width: "70%" }} />
          </div>
        </TiltPanel>

        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Empty state</div>
          <div className={styles.galleryTileBody} style={{ justifyContent: "center", width: "100%" }}>
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>◇</div>
              <div className={styles.emptyText}>All caught up</div>
            </div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Error state</div>
          <div className={styles.galleryTileBody} style={{ width: "100%" }}>
            <div className={styles.errorState}>Something went wrong loading this file. Try again.</div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Toast</div>
          <div className={styles.galleryTileBody} style={{ width: "100%" }}>
            <div className={styles.toast}>
              <div className={styles.toastDot} />
              <span>Chase sent to Ashfield &amp; Co</span>
            </div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.galleryTile} strength={3}>
          <div className={styles.galleryTileLabel}>Avatars</div>
          <div className={styles.galleryTileBody}>
            <AvatarStack initials={["BP", "JP", "MC", "EC"]} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>+2 more</span>
          </div>
        </TiltPanel>
      </div>
    </section>
  );
}

// ─── ANIMATION LAB ────────────────────────────────────────────────────────

function AnimationLab() {
  const [slideKey, setSlideKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [countTarget, setCountTarget] = useState(0);
  const countValue = useCountUp(countTarget, 900);
  const [staggerKey, setStaggerKey] = useState(0);
  const scrollTargetRef = useRef<HTMLDivElement>(null);
  const [scrollOpacity, setScrollOpacity] = useState(1);

  useEffect(() => {
    function onScroll() {
      if (!scrollTargetRef.current) return;
      const rect = scrollTargetRef.current.getBoundingClientRect();
      const centre = window.innerHeight / 2;
      const dist = Math.abs(rect.top + rect.height / 2 - centre);
      const opacity = Math.max(0.25, 1 - dist / 400);
      setScrollOpacity(opacity);
    }
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Animation lab</h2>
          <p className={styles.sectionSubtitle}>Click any tile to fire the animation in isolation</p>
        </div>
      </header>

      <div className={styles.animGrid}>
        <TiltPanel className={styles.animCard} strength={3} onClick={() => setSlideKey((k) => k + 1)}>
          <div className={styles.animLabel}>Route slide</div>
          <div className={styles.animPreviewArea}>
            <div
              key={slideKey}
              className={styles.routeSlideIn}
              style={{ padding: "10px 14px", background: "linear-gradient(135deg, #00E5FF, #FF3BC8)", color: "#0A0F1E", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: "-0.005em", boxShadow: "0 6px 20px rgba(0, 229, 255, 0.3)" }}
            >
              Page
            </div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={5}>
          <div className={styles.animLabel}>Card hover-tilt</div>
          <div className={styles.animPreviewArea} style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)" }}>
            Hover to tilt me
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3}>
          <div className={styles.animLabel}>Button press + sheen</div>
          <div className={styles.animPreviewArea}>
            <button className={`${styles.btn} ${styles.btnPrimary}`}>Press me</button>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3}>
          <div className={styles.animLabel}>Count-up</div>
          <div className={styles.animPreviewArea}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.035em", fontFeatureSettings: '"tnum" 1, "lnum" 1', color: "rgba(255,255,255,0.98)" }}>
                {countValue.toLocaleString()}
              </div>
              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                style={{ padding: "5px 10px", fontSize: 11 }}
                onClick={() => setCountTarget((c) => (c === 0 ? 3247 : c === 3247 ? 12480 : 0))}
              >
                Fire
              </button>
            </div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3}>
          <div className={styles.animLabel}>Idle pulse</div>
          <div className={styles.animPreviewArea}>
            <span className={styles.idlePulse}>Live</span>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3} onClick={() => setStaggerKey((k) => k + 1)}>
          <div className={styles.animLabel}>Stagger reveal</div>
          <div className={styles.animPreviewArea} style={{ flexDirection: "column", alignItems: "stretch", padding: 10 }}>
            <div key={staggerKey} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.staggerItem} style={{ animationDelay: `${i * 65}ms`, width: `${100 - i * 6}%` }} />
              ))}
            </div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3}>
          <div className={styles.animLabel}>Scroll-linked opacity</div>
          <div className={styles.animPreviewArea} ref={scrollTargetRef}>
            <div className={styles.scrollFadeTarget} style={{ opacity: scrollOpacity, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              Scroll — I fade at the edges
            </div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3}>
          <div className={styles.animLabel}>Drawer + backdrop blur</div>
          <div className={styles.animPreviewArea} style={{ position: "relative" }}>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setDrawerOpen((o) => !o)}>
              {drawerOpen ? "Close" : "Open"}
            </button>
            <div className={styles.miniBackdrop} data-open={drawerOpen} />
            <div className={styles.miniDrawer} data-open={drawerOpen}>Slide-in drawer</div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3}>
          <div className={styles.animLabel}>Progress ring fill</div>
          <div className={styles.animPreviewArea}>
            <ProgressAnim />
          </div>
        </TiltPanel>

        <TiltPanel className={styles.animCard} strength={3}>
          <div className={styles.animLabel}>Tab slide</div>
          <div className={styles.animPreviewArea} style={{ padding: 8 }}>
            <MiniTabs />
          </div>
        </TiltPanel>
      </div>
    </section>
  );
}

function ProgressAnim() {
  const [pct, setPct] = useState(20);
  useEffect(() => {
    const id = setInterval(() => setPct((p) => (p >= 100 ? 20 : p + 20)), 900);
    return () => clearInterval(id);
  }, []);
  return <ProgressRing percent={pct} size={58} stroke={5} label={`${pct}%`} small glow />;
}

function MiniTabs() {
  const [active, setActive] = useState<"a" | "b" | "c">("a");
  const barRef = useRef<HTMLDivElement>(null);
  const [u, setU] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    if (!barRef.current) return;
    const btn = barRef.current.querySelector<HTMLButtonElement>(`button[data-k="${active}"]`);
    if (!btn) return;
    const p = barRef.current.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    setU({ left: r.left - p.left, width: r.width });
  }, [active]);
  return (
    <div ref={barRef} className={styles.tabBar} style={{ margin: 0 }}>
      <div className={styles.tabBg} style={{ left: u.left, width: u.width }} />
      {(["a", "b", "c"] as const).map((k, i) => (
        <button
          key={k}
          data-k={k}
          data-active={active === k}
          className={styles.tab}
          onClick={() => setActive(k)}
          style={{ fontSize: 11.5, padding: "6px 12px" }}
        >
          Tab {i + 1}
        </button>
      ))}
    </div>
  );
}

// ─── TOKENS ───────────────────────────────────────────────────────────────

function TokenPanel() {
  const colors = useMemo(() => ([
    { label: "Bg deep", val: "#06091A", chip: "#06091A" },
    { label: "Bg mid", val: "#0A0F26", chip: "#0A0F26" },
    { label: "Bg surface", val: "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))", chip: "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))" },
    { label: "Accent cyan", val: "#00E5FF", chip: "#00E5FF" },
    { label: "Accent magenta", val: "#FF3BC8", chip: "#FF3BC8" },
    { label: "Accent gradient", val: "linear-gradient(135deg, cyan → magenta)", chip: "linear-gradient(135deg, #00E5FF, #FF3BC8)" },
    { label: "Success", val: "#4AFFB3", chip: "#4AFFB3" },
    { label: "Warning", val: "#FFAA1F", chip: "#FFAA1F" },
    { label: "Danger", val: "#FF5C7A", chip: "#FF5C7A" },
    { label: "On hold", val: "#A38CFF", chip: "#A38CFF" },
  ]), []);

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Tokens</h2>
          <p className={styles.sectionSubtitle}>The atoms that produce the feel</p>
        </div>
      </header>

      <div className={styles.tokenGrid}>
        <TiltPanel className={styles.tokenBlock} strength={2}>
          <div className={styles.tokenBlockLabel}>Colour</div>
          {colors.map((c) => (
            <div key={c.label} className={styles.swatch}>
              <div className={styles.swatchChip} style={{ background: c.chip }} />
              <span>{c.label}</span>
            </div>
          ))}
        </TiltPanel>

        <TiltPanel className={styles.tokenBlock} strength={2}>
          <div className={styles.tokenBlockLabel}>Type scale</div>
          <div className={styles.typeSample}>
            <div className={styles.typeSampleLabel}>hero num · 56px</div>
            <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 0.95, color: "rgba(255,255,255,0.98)" }}>44</div>
          </div>
          <div className={styles.typeSample}>
            <div className={styles.typeSampleLabel}>address · 46px</div>
            <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1, color: "rgba(255,255,255,0.98)" }}>Sample</div>
          </div>
          <div className={styles.typeSample}>
            <div className={styles.typeSampleLabel}>section · 32px</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.035em", color: "rgba(255,255,255,0.98)" }}>Sample</div>
          </div>
          <div className={styles.typeSample}>
            <div className={styles.typeSampleLabel}>body · 13.5px</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.9)" }}>Sample body text</div>
          </div>
          <div className={styles.typeSample}>
            <div className={styles.typeSampleLabel}>meta · 11px</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Sample meta</div>
          </div>
        </TiltPanel>

        <TiltPanel className={styles.tokenBlock} strength={2}>
          <div className={styles.tokenBlockLabel}>Surface + radius</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[10, 14, 20, 999].map((r) => (
              <div
                key={r}
                style={{
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "0.5px solid rgba(255, 255, 255, 0.14)",
                  borderRadius: r,
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {r === 999 ? "pill" : `${r}px`}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", marginTop: 14, lineHeight: 1.5, letterSpacing: "-0.005em" }}>
            30px backdrop-filter blur, saturation 1.55, layered inset + drop shadow for real depth
          </div>
        </TiltPanel>

        <TiltPanel className={styles.tokenBlock} strength={2}>
          <div className={styles.tokenBlockLabel}>Motion</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>spring · 380ms · 1.45 bounce</div>
              <div className={styles.motionBar} />
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.42)", fontFamily: "SF Mono, Menlo, monospace", lineHeight: 1.5 }}>
              cubic-bezier(0.34, 1.45, 0.64, 1)
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.42)", fontFamily: "SF Mono, Menlo, monospace", lineHeight: 1.5 }}>
              pointer-tilt: ±4-6deg rotateX/Y
            </div>
          </div>
        </TiltPanel>
      </div>
    </section>
  );
}

// ─── THEME PICKER ─────────────────────────────────────────────────────────

type ThemeId =
  | "kinetic" | "sunset" | "coastal" | "heritage" | "slate" | "emerald" | "claret"
  | "sage" | "dusk" | "stone" | "mist" | "blush" | "dark";

type ThemeMeta = {
  id: ThemeId;
  label: string;
  swatchA: string;  // gradient background start
  swatchB: string;  // gradient background end
  orb1: string;     // orb glow 1
  orb2: string;     // orb glow 2
  accentA: string;  // accent gradient start (dot in bottom-right)
  accentB: string;  // accent gradient end
};

const DESKTOP_THEMES: ThemeMeta[] = [
  { id: "kinetic",  label: "Kinetic",  swatchA: "#0A0F26", swatchB: "#0D1330", orb1: "rgba(0,194,255,0.35)", orb2: "rgba(255,59,202,0.28)", accentA: "#00E5FF", accentB: "#FF3BC8" },
  { id: "sunset",   label: "Sunset",   swatchA: "#14090C", swatchB: "#22131A", orb1: "rgba(255,165,60,0.4)",  orb2: "rgba(255,90,120,0.32)", accentA: "#FFB84A", accentB: "#FF5C7A" },
  { id: "coastal",  label: "Coastal",  swatchA: "#08182A", swatchB: "#0B2038", orb1: "rgba(80,200,255,0.4)",  orb2: "rgba(40,220,200,0.3)",  accentA: "#6EE7FF", accentB: "#4AF0D0" },
  { id: "heritage", label: "Heritage", swatchA: "#120C08", swatchB: "#1E140C", orb1: "rgba(200,80,60,0.32)",  orb2: "rgba(220,170,90,0.24)", accentA: "#E8B958", accentB: "#C9435A" },
  { id: "slate",    label: "Slate",    swatchA: "#14161B", swatchB: "#1E2229", orb1: "rgba(160,175,200,0.25)",orb2: "rgba(120,135,160,0.2)", accentA: "#D0DCEA", accentB: "#7C8B9F" },
  { id: "emerald",  label: "Emerald",  swatchA: "#061812", swatchB: "#0B2820", orb1: "rgba(74,255,179,0.32)", orb2: "rgba(29,216,128,0.26)", accentA: "#4AFFB3", accentB: "#1DD880" },
  { id: "claret",   label: "Claret",   swatchA: "#150B14", swatchB: "#241324", orb1: "rgba(200,60,100,0.32)", orb2: "rgba(160,80,180,0.26)", accentA: "#E85EA0", accentB: "#9B4AE8" },
];

const MOBILE_THEMES: ThemeMeta[] = [
  { id: "heritage", label: "Heritage", swatchA: "#120C08", swatchB: "#1E140C", orb1: "rgba(200,80,60,0.32)",  orb2: "rgba(220,170,90,0.24)", accentA: "#E8B958", accentB: "#C9435A" },
  { id: "sage",     label: "Sage",     swatchA: "#0C130C", swatchB: "#171F17", orb1: "rgba(140,190,100,0.28)",orb2: "rgba(200,200,140,0.22)",accentA: "#B8D97A", accentB: "#E8DDA5" },
  { id: "dusk",     label: "Dusk",     swatchA: "#0C0D22", swatchB: "#191938", orb1: "rgba(160,130,255,0.38)",orb2: "rgba(120,150,255,0.3)", accentA: "#A88CFF", accentB: "#7CB8FF" },
  { id: "stone",    label: "Stone",    swatchA: "#14110D", swatchB: "#211C16", orb1: "rgba(200,170,130,0.28)",orb2: "rgba(170,140,110,0.22)",accentA: "#DAC5A3", accentB: "#B8987A" },
  { id: "mist",     label: "Mist",     swatchA: "#10141E", swatchB: "#1C2230", orb1: "rgba(160,195,235,0.28)",orb2: "rgba(190,175,220,0.24)",accentA: "#A8CBEA", accentB: "#C5B5E0" },
  { id: "blush",    label: "Blush",    swatchA: "#180B10", swatchB: "#28131C", orb1: "rgba(255,130,170,0.32)",orb2: "rgba(255,170,130,0.26)",accentA: "#FFA8C4", accentB: "#FFCFA0" },
];

const DARK_THEME: ThemeMeta = { id: "dark", label: "Pure dark", swatchA: "#0C0D11", swatchB: "#14161B", orb1: "rgba(80,85,95,0.2)", orb2: "rgba(60,65,75,0.16)", accentA: "#E4E7EE", accentB: "#A8AEB8" };

const THEME_LOOKUP: Record<ThemeId, ThemeMeta> = Object.fromEntries(
  [...DESKTOP_THEMES, ...MOBILE_THEMES.filter((t) => t.id !== "heritage"), DARK_THEME].map((t) => [t.id, t])
) as Record<ThemeId, ThemeMeta>;

function ThemeSwatch({ theme }: { theme: ThemeMeta }) {
  return (
    <div className={styles.themeOptionSwatch}>
      <div
        className={styles.themeOptionSwatchInner}
        style={{
          ["--sw-a" as string]: theme.swatchA,
          ["--sw-b" as string]: theme.swatchB,
          ["--sw-orb-1" as string]: theme.orb1,
          ["--sw-orb-2" as string]: theme.orb2,
        } as React.CSSProperties}
      />
      <div
        className={styles.themeOptionSwatchAccent}
        style={{
          ["--sw-acc-a" as string]: theme.accentA,
          ["--sw-acc-b" as string]: theme.accentB,
        } as React.CSSProperties}
      />
    </div>
  );
}

function ThemePicker({ theme, setTheme }: { theme: ThemeId; setTheme: (t: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = THEME_LOOKUP[theme];

  return (
    <div className={styles.themePickerWrap}>
      <button
        ref={btnRef}
        className={styles.themePickerBtn}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.themeSwatch} />
        <span>{current.label}</span>
        <span className={styles.themePickerChev}>▾</span>
      </button>
      {open && (
        <div ref={panelRef} className={styles.themePanel}>
          <div className={styles.themePanelSection}>
            <div className={styles.themePanelLabel}>Desktop themes</div>
            <div className={styles.themeGrid}>
              {DESKTOP_THEMES.map((t) => (
                <button
                  key={`d-${t.id}`}
                  className={styles.themeOption}
                  data-active={theme === t.id}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                >
                  <ThemeSwatch theme={t} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.themePanelSection}>
            <div className={styles.themePanelLabel}>Mobile themes</div>
            <div className={styles.themeGrid}>
              {MOBILE_THEMES.map((t) => (
                <button
                  key={`m-${t.id}`}
                  className={styles.themeOption}
                  data-active={theme === t.id}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                >
                  <ThemeSwatch theme={t} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.themePanelSection}>
            <div className={styles.themePanelLabel}>Dark mode</div>
            <div className={styles.themeGrid}>
              <button
                className={styles.themeOption}
                data-active={theme === "dark"}
                onClick={() => { setTheme("dark"); setOpen(false); }}
              >
                <ThemeSwatch theme={DARK_THEME} />
                <span>Pure dark</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

export default function VibePage() {
  const [theme, setTheme] = useState<ThemeId>("kinetic");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vibe-theme");
      if (saved && saved in THEME_LOOKUP) setTheme(saved as ThemeId);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("vibe-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  return (
    <div className={styles.root} data-theme={theme}>
      {/* Global keyframes — hoisted for use in both CSS module + inline styles.
          Turbopack's CSS Modules can't :global @keyframes so we live here. */}
      <style>{`
        @keyframes vibeFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes vibePulseRing {
          0% { transform: scale(1); opacity: 0.55; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes vibeActiveDot {
          0%, 100% {
            box-shadow: 0 0 12px rgba(0, 229, 255, 0.6), 0 0 24px rgba(255, 59, 200, 0.35);
          }
          50% {
            box-shadow: 0 0 20px rgba(0, 229, 255, 0.75), 0 0 40px rgba(255, 59, 200, 0.5);
          }
        }
        @keyframes vibeShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes vibeRouteSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vibeDrawerIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes vibeMotionLoop {
          0%, 90%, 100% { transform: scaleX(0); }
          20%, 70% { transform: scaleX(1); }
        }
        @keyframes vibeDotBreath {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.7; }
        }
        @keyframes vibeOrbA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15vw, 12vh) scale(1.1); }
          66% { transform: translate(-8vw, 18vh) scale(0.95); }
        }
        @keyframes vibeOrbB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(-14vw, -18vh) scale(1.15); }
          75% { transform: translate(10vw, -6vh) scale(0.9); }
        }
        @keyframes vibeOrbC {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20vw, -10vh) scale(1.2); }
        }
        @keyframes vibeBarRise {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes vibeRibbonSlide {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes vibeBackdropRamp {
          from { background: rgba(5, 7, 15, 0); backdrop-filter: blur(0px) saturate(1); -webkit-backdrop-filter: blur(0px) saturate(1); }
          to { background: rgba(5, 7, 15, 0.45); backdrop-filter: blur(16px) saturate(0.9); -webkit-backdrop-filter: blur(16px) saturate(0.9); }
        }
        @keyframes vibeAttentionIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className={styles.orbLayer}>
        <div className={`${styles.orb} ${styles.orbCyan}`} />
        <div className={`${styles.orb} ${styles.orbMagenta}`} />
        <div className={`${styles.orb} ${styles.orbCoral}`} />
      </div>

      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.headerDot} />
          Sales Progressor <span>/ dev preview</span>
        </div>
        <ThemePicker theme={theme} setTheme={setTheme} />
      </header>

      <HubSection />
      <FileDetailSection />
      <ElementGallery />
      <AnimationLab />
      <TokenPanel />

      <div className={styles.footer}>
        /dev/vibe · not linked from production · fabricated data
      </div>
    </div>
  );
}
