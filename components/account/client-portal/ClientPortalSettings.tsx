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
import { PortalSheet } from "@/components/portal/PortalSheet";
import { PortalWelcomeSheet } from "@/components/portal/PortalWelcomeSheet";
import { PortalSettingsPreviewProvider } from "@/components/portal/PortalSettingsProvider";

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
    sub: "Show the buyer's costs card: their stamp duty estimate before exchange, and a full breakdown of deposit, fees and stamp duty after.",
    hidden: "Buyers won't see their costs card.",
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
    sub: "Give clients a friendly introduction when they first arrive.",
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

// Stamp duty & costs preview: the REAL portal card (previewMode = no saving),
// plus a director-only "example price" control so figures can be checked across
// values (clients never edit the price — it comes from the file).
function CostsPreview() {
  // Kept as a comma-formatted string so it never gets stuck on 0 and shows
  // thousands separators; the number for the card is derived from the digits.
  const [priceStr, setPriceStr] = useState("425,000");
  const price = Number(priceStr.replace(/[^\d]/g, "")) || 0;
  // After-exchange "Your costs" card is shown in a drawer (like the stamp-duty
  // sheet) rather than inline, so the preview stays compact.
  const [costsOpen, setCostsOpen] = useState(false);
  // Stamp-duty situation is shared across BOTH preview cards so an agent playing
  // with it (first-time buyer / second property) sees the same figure everywhere.
  const [sdlt, setSdlt] = useState<{ ftb: boolean; additional: boolean | null }>({ ftb: false, additional: null });
  return (
    <PreviewShell>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#334155" }}>Example price</span>
        <span style={{ display: "inline-flex", alignItems: "center", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ color: "#64748b", fontSize: 13 }}>£</span>
          <input
            type="text"
            inputMode="numeric"
            value={priceStr}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
              setPriceStr(digits ? Number(digits).toLocaleString("en-GB") : "");
            }}
            style={{ border: "none", outline: "none", width: 100, fontSize: 13, fontWeight: 700, color: "#0f172a", background: "transparent", marginLeft: 2 }}
          />
        </span>
      </div>
      {/* The costs card changes across the sale's life: a stamp-duty estimate
          before exchange, then the full "Your costs" breakdown after. A client
          only ever sees one at a time, so we preview both here. The after-
          exchange card is live — fill the figures in to see exactly what the
          buyer will (nothing saves from the preview). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(272px, 1fr))", gap: 16, alignItems: "start" }}>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#64748b" }}>Before exchange</p>
          <PortalCostsCard
            priceGBP={price}
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
            sharedSdlt={sdlt}
            onSharedSdltChange={setSdlt}
          />
        </div>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#64748b" }}>After exchange</p>
          {/* Compact launcher, styled like the stamp-duty card. Opens the full
              "Your costs" card in an animated drawer. */}
          <button
            type="button"
            onClick={() => setCostsOpen(true)}
            className="pbtn pbtn-press cp-lift portal-chev"
            style={{
              display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
              cursor: "pointer", fontFamily: "inherit",
              borderRadius: 16, padding: 16,
              background: "linear-gradient(160deg, rgba(59,130,246,0.09), rgba(59,130,246,0.02))",
              border: "0.5px solid rgba(59,130,246,0.14)",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <circle cx="12" cy="14" r="2.5" />
            </svg>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Your costs</span>
              <span style={{ display: "block", fontSize: 12.5, color: "#475569", marginTop: 1 }}>The full breakdown buyers get after exchange. Tap to preview.</span>
            </span>
            <svg className="portal-chev-i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* The after-exchange costs card in a drawer — animated in/out like the
          stamp-duty sheet. previewMode hides its Save button and blocks writes. */}
      <PortalSheet open={costsOpen} onClose={() => setCostsOpen(false)} lockScroll={false}>
        <div style={{ padding: "4px 12px 12px" }}>
          <PortalCostsCard
            priceGBP={price}
            hasExchanged
            isCash={false}
            savedDeposit={null}
            savedMortgage={null}
            savedOtherFunds={null}
            savedFtb={false}
            savedAdditional={null}
            savedFundsSent={false}
            token="preview"
            previewMode
            sharedSdlt={sdlt}
            onSharedSdltChange={setSdlt}
          />
        </div>
      </PortalSheet>
    </PreviewShell>
  );
}

// The first-visit welcome is a slide-up MODAL, not a card. So the preview is a
// lift-on-hover card with an "Open" button that opens the REAL sheet a client
// sees on their first visit.
function WelcomePreview() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 13 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cp-lift"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
          background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)",
          borderRadius: 12, padding: "14px 16px",
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>See it for yourself</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 2 }}>Preview the welcome exactly as your clients will see it.</span>
        </span>
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", background: "var(--agent-coral-deep, #E5533A)", color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: 9 }}>Open</span>
      </button>
      <PortalWelcomeSheet
        token="preview"
        side="purchaser"
        alreadySeen
        previewMode
        previewOpen={open}
        onPreviewClose={() => setOpen(false)}
      />
    </div>
  );
}

function renderPreview(field: PortalDisplayField, on: boolean, hidden: string) {
  if (!on) return <HiddenPreview text={hidden} />;
  switch (field) {
    case "showPortalKeyDates":
      return <PreviewShell><PortalKeyDatesCard targetDate={KD.targetDate} estimateDate={KD.estimateDate} plannedDate={KD.plannedDate} daysUntilPredicted={KD.daysUntilPredicted} /></PreviewShell>;
    case "showPortalCosts":
      return <CostsPreview />;
    case "showPortalProgressPercent":
      return <PreviewShell><MiniRing /></PreviewShell>;
    case "showPortalWelcomeSheet":
      return <WelcomePreview />;
  }
}

function ToggleRow({
  field, label, sub, note, hidden, value, onChange, last, inline = false,
}: {
  field: PortalDisplayField;
  label: string;
  sub: string;
  note?: string;
  hidden: string;
  value: boolean;
  onChange: (field: PortalDisplayField, next: boolean) => void;
  last: boolean;
  // inline: wording + toggle on the left, the (narrow) preview on the right,
  // stacking on small screens. Used for the compact Progress figure.
  inline?: boolean;
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

  const switchBtn = (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={pending}
      onClick={toggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${value ? "bg-[#FF6B4A]" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
    </button>
  );

  const meta = (
    <div className="min-w-0">
      <p className="text-[14px] font-bold text-slate-900">{label}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 max-w-xl">{sub}</p>
      {note && <p className="mt-1 text-[11.5px] italic text-slate-400">{note}</p>}
      {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
    </div>
  );

  if (inline) {
    return (
      <div className={`py-4${last ? "" : " border-b border-slate-200"}`}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "0 0 25%", minWidth: 190 }}>
            {meta}
            <div style={{ marginTop: 12 }}>{switchBtn}</div>
          </div>
          {/* Content-width, so the ring + current-stage sit compact rather than
              stretching across the row. */}
          <div style={{ flex: "0 0 auto", minWidth: 0 }}>
            {renderPreview(field, value, hidden)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`py-4${last ? "" : " border-b border-slate-200"}`}>
      <div className="flex items-start justify-between gap-4">
        {meta}
        <div className="mt-0.5">{switchBtn}</div>
      </div>
      {renderPreview(field, value, hidden)}
    </div>
  );
}

export function ClientPortalSettings({ initial }: { initial: ClientPortalDisplay }) {
  const [state, setState] = useState<ClientPortalDisplay>(initial);
  const onChange = (field: PortalDisplayField, next: boolean) =>
    setState((s) => ({ ...s, [field]: next }));

  const cell = (r: typeof ROWS[number], last: boolean) => (
    <ToggleRow
      key={r.field}
      field={r.field}
      label={r.label}
      sub={r.sub}
      note={r.note}
      hidden={r.hidden}
      value={state[r.field]}
      onChange={onChange}
      last={last}
    />
  );

  return (
    <PortalSettingsPreviewProvider>
      <div>
        {/* Key dates + Stamp duty & costs are tall — full width. */}
        {ROWS.slice(0, 2).map((r) => cell(r, false))}
        {/* Progress figure + First-visit welcome are compact — side by side. */}
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 border-t border-slate-200">
          {ROWS.slice(2).map((r) => cell(r, true))}
        </div>
      </div>
    </PortalSettingsPreviewProvider>
  );
}
