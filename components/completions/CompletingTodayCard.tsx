"use client";

// Completing-today command card. A focus view for the files whose completion date
// is today: the readiness at a glance + a one-tap "Mark completed". Phase 1 shows
// the derivable checks (solicitors on file, and funds with solicitor for internal
// staff); keys-released / statement-sent checkboxes land with their fields in
// Phase 2. Only the real, wired action (Mark completed) is a button — no dead
// controls.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle, Circle } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Button } from "@/components/ui/Button";
import { completeFileAction, setKeysReleasedAction } from "@/app/actions/completions";
import { useAgentToast } from "@/components/agent/AgentToaster";

export type TodayFile = {
  id: string;
  propertyAddress: string;
  purchasers: string[];
  purchasePrice: number | null;
  chainSize: number;
  solsOk: boolean;
  fundsOk: boolean | null; // null => not shown (agency viewer)
  keysReleased: boolean;
};

function fmt(pence: number | null): string | null {
  if (pence == null) return null;
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: ok ? "var(--agent-text-primary)" : "var(--agent-text-secondary)" }}>
      {ok
        ? <CheckCircle size={15} weight="fill" style={{ color: "var(--agent-success)", flexShrink: 0 }} />
        : <Circle size={15} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />}
      {children}
    </div>
  );
}

export function CompletingTodayCard({ files }: { files: TodayFile[] }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [keysBusyId, setKeysBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  if (files.length === 0) return null;

  function toggleKeys(id: string, next: boolean) {
    if (keysBusyId) return;
    setKeysBusyId(id);
    startTransition(async () => {
      try { await setKeysReleasedAction(id, next); router.refresh(); }
      catch { toast.error("Couldn't update that. Try again."); }
      finally { setKeysBusyId(null); }
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const totalValue = files.reduce((s, f) => s + (f.purchasePrice ?? 0), 0);

  function markCompleted(id: string, address: string) {
    if (busyId) return;
    setBusyId(id);
    startTransition(async () => {
      const res = await completeFileAction(id, today);
      if (res.ok) { toast.success(`${address} completed`); router.refresh(); }
      else { toast.error(res.error); setBusyId(null); }
    });
  }

  return (
    <GlassCard
      glassId="completions-today"
      label="Completions · Completing today"
      defaultVariant="v05"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden", boxShadow: "0 0 0 1px var(--agent-coral) inset" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: "var(--agent-coral-bg-tint)", borderBottom: "1px solid var(--agent-border-subtle)" }}>
        <CalendarCheck size={17} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />
        <span className="text-xs font-bold uppercase tracking-[0.07em]" style={{ color: "var(--agent-coral-deep)" }}>Completing today</span>
        <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", fontWeight: 600, marginLeft: "auto" }}>
          {files.length} {files.length === 1 ? "file" : "files"}{totalValue > 0 ? ` · ${fmt(totalValue)}` : ""}
        </span>
      </div>

      <div style={{ padding: "4px 16px 12px" }}>
        {files.map((f, i) => (
          <div key={f.id} style={{ display: "flex", gap: 14, padding: "13px 2px", borderTop: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <Link href={`/agent/transactions/${f.id}`} className="hover:underline" style={{ fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)", textDecoration: "none" }}>
                {f.propertyAddress}
              </Link>
              <div style={{ fontSize: 12, color: "var(--agent-text-muted)", marginTop: 1 }}>
                {[f.purchasers.join(", "), fmt(f.purchasePrice), f.chainSize > 1 ? `part of a chain of ${f.chainSize}` : null].filter(Boolean).join(" · ")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 18px", marginTop: 9 }}>
                <Check ok={f.solsOk}>{f.solsOk ? "Solicitors on file" : "Solicitors missing"}</Check>
                {f.fundsOk !== null && <Check ok={f.fundsOk}>{f.fundsOk ? "Funds with solicitor" : "Funds not confirmed"}</Check>}
                <button
                  type="button"
                  disabled={keysBusyId === f.id}
                  onClick={() => toggleKeys(f.id, !f.keysReleased)}
                  style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, background: "none", border: "none", padding: 0, cursor: "pointer", color: f.keysReleased ? "var(--agent-text-primary)" : "var(--agent-text-secondary)" }}
                  title={f.keysReleased ? "Mark keys not yet released" : "Mark keys released to buyer"}
                >
                  {f.keysReleased
                    ? <CheckCircle size={15} weight="fill" style={{ color: "var(--agent-success)", flexShrink: 0 }} />
                    : <Circle size={15} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />}
                  Keys released to buyer
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <Button size="sm" disabled={busyId === f.id} onClick={() => markCompleted(f.id, f.propertyAddress)}>
                {busyId === f.id ? "Completing…" : "Mark completed"}
              </Button>
              <Link href={`/agent/transactions/${f.id}`} className="agent-link" style={{ fontSize: 12, fontWeight: 600 }}>Open file</Link>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
