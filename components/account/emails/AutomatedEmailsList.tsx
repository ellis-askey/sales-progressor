"use client";

// components/account/emails/AutomatedEmailsList.tsx
//
// The "Automated emails" list on the Account → Emails page. Compact rows, one
// per Tier-2 family; "Edit email" opens the family's editor in a right-side
// drawer. Post-completion is included as a real, editable template with a
// "not sending yet" note (its send trigger lands in a follow-up).

import { useState } from "react";
import { ArrowsLeftRight, CalendarBlank, Clock, TrendUp, Handshake, CaretRight } from "@phosphor-icons/react";
import { AccountDrawer } from "@/components/account/chrome/AccountDrawer";
import { CompletionPackEditor } from "./CompletionPackEditor";
import { ExchangeDayClientEditor } from "./ExchangeDayClientEditor";
import { ClientChaseEditor } from "./ClientChaseEditor";
import { WeeklyUpdateEditor } from "./WeeklyUpdateEditor";

type Row = {
  key: string;
  Icon: typeof ArrowsLeftRight;
  title: string;
  subtitle: string;
  pills?: string[];
  notSending?: boolean;
  render: () => React.ReactNode;
};

const ROWS: Row[] = [
  {
    key: "completion_pack",
    Icon: ArrowsLeftRight,
    title: "Contracts exchanged",
    subtitle: "What happens next for your client after exchange.",
    pills: ["Buyer", "Seller"],
    render: () => <CompletionPackEditor />,
  },
  {
    key: "exchange_day_client",
    Icon: CalendarBlank,
    title: "Exchange day",
    subtitle: "Sent on the morning contracts exchange.",
    pills: ["Morning note", "Authority nudge"],
    render: () => <ExchangeDayClientEditor />,
  },
  {
    key: "client_chase",
    Icon: Clock,
    title: "Chase reminder",
    subtitle: "Sent when something is waiting on the client or their solicitor.",
    render: () => <ClientChaseEditor />,
  },
  {
    key: "weekly_update",
    Icon: TrendUp,
    title: "Weekly update",
    subtitle: "Keeps clients informed when a sale has been quiet.",
    render: () => <WeeklyUpdateEditor />,
  },
  {
    key: "post_completion",
    Icon: Handshake,
    title: "Post-completion",
    subtitle: "A thank you and what to do after completion.",
    pills: ["Buyer", "Seller"],
    notSending: true,
    render: () => (
      <CompletionPackEditor
        templateKey="post_completion"
        title="Post-completion"
        subtitle="A thank you and what to do after completion, per side."
      />
    ),
  },
];

export function AutomatedEmailsList() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const active = ROWS.find((r) => r.key === openKey) ?? null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {ROWS.map((r, i) => (
          <div
            key={r.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 2px",
              borderTop: i === 0 ? "none" : "0.5px solid rgba(0,0,0,0.06)",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                flexShrink: 0,
                color: "var(--agent-coral-deep, #E2452A)",
              }}
            >
              <r.Icon size={22} weight="bold" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{r.title}</p>
                {r.notSending && (
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 7px", borderRadius: 5, background: "#f3f4f6", color: "#6b7280" }}>
                    Not sending yet
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{r.subtitle}</p>
            </div>
            {r.pills && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }} className="account-emails-rowpills">
                {r.pills.map((p) => (
                  <span key={p} style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 7, background: "#f7f7f8", color: "#6b7280", border: "0.5px solid rgba(0,0,0,0.06)" }}>
                    {p}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpenKey(r.key)}
              className="account-editemail-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                flexShrink: 0,
                padding: "7px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--agent-coral-deep, #E2452A)",
                background: "#fff",
                border: "0.5px solid rgba(255,107,74,0.45)",
                borderRadius: 9,
                cursor: "pointer",
                transition: "background 130ms",
              }}
            >
              Edit email <CaretRight size={12} weight="bold" />
            </button>
          </div>
        ))}
      </div>

      <AccountDrawer open={active !== null} onClose={() => setOpenKey(null)} title="Edit email" subtitle={active?.title}>
        {active?.notSending && (
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "12px 14px",
              marginBottom: 16,
              background: "rgba(255,107,74,0.06)",
              border: "0.5px solid rgba(0,0,0,0.06)",
              borderRadius: 11,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "#6b7280",
            }}
          >
            This email isn&apos;t sending yet. You can set the copy now; the send trigger lands in a follow-up.
          </div>
        )}
        {active?.render()}
      </AccountDrawer>

      <style>{`
        .account-editemail-btn:hover { background: rgba(255,107,74,0.06); }
        @media (max-width: 640px) { .account-emails-rowpills { display: none !important; } }
      `}</style>
    </>
  );
}
