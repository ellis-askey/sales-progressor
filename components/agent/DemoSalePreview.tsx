"use client";

// Static, non-interactive replica of the 14 Beaumont Rise demo file "Overview"
// view, shown in the right panel of the Explore-a-demo modal. Every value is
// hard-coded to match the seeded demo (lib/services/demo-sale.ts). No handlers,
// no hrefs — clicking anything does nothing; it's a faithful still of the file.
// Must be rendered inside a data-theme-stamped container so --agent-* resolves.

import {
  ArrowLeft, CaretDown, EnvelopeSimple, CurrencyGbp, UserCircle, HouseSimple,
  CalendarBlank, Clock, Fire, Heartbeat, Phone, ChatCircleText, DotsThree, Plus,
  WhatsappLogo, House, ListChecks, Bell, PaperPlaneTilt, CheckSquare, FileText, Pulse,
} from "@phosphor-icons/react";
import { ContactAvatar } from "@/components/ui/Avatar";

const CARD: React.CSSProperties = {
  background: "var(--agent-surface-elevated)",
  border: "0.5px solid var(--agent-border-default)",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)",
};

function StatCell({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  // No tinted box — bare coral icon + text, matching the "Added / clock" meta cell.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flexShrink: 0, color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>{label}</div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: valueColor ?? "var(--agent-text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

const TABS = [
  { label: "Overview", Icon: House },
  { label: "Steps", Icon: ListChecks },
  { label: "Reminders", Icon: Bell },
  { label: "Chase timeline", Icon: PaperPlaneTilt },
  { label: "To-Do", Icon: CheckSquare, badge: "1" },
  { label: "Documents", Icon: FileText },
  { label: "Activity", Icon: Pulse },
];

export function DemoSalePreview() {
  return (
    <div className="demo-preview" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Header card ─────────────────────────────────────────────── */}
      <div className="demo-hero-card" style={{ ...CARD, borderRadius: 18, overflow: "hidden" }}>
        {/* Photo */}
        <div className="demo-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/agent/demo-house.png"
            alt=""
            className="demo-hero-photo-img"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <span className="demo-back-to-files" style={{ position: "absolute", top: 13, left: 13, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: "rgba(15,23,42,0.42)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
            <ArrowLeft size={13} weight="bold" /> Back to files
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", padding: "18px 20px" }}>
          {/* Status + progress (progress now runs to the right edge) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {/* Polished green Active pill */}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px 5px 10px", borderRadius: 999, background: "linear-gradient(180deg, #34D399 0%, #10B981 100%)", color: "#fff", fontSize: 12, fontWeight: 700, boxShadow: "0 2px 8px rgba(16,185,129,0.30), inset 0 1px 0 rgba(255,255,255,0.4)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", boxShadow: "0 0 0 3px rgba(255,255,255,0.35)" }} />
                Active
              </span>
              <CaretDown size={12} weight="bold" style={{ color: "var(--agent-text-muted)" }} />
            </span>
            <div style={{ flex: "1 1 220px", maxWidth: 340 }}>
              <p style={{ margin: "0 0 5px", textAlign: "right", fontSize: 12, color: "var(--agent-text-muted)" }}>
                <span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>41%</span> complete
              </p>
              <div style={{ height: 5, borderRadius: 999, background: "var(--agent-hero-track, rgba(45,24,16,0.10))", overflow: "hidden" }}>
                <div style={{ width: "41%", height: "100%", background: "var(--agent-coral)", borderRadius: 999 }} />
              </div>
            </div>
          </div>

          {/* Address */}
          <h1 style={{ margin: "16px 0 0", fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--agent-text-primary)", lineHeight: 1.1 }}>14 Beaumont Rise</h1>
          <p style={{ margin: "3px 0 0", fontSize: 14, color: "var(--agent-text-muted)" }}>Harpenden, Hertfordshire, AL5 2RT</p>

          {/* Stat row — bare icons (no boxes), spaced like the clock cell */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 26px", marginTop: 18 }}>
            <StatCell icon={<CurrencyGbp size={19} weight="regular" />} value="£625,000" label="Sale price" />
            <StatCell icon={<UserCircle size={19} weight="regular" />} value="Mortgage" label="Purchase type" />
            <StatCell icon={<HouseSimple size={19} weight="regular" />} value="Freehold" label="Tenure" />
            <StatCell icon={<CalendarBlank size={19} weight="regular" />} value="9 Nov 2026" label="Expected exchange" />
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 20, marginTop: 16, paddingTop: 14, borderTop: "0.5px solid var(--agent-border-default)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", flexShrink: 0, boxShadow: "inset 0 0 0 1px var(--agent-border-default)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/agent/demo-agent.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>Charlotte Hayes</div>
                <div style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Managing this file</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={19} weight="regular" style={{ color: "var(--agent-text-muted)" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>6 weeks 4 days</div>
                <div style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Added 22 Jul 2026</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 2, borderBottom: "0.5px solid var(--agent-border-default)", overflowX: "hidden" }}>
        {TABS.map((t, i) => {
          const active = i === 0;
          return (
            <span key={t.label} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 12px", fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "var(--agent-text-primary)" : "var(--agent-text-muted)", whiteSpace: "nowrap" }}>
              <t.Icon size={15} weight={active ? "fill" : "regular"} />
              {t.label}
              {t.badge && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--agent-coral-deep)", borderRadius: 999, minWidth: 15, height: 15, padding: "0 4px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{t.badge}</span>}
              {active && <span style={{ position: "absolute", left: 6, right: 6, bottom: -0.5, height: 2, background: "var(--agent-coral)", borderRadius: "1px 1px 0 0" }} />}
            </span>
          );
        })}
      </div>

      {/* ── Overview grid ───────────────────────────────────────────── */}
      <div className="demo-overview-grid">
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Next action */}
          <div style={{ ...CARD, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Fire size={18} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />
                <span className="agent-eyebrow" style={{ fontSize: 11 }}>Next action</span>
              </span>
              <CalendarBlank size={16} weight="regular" style={{ color: "var(--agent-text-muted)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>Chase: Search results received</p>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "linear-gradient(180deg, #FF8365 0%, #F0511A 100%)", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(240,81,26,0.30), inset 0 1px 0 rgba(255,255,255,0.35)" }}>Due in 5 days</span>
            </div>
            <p style={{ margin: "7px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Waiting on: Seller&apos;s solicitor has received initial enquiries.</p>
            <div style={{ marginTop: 14 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 10, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", fontSize: 13, fontWeight: 600, color: "var(--agent-text-secondary)" }}>
                <EnvelopeSimple size={15} weight="regular" /> View reminders
              </span>
            </div>
          </div>

          {/* Contacts */}
          <div style={{ ...CARD, overflow: "hidden" }}>
            {/* segmented toggle */}
            <div style={{ padding: 14, paddingBottom: 0 }}>
              <div style={{ display: "inline-flex", padding: 3, borderRadius: 10, background: "rgba(45,24,16,0.05)", border: "0.5px solid var(--agent-border-default)", gap: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-on-coral,#fff)", background: "var(--agent-coral-deep)", borderRadius: 8, padding: "6px 14px" }}>Clients</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", padding: "6px 14px" }}>Professionals</span>
              </div>
            </div>
            <div style={{ padding: "12px 14px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Contacts</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb),0.14)", borderRadius: 999, minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>1</span>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>People associated with this transaction</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, background: "linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))", color: "#fff", fontSize: 12.5, fontWeight: 600 }}><Plus size={13} weight="bold" /> Add contact</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: "0.5px solid var(--agent-border-default)", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)" }}><WhatsappLogo size={14} weight="fill" style={{ color: "#25D366" }} /> Set up WhatsApp group</span>
                </div>
              </div>

              {/* contact row */}
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--agent-border-default)" }}>
                <ContactAvatar contact={{ name: "Sarah Whitfield", roleType: "vendor" }} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Sarah Whitfield</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 12, color: "var(--agent-text-muted)" }}>
                    <Phone size={12} weight="regular" /> 07700 900123
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--agent-text-muted)" }}>
                  {[Phone, ChatCircleText, EnvelopeSimple].map((Ic, k) => (
                    <span key={k} style={{ width: 30, height: 30, borderRadius: 8, border: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic size={14} weight="regular" /></span>
                  ))}
                  <DotsThree size={18} weight="bold" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Sale health */}
          <div style={{ ...CARD, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Heartbeat size={19} weight="regular" style={{ color: "#047857" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Sale health</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#047857" }}>On track</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
              <Row label="Time on file" value="Under a minute" />
              <Row label="Stage" value="Conveyancing" />
              <Row label="Risk level" value="Low" valueColor="#047857" />
              <Row label="Last activity" value="Yesterday, 11:00" />
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "rgba(15,23,42,0.06)", marginTop: 12, overflow: "hidden" }}>
              <div style={{ width: "72%", height: "100%", background: "#10b981", borderRadius: 999 }} />
            </div>
            <div style={{ marginTop: 11, fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)", display: "inline-flex", alignItems: "center", gap: 4 }}>View health details <ArrowLeft size={11} weight="bold" style={{ transform: "rotate(180deg)" }} /></div>
          </div>

          {/* Key dates */}
          <div style={{ ...CARD, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarBlank size={19} weight="regular" style={{ color: "var(--agent-coral-deep)" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>Key dates</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
              <Row label="12-week target" value="29 November 2026" />
              <Row label="Completion" value="Awaiting exchange" />
              <Row label="Est. time to exchange" value="12 weeks" />
            </div>
            <p style={{ margin: "11px 0 0", fontSize: 10, fontStyle: "italic", color: "var(--agent-text-muted)", lineHeight: 1.4 }}>Chain not factored. This prediction is for this sale alone.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
