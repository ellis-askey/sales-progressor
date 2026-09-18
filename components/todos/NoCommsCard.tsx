"use client";

// To-Do "No comms" card — files we've gone quiet on, split per side. Sits in
// the To-Do right column (see app/agent/to-do/page.tsx). Each side shows the
// last time we touched base and every way to reach them; reaching out or
// snoozing clears/parks that side. Data from getNoCommsFiles (lib/services/hub).
// Reach-out is the real send path via ReachOutModal; snooze reuses SnoozeMenu.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { SnoozeMenu, type SnoozeChoice } from "@/components/reminders/SnoozeMenu";
import { ReachOutModal, type ReachChannel } from "@/components/todos/ReachOutModal";
import { snoozeNoCommsSideAction } from "@/app/actions/no-comms";
import { EnvelopeSimple, WhatsappLogo, Phone, PaperPlaneTilt, ChatSlash, ArrowRight } from "@phosphor-icons/react";
import type { NoCommsItem, NoCommsSide } from "@/lib/services/hub";

type Item = NoCommsItem & { photoUrl: string | null };

function recency(side: NoCommsSide): { cls: string; label: string } {
  if (side.daysSince === null) return { cls: "hot", label: "No contact logged" };
  const d = side.daysSince;
  const label = d === 0 ? "Today" : d === 1 ? "1 day" : `${d} days`;
  if (side.drifting) return { cls: "hot", label };
  if (d > 7) return { cls: "warm", label };
  return { cls: "calm", label };
}

const CHANNELS: { key: ReachChannel; label: string; Icon: typeof Phone; cls: string }[] = [
  { key: "email", label: "Email", Icon: EnvelopeSimple, cls: "email" },
  { key: "whatsapp", label: "WhatsApp", Icon: WhatsappLogo, cls: "wa" },
  { key: "phone", label: "Log a call", Icon: Phone, cls: "call" },
  { key: "portal", label: "Portal message", Icon: PaperPlaneTilt, cls: "portal" },
];

export function NoCommsCard({ items }: { items: Item[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [reach, setReach] = useState<{ txId: string; address: string; side: NoCommsSide; channel: ReachChannel } | null>(null);

  const key = (txId: string, side: string) => `${txId}:${side}`;

  function hideSide(txId: string, side: string) {
    setHidden((prev) => new Set(prev).add(key(txId, side)));
    router.refresh();
  }

  // A file stays only while at least one still-visible side is drifting — mirrors
  // the detector, so optimistic hides collapse the file the moment its last
  // quiet side is handled.
  const visible = useMemo(() => {
    return items
      .map((it) => ({ ...it, sides: it.sides.filter((s) => !hidden.has(key(it.transactionId, s.side))) }))
      .filter((it) => it.sides.some((s) => s.drifting));
  }, [items, hidden]);

  if (visible.length === 0) return null;

  return (
    <div className="agent-glass-strong nocomms">
      <div className="nocomms-head">
        <span className="nocomms-ico" aria-hidden>
          <ChatSlash size={18} weight="regular" />
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="nocomms-title">No comms</p>
          <p className="nocomms-sub">Nothing sent, no progress. Reach out or snooze.</p>
        </div>
        <span className="nocomms-count">{visible.length}</span>
      </div>

      {visible.map((it) => (
        <div className="nocomms-file" key={it.transactionId}>
          <Link href={`/agent/transactions/${it.transactionId}`} className="agent-link nocomms-id" style={{ textDecoration: "none" }}>
            <PropertyThumb photoUrl={it.photoUrl} size={42} />
            <span style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span className="nocomms-addr">
                {it.addressLine}
                <ArrowRight size={12} weight="bold" className="nocomms-arrow" />
              </span>
              {it.townPostcode && <span className="nocomms-town">{it.townPostcode}</span>}
            </span>
          </Link>

          <div className="nocomms-sides">
            {it.sides.map((side) => {
              const r = recency(side);
              return (
                <div className={`nocomms-side${side.drifting ? " warn" : ""}`} key={side.side}>
                  <div className="nocomms-side-top">
                    <span className={`nocomms-tag ${side.side === "vendor" ? "seller" : "buyer"}`}>
                      {side.side === "vendor" ? "Seller" : "Buyer"}
                    </span>
                    <span className="nocomms-who">{side.name}</span>
                    <span className={`nocomms-chip ${r.cls}`}><span className="nocomms-dot" />{r.label}</span>
                  </div>
                  <div className="nocomms-acts">
                    {CHANNELS.map(({ key: ch, label, Icon, cls }) => (
                      <button
                        key={ch}
                        type="button"
                        className={`nocomms-cbtn ${cls}`}
                        title={label}
                        onClick={() => setReach({ txId: it.transactionId, address: it.addressLine, side, channel: ch })}
                      >
                        <Icon size={15} weight="regular" />
                      </button>
                    ))}
                    <span style={{ flex: 1 }} />
                    <SnoozeMenu
                      variant="all"
                      label="Snooze"
                      onConfirm={async (choice: SnoozeChoice) => {
                        const res = await snoozeNoCommsSideAction({
                          transactionId: it.transactionId,
                          side: side.side,
                          hours: choice.hours,
                          untilISO: choice.untilISO,
                          reason: choice.reason,
                        });
                        if (res.ok) hideSide(it.transactionId, side.side);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {reach && (
        <ReachOutModal
          txId={reach.txId}
          address={reach.address}
          side={reach.side}
          initialChannel={reach.channel}
          onClose={() => setReach(null)}
          onSent={() => hideSide(reach.txId, reach.side.side)}
        />
      )}
    </div>
  );
}
