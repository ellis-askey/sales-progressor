"use client";

// components/account/emails/AutomatedEmailsList.tsx
//
// The "Automated emails" list on the Account → Emails page. Compact rows, one
// per Tier-2 family; "Edit email" opens the family's editor in a right-side
// drawer. Post-completion is included as a real, editable template with a
// "not sending yet" note (its send trigger lands in a follow-up).

import { useState } from "react";
import { ArrowsLeftRight, CalendarBlank, Clock, TrendUp, Handshake, LinkSimple, CaretRight, EnvelopeOpen } from "@/components/icons/ph";
import { AccountDrawer } from "@/components/account/chrome/AccountDrawer";
import { InfoTip } from "@/components/ui/InfoTip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PortalInviteEditor } from "./PortalInviteEditor";
import { CompletionPackEditor } from "./CompletionPackEditor";
import { ExchangeDayClientEditor } from "./ExchangeDayClientEditor";
import { ClientChaseEditor } from "./ClientChaseEditor";
import { WeeklyUpdateEditor } from "./WeeklyUpdateEditor";
import { OnwardNudgeEditor } from "./OnwardNudgeEditor";

type Row = {
  key: string;
  Icon: typeof ArrowsLeftRight;
  title: string;
  subtitle: string;
  info: string;
  pills?: string[];
  notSending?: boolean;
  render: (base: string) => React.ReactNode;
};

const ROWS: Row[] = [
  {
    key: "portal_invite",
    Icon: EnvelopeOpen,
    title: "Portal invite",
    subtitle: "The welcome email a client gets when you invite them to their portal.",
    info: "The first email a client receives. Sent when you invite them to their portal (or when a file is added, if you've turned that on). It carries their personal link, your branding, and the wording you set here.",
    pills: ["Buyer", "Seller"],
    render: (base) => <PortalInviteEditor base={base} />,
  },
  {
    key: "completion_pack",
    Icon: ArrowsLeftRight,
    title: "Contracts exchanged",
    subtitle: "What your client needs to know after exchange.",
    info: "Sent as soon as exchange is confirmed, letting clients know their completion date is agreed and what they need to arrange next, including insurance, removals and final funds.",
    pills: ["Buyer", "Seller"],
    render: (base) => <CompletionPackEditor base={base} />,
  },
  {
    key: "exchange_day_client",
    Icon: CalendarBlank,
    title: "Exchange day",
    subtitle: "Sent on the morning contracts exchange.",
    info: "A morning reminder that exchange is expected today, asking clients to keep their phone nearby in case their solicitor needs to reach them.",
    pills: ["Morning note", "Authority nudge"],
    render: (base) => <ExchangeDayClientEditor base={base} />,
  },
  {
    key: "client_chase",
    Icon: Clock,
    title: "Chase reminder",
    subtitle: "Sent when something is waiting on the client or their solicitor.",
    info: "Sent when a step remains outstanding beyond your chosen timeframe. Clients are reminded what's needed and can respond through their portal. If they remain unresponsive, you'll be alerted to follow up personally.",
    render: (base) => <ClientChaseEditor base={base} />,
  },
  {
    key: "weekly_update",
    Icon: TrendUp,
    title: "Weekly update",
    subtitle: "Keeps clients updated when a sale has been quiet.",
    info: "A short update during quieter periods, reassuring clients that their sale is progressing and keeping them informed even when there's nothing new to report.",
    render: (base) => <WeeklyUpdateEditor base={base} />,
  },
  {
    key: "onward_nudge",
    Icon: LinkSimple,
    title: "Onward / related nudge",
    subtitle: "Asks a client to add or update their other move in the portal.",
    info: "Invites clients who are also buying or selling another property to add their related move, helping you see more of the chain and identify anything that could affect their sale.",
    pills: ["Onward", "Related"],
    render: (base) => <OnwardNudgeEditor base={base} />,
  },
  {
    key: "post_completion",
    Icon: Handshake,
    title: "Post-completion",
    subtitle: "A thank you and what happens after completion.",
    info: "A final email once the sale completes, covering useful next steps such as Land Registry updates, keeping important documents and leaving a review. Coming soon.",
    pills: ["Buyer", "Seller"],
    notSending: true,
    render: (base) => (
      <CompletionPackEditor
        base={base}
        templateKey="post_completion"
        title="Post-completion"
        subtitle="A thank you and what happens after completion, per side."
      />
    ),
  },
];

export function AutomatedEmailsList({ base = "/api/agent/email-templates" }: { base?: string } = {}) {
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
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{r.title}</p>
                  <InfoTip label={r.title}>{r.info}</InfoTip>
                </span>
                {r.notSending && <Badge tone="neutral">Not sending yet</Badge>}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>{r.subtitle}</p>
            </div>
            {r.pills && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }} className="account-emails-rowpills">
                {r.pills.map((p) => (
                  <Badge key={p} tone="neutral">{p}</Badge>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setOpenKey(r.key)}>
              Edit email <CaretRight size={12} weight="bold" />
            </Button>
          </div>
        ))}
      </div>

      <AccountDrawer open={active !== null} onClose={() => setOpenKey(null)} title="Edit email" subtitle={active?.title}>
        {active?.notSending && (
          <div style={{ marginBottom: 16 }}>
            <InlineAlert kind="info">
              This email isn&apos;t sending yet. You can set the wording now, ready for when the send trigger goes live.
            </InlineAlert>
          </div>
        )}
        {active?.render(base)}
      </AccountDrawer>

      <style>{`
        @media (max-width: 640px) { .account-emails-rowpills { display: none !important; } }
      `}</style>
    </>
  );
}
