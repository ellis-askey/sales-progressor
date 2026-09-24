"use client";

// Account -> Client portal (director). Agency-wide "what your clients see"
// toggles, each with a LIVE preview of the real portal component it controls
// (rendered exactly as buyers/sellers see it, with example data). Flip a switch
// and the element shows or collapses to a "hidden" state. Each row saves on flip
// via setAgencyPortalDisplay; optimistic with revert on error. Only key-dates is
// overridable per file (in the file's Client settings drawer).

import { useState, useTransition } from "react";
import { setAgencyPortalDisplay, type PortalDisplayField } from "@/app/actions/portal-display";
import { PortalKeyDatesCard } from "@/components/portal/PortalKeyDatesCard";
import { PortalCostsCard } from "@/components/portal/PortalCostsCard";

export type ClientPortalDisplay = {
  showPortalKeyDates: boolean;
  showPortalCosts: boolean;
  showPortalProgressPercent: boolean;
  showPortalWelcomeSheet: boolean;
};

const ROWS: { field: PortalDisplayField; label: string; sub: string; note?: string; hidden: string }[] = [
  {
    field: "showPortalKeyDates",
    label: "Key dates",
    sub: "Show the 12-week target and estimated exchange date.",
    note: "This can be changed for individual sales in Client settings.",
    hidden: "The dates card won't appear on their portal.",
  },
  {
    field: "showPortalCosts",
    label: "Stamp duty & costs",
    sub: "Show the buyer's stamp duty estimate and their Your costs card.",
    hidden: "Buyers won't see the stamp duty or costs card.",
  },
  {
    field: "showPortalProgressPercent",
    label: "Progress figure",
    sub: "Show the percentage progress figure on the overview.",
    hidden: "The number is hidden; the ring itself stays.",
  },
  {
    field: "showPortalWelcomeSheet",
    label: "First-visit welcome",
    sub: "Show a short welcome when a client visits their portal for the first time.",
    hidden: "No welcome shows on a client's first visit.",
  },
];

// Example data so the real components render as they would on a live file.
const KD = {
  targetDate: new Date(Date.UTC(2026, 10, 16)),
  estimateDate: new Date(Date.UTC(2026, 10, 24)),
  plannedDate: null,
  daysUntilPredicted: 64,
};

// Preview surfaces render the CLIENT portal (always light), so they show a
// light "portal" backdrop regardless of the agent's theme.
function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 13, borderRadius: 12, background: "#eef2f9", border: "1px solid var(--agent-border-subtle)", padding: 14 }}>
      {children}
    </div>
  );
}
function HiddenPreview({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 13, borderRadius: 12, border: "1px dashed var(--agent-border-default)", padding: "20px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Hidden from clients</div>
      <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--agent-text-muted)" }}>{text}</div>
    </div>
  );
}

// The overview progress ring (portal), reproduced at preview scale.
function MiniRing() {
  const size = 84, stroke = 6, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,23,42,0.16)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FF6B4A" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * 0.5} ${c}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>3</span>
          <span style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>of 6</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#475569" }}>Current stage<br /><b style={{ color: "#0f172a" }}>Conveyancing</b></div>
    </div>
  );
}

// The first-visit welcome (portal), reproduced at preview scale.
function MiniWelcome() {
  return (
    <div style={{ maxWidth: 260, margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 16px 18px", textAlign: "center", boxShadow: "0 6px 18px -12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Welcome, Sarah</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Your purchase starts here.</div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6B4A" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2e8f0" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2e8f0" }} />
      </div>
    </div>
  );
}

function renderPreview(field: PortalDisplayField, on: boolean, hidden: string) {
  if (!on) return <HiddenPreview text={hidden} />;
  switch (field) {
    case "showPortalKeyDates":
      return <PreviewShell><PortalKeyDatesCard targetDate={KD.targetDate} estimateDate={KD.estimateDate} plannedDate={KD.plannedDate} daysUntilPredicted={KD.daysUntilPredicted} /></PreviewShell>;
    case "showPortalCosts":
      return (
        <PreviewShell>
          <PortalCostsCard
            priceGBP={425000}
            hasExchanged={false}
            isCash={false}
            savedDeposit={null}
            savedMortgage={null}
            savedOtherFunds={null}
            savedFtb={false}
            savedAdditional={null}
            savedFundsSent={false}
            token="preview"
            previewMode
          />
        </PreviewShell>
      );
    case "showPortalProgressPercent":
      return <PreviewShell><MiniRing /></PreviewShell>;
    case "showPortalWelcomeSheet":
      return <PreviewShell><MiniWelcome /></PreviewShell>;
  }
}

function ToggleRow({
  field, label, sub, note, hidden, value, onChange, last,
}: {
  field: PortalDisplayField;
  label: string;
  sub: string;
  note?: string;
  hidden: string;
  value: boolean;
  onChange: (field: PortalDisplayField, next: boolean) => void;
  last: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !value;
    setError(null);
    onChange(field, next);
    start(async () => {
      const res = await setAgencyPortalDisplay(field, next);
      if (!res.ok) {
        onChange(field, !next);
        setError(res.error);
      }
    });
  }

  return (
    <div className={`py-4${last ? "" : " border-b border-slate-200"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-slate-900">{label}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 max-w-xl">{sub}</p>
          {note && <p className="mt-1 text-[11.5px] italic text-slate-400">{note}</p>}
          {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={label}
          disabled={pending}
          onClick={toggle}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${value ? "bg-[#FF6B4A]" : "bg-slate-300"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
        </button>
      </div>
      {renderPreview(field, value, hidden)}
    </div>
  );
}

export function ClientPortalSettings({ initial }: { initial: ClientPortalDisplay }) {
  const [state, setState] = useState<ClientPortalDisplay>(initial);
  const onChange = (field: PortalDisplayField, next: boolean) =>
    setState((s) => ({ ...s, [field]: next }));

  return (
    <div>
      {ROWS.map((r, i) => (
        <ToggleRow
          key={r.field}
          field={r.field}
          label={r.label}
          sub={r.sub}
          note={r.note}
          hidden={r.hidden}
          value={state[r.field]}
          onChange={onChange}
          last={i === ROWS.length - 1}
        />
      ))}
    </div>
  );
}
