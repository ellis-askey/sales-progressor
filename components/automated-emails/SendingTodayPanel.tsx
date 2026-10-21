"use client";

// "Sending today" panel — the short list of queued sends due to go out by end
// of today, with the two controls an agent reaches for most: send it now, or
// skip it. Both call the same race-safe server actions the detail drawer uses
// (atomic claim / compare-and-swap), so there's no double-send and no divergence
// from the drain. A focused intercept surface; the Pending tab is the full list.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { sendPendingEmailNow, cancelPendingEmail } from "@/app/actions/automated-emails";
import { CategoryChip } from "@/components/automated-emails/EmailFeedRow";
import type { SendingTodayRow } from "@/lib/services/automated-emails-list";

const CARD_STYLE = { padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" } as const;

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });

export function SendingTodayPanel({ rows, sentToday = 0, stillToGo }: { rows: SendingTodayRow[]; sentToday?: number; stillToGo?: number }) {
  // The true remaining-today figure comes from the banner service; the rows
  // here are a capped preview of it.
  const total = stillToGo ?? rows.length;
  return (
    <GlassCard glassId="auto-emails-sending-today" label="Auto emails · Still to send today" defaultVariant="v05" style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        {/* "Still to send" is the honest name — this list is the remaining
            queue, not today's activity (truth pass 2026-10-21). */}
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Still to send today</h2>
        {total > 0 && <Pill glass tone="info" size="sm">{total}</Pill>}
      </div>

      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
          {sentToday > 0 ? (
            <>
              Nothing left to send today. {sentToday === 1 ? "1 email" : `${sentToday} emails`} already went out, in{" "}
              <Link href="/agent/automated-emails?tab=sent" className="agent-link" style={{ fontWeight: 600 }}>Activity</Link>.
            </>
          ) : (
            "Nothing due to go out today."
          )}
        </p>
      ) : (
        /* Four rows at most — this is a quick-intercept panel next to two other
           cards, and a full day's queue stretched the whole top row into one
           towering column (screenshot verification 2026-10-21). The complete
           schedule lives in the Outbox directly below. */
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.slice(0, 4).map((r) => <SendingRow key={r.id} row={r} />)}
          <Link href="/agent/automated-emails?tab=outbox" className="agent-link" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>
            {total > 4 ? `All ${total} in the Outbox below` : "View the full Outbox"}
          </Link>
        </div>
      )}
    </GlassCard>
  );
}

function SendingRow({ row }: { row: SendingTodayRow }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [acting, startActing] = useTransition();
  const [done, setDone] = useState<"sent" | "skipped" | null>(null);
  const role = asRole(row.recipientRole);

  function sendNow() {
    startActing(async () => {
      const res = await sendPendingEmailNow(row.id);
      if (res.ok) { setDone("sent"); toast.success(res.message); router.refresh(); }
      else { toast.error(res.error); router.refresh(); }
    });
  }
  function skip() {
    startActing(async () => {
      const res = await cancelPendingEmail(row.id);
      if (res.ok) { setDone("skipped"); toast.success("Skipped. It won't send."); router.refresh(); }
      else { toast.error(res.error); router.refresh(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 4px", borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{timeFmt.format(row.scheduledFor)}</span>
        <CategoryChip category={row.category} />
        <Link href={`/agent/transactions/${row.transactionId}`} className="agent-link" style={{ fontSize: 12.5, fontWeight: 650, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {row.address}
        </Link>
      </div>
      <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.subject}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          {role && <RoleIcon role={role} size={11} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.recipientName}{role ? ` · ${roleLabel(role)}` : ""}</span>
        </span>
        {done ? (
          <Pill glass tone={done === "sent" ? "success" : "muted"} size="sm">{done === "sent" ? "Sent" : "Skipped"}</Pill>
        ) : (
          /* Library buttons only — the Skip button was fully hand-rolled and
             Send now carried ad-hoc inline sizing (upgrade phase 4). */
          <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
            <button type="button" onClick={sendNow} disabled={acting} className="agent-btn agent-btn-xs agent-btn-color-primary">
              {acting ? "…" : "Send now"}
            </button>
            <button type="button" onClick={skip} disabled={acting} className="agent-btn agent-btn-xs agent-btn-ghost-bordered">
              Skip
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

