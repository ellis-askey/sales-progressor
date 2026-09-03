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
import type { SendingTodayRow } from "@/lib/services/automated-emails-list";

const CARD_STYLE = { padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" } as const;

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });

export function SendingTodayPanel({ rows }: { rows: SendingTodayRow[] }) {
  return (
    <GlassCard glassId="auto-emails-sending-today" label="Auto emails · Sending today" defaultVariant="v05" style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Sending today</h2>
        {rows.length > 0 && <Pill glass tone="info" size="sm">{rows.length}</Pill>}
      </div>

      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
          Nothing due to go out today.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r) => <SendingRow key={r.id} row={r} />)}
          <Link href="/agent/automated-emails?tab=pending" className="agent-link" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>
            View all queued
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
          <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
            <button type="button" onClick={sendNow} disabled={acting} className="agent-btn-color-primary" style={{ fontSize: 11.5, fontWeight: 650, padding: "4px 11px", borderRadius: 8, border: "none", cursor: "pointer" }}>
              {acting ? "…" : "Send now"}
            </button>
            <button type="button" onClick={skip} disabled={acting} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 11px", borderRadius: 8, border: "1px solid var(--agent-border-default, rgba(15,23,42,0.16))", background: "transparent", color: "var(--agent-text-secondary)", cursor: "pointer" }}>
              Skip
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ category }: { category: "chase" | "notification" }) {
  const tone = category === "chase" ? "warning" : "info";
  return <Pill glass tone={tone} size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.03em", fontSize: 9.5, flexShrink: 0 }}>{category}</Pill>;
}
