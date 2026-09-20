"use client";

import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { DateMenu, FeeMenu } from "@/components/completions/CompletionCardMenus";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }

function fmtDate(d: string | null) {
  if (!d) return "No date set";
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function timeSinceExchange(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Exchanged today";
  if (days === 1) return "Exchanged yesterday";
  return `Exchanged ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${days} days ago`;
}

function computeDays(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: "", color: "var(--agent-text-muted)" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const rel = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  let label = "";
  let color = "var(--agent-text-muted)";
  if (rel < 0)        { label = `${Math.abs(rel)} days overdue`; color = "var(--agent-danger)"; }
  else if (rel === 0) { label = "today";    color = "var(--agent-warning)"; }
  else if (rel === 1) { label = "tomorrow"; color = "var(--agent-warning)"; }
  else if (rel <= 7)  { label = `in ${rel} days`; color = "var(--agent-warning)"; }
  else                { label = `in ${rel} days`; }
  return { label, color };
}

export const GROUP_STYLES = {
  overdue:   { dotColor: "var(--agent-danger)",  label: "text-red-600",      border: "border-red-200/40"   },
  this_week: { dotColor: "var(--agent-warning)", label: "text-amber-600",    border: "border-amber-200/40" },
  next_week: { dotColor: "var(--agent-info)",    label: "text-blue-600",     border: "border-blue-200/40"  },
  later:     { dotColor: "#94a3b8",              label: "text-slate-900/60", border: "border-white/20"      },
  no_date:   { dotColor: "#cbd5e1",              label: "text-slate-900/40", border: "border-white/15"      },
} as const;

export type CompletionFileRow = {
  id: string;
  propertyAddress: string;
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean | null;
  purchasers: string[];
  assignedUserName: string | null;
  exchangedAtIso: string | null;
  completionDateIso: string | null;
  vendorSolicitorName: string | null;
  purchaserSolicitorName: string | null;
  agencyName?: string | null;
  photoUrl?: string | null;
  // ── Completions hub (2026-09-18) ─────────────────────────────────────────
  // True for admin / SP (internal). Gates the buyer's funds figures — agencies
  // see only the non-financial context.
  internal?: boolean;
  // Hide the inline fee editor. Progressors are blocked from editing commercial
  // fees server-side, so the control could only ever fail for them.
  hideFeeEdit?: boolean;
  // Journey: instructed (file created) -> exchanged -> completing.
  instructedAtIso?: string | null;
  // How many managed files sit in this file's chain (>1 => "part of a chain of N").
  chainSize?: number | null;
  // Buyer-entered portal context (non-financial — shown to everyone).
  firstTimeBuyer?: boolean | null;
  sellingRelated?: boolean | null;
  mortgageOfferExpiryIso?: string | null;
  // Buyer-entered funds (pence) — only forwarded to internal staff.
  fundsInPlace?: string | null; // "yes" | "not_yet" | "not_sure"
  depositPence?: number | null;
  mortgagePence?: number | null;
  otherFundsPence?: number | null;
  completionFundsSent?: boolean | null;
};

// Action buttons live inside the row's <Link>, so every click must stop the
// link from firing. This wrapper does that once.
function ActionButton({ onClick, primary, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      className={primary ? "agent-btn-color-primary" : "agent-link"}
      style={primary
        ? { fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer" }
        : { fontSize: 12, fontWeight: 600 }}
    >
      {children}
    </button>
  );
}

// ── Completions hub extras ────────────────────────────────────────────────
// Journey (instructed → exchanged → completing), a readiness read, and the
// buyer's portal-entered context. Funds are internal-only; the non-financial
// signals (first-time buyer, related sale, mortgage-offer expiry) show to all.

function fmtShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function daysBetweenIso(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}
function fmtMoney(pence?: number | null): string | null {
  if (pence == null) return null;
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

function JNode({ label, date, strong }: { label: string; date: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agent-text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: strong ? 600 : 500, color: "var(--agent-text-primary)" }}>{date}</span>
    </div>
  );
}
function JSeg({ gap, fill }: { gap: string | null; fill?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 24, position: "relative", height: 26, display: "flex", alignItems: "center", margin: "0 10px" }}>
      {gap && <span style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>{gap}</span>}
      <div style={{ height: 2, width: "100%", borderRadius: 2, marginTop: 9, background: fill ? "var(--agent-success)" : "var(--agent-border-subtle)" }} />
    </div>
  );
}

function Pip({ tone, children }: { tone: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const map = {
    ok:   { bg: "var(--agent-success-bg)", fg: "var(--agent-success)" },
    warn: { bg: "rgba(var(--agent-warning-rgb),0.14)", fg: "var(--agent-warning)" },
    bad:  { bg: "rgba(var(--agent-danger-rgb),0.12)", fg: "var(--agent-danger)" },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: map.bg, color: map.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: map.fg, flexShrink: 0 }} />
      {children}
    </span>
  );
}

function FundItem({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const c = tone === "ok" ? "var(--agent-success)" : tone === "warn" ? "var(--agent-warning)" : "var(--agent-text-primary)";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column" }}>
      <span style={{ fontSize: 9.5, color: "var(--agent-text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: c }}>{value}</span>
    </span>
  );
}

function RowExtras({ file }: { file: CompletionFileRow }) {
  const g1 = daysBetweenIso(file.instructedAtIso, file.exchangedAtIso);
  const g2 = daysBetweenIso(file.exchangedAtIso, file.completionDateIso);
  const chainSize = file.chainSize ?? 1;

  // Readiness: mortgage-offer validity + solicitors (+ funds, internal only).
  const completionMs = file.completionDateIso ? new Date(file.completionDateIso).setHours(0, 0, 0, 0) : null;
  const offerMs = file.mortgageOfferExpiryIso ? new Date(file.mortgageOfferExpiryIso).setHours(0, 0, 0, 0) : null;
  const offerValid = offerMs == null ? null : completionMs == null ? true : offerMs >= completionMs;
  const fundsOk = file.internal ? file.completionFundsSent === true || file.fundsInPlace === "yes" : null;

  // Only the real, per-item readiness pips (funds / mortgage offer). Solicitors
  // are covered by the "No solicitors on file" line, and there's no "Ready to
  // complete" / "Needs N" summary — the pips say what's outstanding.
  const pips: { tone: "ok" | "warn" | "bad"; label: string }[] = [];
  if (file.internal) pips.push(fundsOk ? { tone: "ok", label: "Funds confirmed" } : { tone: "bad", label: "Funds not confirmed" });
  if (offerValid !== null) pips.push(offerValid ? { tone: "ok", label: "Mortgage offer valid" } : { tone: "bad", label: "Offer expires before completion" });

  // Non-financial context (shown to everyone).
  const tags: string[] = [];
  if (file.firstTimeBuyer === true) tags.push("First-time buyer");
  if (file.sellingRelated === true) tags.push("Selling a related property");
  else if (file.sellingRelated === false) tags.push("No related sale");
  if (file.mortgageOfferExpiryIso) tags.push(`Mortgage offer to ${fmtShort(file.mortgageOfferExpiryIso)}`);

  // Funds figures (internal only).
  const deposit = file.internal ? fmtMoney(file.depositPence) : null;
  const mortgage = file.internal ? fmtMoney(file.mortgagePence) : null;
  const other = file.internal ? fmtMoney(file.otherFundsPence) : null;
  const hasFundsData = !!file.internal && (!!deposit || !!mortgage || !!other || file.completionFundsSent != null);

  return (
    <div style={{ marginTop: 10 }}>
      {/* Chain line */}
      {chainSize > 1 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--agent-text-secondary)", background: "rgba(91,107,120,0.10)", padding: "3px 9px", borderRadius: 999 }}>
            Part of a chain of {chainSize}
          </span>
        </div>
      )}

      {/* Journey — instructed -> exchanged -> completing */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <JNode label="Instructed" date={fmtShort(file.instructedAtIso)} />
        <JSeg gap={g1 != null ? `${g1} days` : null} fill />
        <JNode label="Exchanged" date={fmtShort(file.exchangedAtIso)} strong />
        <JSeg gap={g2 != null ? `${g2} days` : null} />
        <JNode label="Completing" date={fmtShort(file.completionDateIso)} />
      </div>

      {/* Readiness pips (funds / mortgage offer) — shown only when there are any. */}
      {pips.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {pips.map((p, i) => <Pip key={i} tone={p.tone}>{p.label}</Pip>)}
        </div>
      )}

      {/* What the buyer's told us */}
      {(hasFundsData || tags.length > 0) && (
        <div style={{ marginTop: 10, border: "1px dashed var(--agent-border-subtle)", borderRadius: 10, background: "var(--agent-surface-glass)", padding: "9px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)", marginBottom: 6 }}>What the buyer&apos;s told us</div>
          {hasFundsData && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginBottom: tags.length > 0 ? 8 : 0 }}>
              {deposit && <FundItem label="Deposit" value={deposit} />}
              {mortgage && <FundItem label="Mortgage" value={mortgage} />}
              {other && <FundItem label="Other funds sent" value={other} />}
              {file.completionFundsSent != null && <FundItem label="Funds" value={file.completionFundsSent ? "Confirmed sent" : "Not yet confirmed"} tone={file.completionFundsSent ? "ok" : "warn"} />}
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tags.map((t, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, background: "rgba(15,23,42,0.05)", color: "var(--agent-text-secondary)", padding: "3px 8px", borderRadius: 999 }}>{t}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CompletionFileRowView({
  file,
  groupKey,
  href = "#",
  isOpen = true,
  onToggle,
  onComplete,
}: {
  file: CompletionFileRow;
  groupKey: keyof typeof GROUP_STYLES;
  href?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  onComplete?: () => void;
}) {
  const s = GROUP_STYLES[groupKey];
  // Split the address into line-1 (bold) + town/postcode (muted), the same
  // treatment the enquiries rows use.
  const [addrLine1, ...addrRest] = file.propertyAddress.split(",");
  const addrTown = addrRest.join(",").trim();
  const hasNeitherSol = !file.vendorSolicitorName && !file.purchaserSolicitorName;
  const exchangeLine = timeSinceExchange(file.exchangedAtIso);
  const { label: daysLabel, color: daysColor } = computeDays(file.completionDateIso);

  // Right-hand date + countdown block.
  const DateBlock = () => (
    <div className="text-right" style={{ flexShrink: 0 }}>
      <p className={`text-sm font-semibold mb-0.5 ${file.completionDateIso ? s.label : "text-slate-900/40"}`}>
        {fmtDate(file.completionDateIso)}
      </p>
      {daysLabel && <p className="text-xs font-semibold" style={{ color: daysColor }}>{daysLabel}</p>}
    </div>
  );

  const solLine = hasNeitherSol
    ? <span style={{ color: "var(--agent-warning)" }}>No solicitors on file</span>
    : <>{file.vendorSolicitorName ?? "not set"}{"  ↔  "}{file.purchaserSolicitorName ?? "not set"}</>;

  return (
    <div>
      {/* The whole top bar is the collapse/expand toggle — one clickable
          container, nothing nested that steals the click. The file link lives on
          "Open file" in the body below. Date + countdown stay visible collapsed. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onToggle?.(); } }}
        style={{ display: "flex", gap: 14, alignItems: "flex-start", cursor: onToggle ? "pointer" : "default" }}
      >
        <PropertyThumb photoUrl={file.photoUrl} size={48} />
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <p className="text-[14px] font-semibold mb-0.5" style={{ color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{addrLine1.trim()}</p>
          {addrTown && <p style={{ fontSize: 11.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "-1px 0 0" }}>{addrTown}</p>}
        </div>
        <DateBlock />
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", flexShrink: 0, alignSelf: "center", transition: "transform 220ms cubic-bezier(0.25,0,0,1)", transform: isOpen ? "rotate(180deg)" : "none" }}>
          <CaretDown size={15} weight="bold" />
        </span>
      </div>

      {/* Collapsible detail — money, context, journey, readiness, actions. */}
      <div className={`agent-acc${isOpen ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div style={{ paddingLeft: 62, paddingTop: 8 }}>
            {/* Money — sale muted, fee emphasised */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
              {file.purchasePrice != null && <span className="text-sm" style={{ color: "var(--agent-text-secondary)", fontWeight: 600 }}>{fmt(file.purchasePrice / 100)}</span>}
              {file.agentFeeAmount != null && (
                <span className="text-sm" style={{ color: "var(--agent-coral, #c2410c)", fontWeight: 600 }}>Fee {fmt(file.agentFeeAmount / 100)}</span>
              )}
            </div>

            {/* buyers · exchange · solicitors · agency */}
            <p className="text-xs" style={{ color: "var(--agent-text-muted)" }}>
              {file.purchasers.length > 0 && <>{file.purchasers.join(", ")}</>}
              {file.purchasers.length > 0 && exchangeLine && " · "}
              {exchangeLine}
              {file.assignedUserName && <> · {file.assignedUserName}</>}
              {file.agencyName && <> · {file.agencyName}</>}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--agent-text-muted)", marginTop: 1 }}>{solLine}</p>

            {/* Journey + readiness + what the buyer's told us */}
            <RowExtras file={file} />

            {/* Actions — plus the last-chance "Add fee" (bottom right) when the
                agency fee hasn't been captured yet. */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
              {onComplete && <ActionButton onClick={onComplete} primary>Mark completed</ActionButton>}
              <DateMenu txId={file.id} currentIso={file.completionDateIso} hasDate={!!file.completionDateIso} />
              <span style={{ flex: 1 }} />
              {!file.hideFeeEdit && <FeeMenu txId={file.id} agentFeeAmount={file.agentFeeAmount} agentFeePercent={file.agentFeePercent} agentFeeIsVatInclusive={file.agentFeeIsVatInclusive} purchasePrice={file.purchasePrice} />}
              <Link href={href} className="agent-link comp-open" style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", textDecoration: "none" }}>Open file</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
