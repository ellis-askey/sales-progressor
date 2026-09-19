"use client";

// To-Do "No comms" card — files we've gone quiet on, split per side. Sits in
// the To-Do right column (see app/agent/to-do/page.tsx). Each file is a
// collapsible block: a photo + address top row (links to the file) with a
// chevron that opens/closes its side rows. Longest-silent files sort first, and
// the top 3 open by default. Data from getNoCommsFiles (lib/services/hub).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { SnoozeMenu, type SnoozeChoice } from "@/components/reminders/SnoozeMenu";
import { ReachOutModal, type ReachChannel } from "@/components/todos/ReachOutModal";
import { snoozeNoCommsSideAction } from "@/app/actions/no-comms";
import { EnvelopeSimple, WhatsappLogo, Phone, PaperPlaneTilt, ChatSlash, ArrowRight, CaretDown } from "@phosphor-icons/react";
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

// Initials for the fallback avatar — skips a leading title so "Mr Michael
// Vaughan" reads "MV", and handles joint names ("Robert & Anna Hale" → "RH").
const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "mx", "sir", "prof"]);
function initials(name: string): string {
  const words = name.replace(/&/g, " ").split(/\s+/).filter((w) => w && !TITLES.has(w.replace(/\./g, "").toLowerCase()));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
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
  // Longest silence first; the top 3 files open by default, the rest collapsed.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set([...items].sort((a, b) => b.worstDays - a.worstDays).slice(0, 3).map((i) => i.transactionId)),
  );

  const key = (txId: string, side: string) => `${txId}:${side}`;

  function hideSide(txId: string, side: string) {
    setHidden((prev) => new Set(prev).add(key(txId, side)));
    router.refresh();
  }
  function toggle(txId: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId); else next.add(txId);
      return next;
    });
  }

  // A file stays only while at least one still-visible side is drifting; sorted
  // by longest silence so the worst offenders are at the top.
  const visible = useMemo(() => {
    return items
      .map((it) => ({ ...it, sides: it.sides.filter((s) => !hidden.has(key(it.transactionId, s.side))) }))
      .filter((it) => it.sides.some((s) => s.drifting))
      .sort((a, b) => b.worstDays - a.worstDays);
  }, [items, hidden]);

  if (visible.length === 0) return null;

  return (
    <div className="agent-glass-strong nocomms">
      <div className="nocomms-head">
        <span className="nocomms-ico" aria-hidden>
          <ChatSlash size={24} weight="regular" />
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="nocomms-title">No comms</p>
          <p className="nocomms-sub">Nothing sent, no progress. Reach out or snooze.</p>
        </div>
        <span className="nocomms-count">{visible.length}</span>
      </div>

      {visible.map((it) => {
        const isOpen = open.has(it.transactionId);
        return (
          <div className="nocomms-file" key={it.transactionId}>
            <div className="nocomms-fhead">
              <Link href={`/agent/transactions/${it.transactionId}`} className="nocomms-id">
                <PropertyThumb photoUrl={it.photoUrl} size={42} />
                <span className="nocomms-idtext">
                  <span className="nocomms-addr">
                    {it.addressLine}
                    <ArrowRight size={12} weight="bold" className="nocomms-arrow" />
                  </span>
                  {it.townPostcode && <span className="nocomms-town">{it.townPostcode}</span>}
                </span>
              </Link>
              <button
                type="button"
                className="nocomms-chev"
                aria-expanded={isOpen}
                aria-label={isOpen ? "Collapse" : "Expand"}
                onClick={() => toggle(it.transactionId)}
              >
                <CaretDown size={15} weight="bold" style={{ transition: "transform 200ms ease", transform: isOpen ? "rotate(180deg)" : "none" }} />
              </button>
            </div>

            <div className={`agent-acc${isOpen ? " open" : ""}`}>
              <div className="agent-acc-in">
                <div className="nocomms-sides">
                  {it.sides.map((side) => {
                    const r = recency(side);
                    const seller = side.side === "vendor";
                    return (
                      <div className={`nocomms-side${side.drifting ? " warn" : ""}`} key={side.side}>
                        <div className="nocomms-side-top">
                          <span className={`nocomms-avatar ${seller ? "seller" : "buyer"}`} aria-hidden>{initials(side.name)}</span>
                          <span className="nocomms-who">{side.name}</span>
                          <span className={`nocomms-role ${seller ? "seller" : "buyer"}`}>{seller ? "Seller" : "Buyer"}</span>
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
            </div>
          </div>
        );
      })}

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
