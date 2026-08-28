import { Check, House, MagnifyingGlass, ClipboardText, ChatText, ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import { PortalCard, CardKicker } from "./portal-cards";
import { S } from "./ui";

// The counterparty's progress — STATES ONLY, NO DATES (decision A2). We show the
// fact that a step is done or awaited, never the buyer's private milestone dates.
export type OtherSideRow = { key: string; label: string; icon: React.ReactNode; done: boolean; doneWord: string; pendingWord: string };

// Curated highlights per side. Buyer view = the seller's solicitor looking at
// the purchaser (the mock). Seller view = the buyer's solicitor looking at the
// vendor. Codes from lib/portal-copy.ts.
export function otherSideConfig(otherSide: "vendor" | "purchaser"): { title: string; items: { code: string; label: string; icon: React.ReactNode; doneWord: string; pendingWord: string }[] } {
  if (otherSide === "purchaser") {
    return {
      title: "Other side (buyer)",
      items: [
        { code: "PM11", label: "Mortgage offer", icon: <House size={16} weight="regular" />, doneWord: "Received", pendingWord: "Awaiting" },
        { code: "PM13", label: "Searches", icon: <MagnifyingGlass size={16} weight="regular" />, doneWord: "Received", pendingWord: "Awaiting" },
        { code: "PM10", label: "Survey", icon: <ClipboardText size={16} weight="regular" />, doneWord: "Completed", pendingWord: "Awaiting" },
        { code: "PM20", label: "Replies to enquiries", icon: <ChatText size={16} weight="regular" />, doneWord: "Satisfied", pendingWord: "Awaiting" },
        { code: "PM25", label: "Ready to exchange", icon: <ArrowsLeftRight size={16} weight="regular" />, doneWord: "Ready", pendingWord: "Not yet" },
      ],
    };
  }
  return {
    title: "Other side (seller)",
    items: [
      { code: "VM7", label: "Draft contract pack", icon: <ClipboardText size={16} weight="regular" />, doneWord: "Issued", pendingWord: "Awaiting" },
      { code: "PM20", label: "Enquiries satisfied", icon: <ChatText size={16} weight="regular" />, doneWord: "Satisfied", pendingWord: "Awaiting" },
      { code: "VM18", label: "Ready to exchange", icon: <ArrowsLeftRight size={16} weight="regular" />, doneWord: "Ready", pendingWord: "Not yet" },
    ],
  };
}

export function OtherSideCard({ title, rows }: { title: string; rows: OtherSideRow[] }) {
  return (
    <PortalCard>
      <CardKicker>{title}</CardKicker>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((r, i) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : `1px solid ${S.line}` }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: r.done ? S.successBg : "rgba(15,39,64,0.05)", color: r.done ? S.successRing : S.muted }}>
              {r.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: S.ink }}>{r.label}</span>
            {r.done ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: S.successRing, flexShrink: 0 }}>
                <Check size={14} weight="bold" /> {r.doneWord}
              </span>
            ) : (
              <span style={{ fontSize: 13, color: S.faint, flexShrink: 0 }}>{r.pendingWord}</span>
            )}
          </div>
        ))}
      </div>
    </PortalCard>
  );
}
