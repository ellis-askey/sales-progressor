"use client";

// The "By sale" cockpit (internal staff only, for now) — the file-centric view
// that replaces the time-ordered email log. One row per sale: what's stuck
// (Needs you), what's chasing on its own (Chasing now), what's quiet (All set /
// Paused). Real primitives only — GlassCard file rows, PropertyThumb photos,
// StatusPill (no bespoke faded blocks), bare Phosphor icons, agent buttons.
// Each group is a data-bloom block so it loads in with the page; rows carry the
// standard agent-hover-row lift. See docs/active/auto-emails-cockpit/PLAN.md.

import { useState } from "react";
import Link from "next/link";
import { Warning, EnvelopeSimple, PhoneCall, CheckCircle, PauseCircle, CaretRight } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ContactAvatar } from "@/components/ui/Avatar";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { StatusPill } from "@/components/reminders/StatusPill";
import { Pill } from "@/components/ui/Pill";
import type { Cockpit, CockpitNeedKind } from "@/lib/services/automated-emails-cockpit";

function splitAddress(a: string): { line: string; location: string } {
  const i = a.indexOf(",");
  return i < 0 ? { line: a, location: "" } : { line: a.slice(0, i).trim(), location: a.slice(i + 1).trim() };
}

function fileHref(txId: string) { return `/agent/transactions/${txId}`; }

function GroupHeader({ title, count, tone, hint }: { title: string; count: number; tone: "danger" | "success" | "muted"; hint?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px 10px" }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</h2>
      <Pill tone={count === 0 ? "muted" : tone} size="sm" glass>{count}</Pill>
      {hint != null && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--agent-text-muted)" }}>{hint}</span>}
    </div>
  );
}

// The shared photo + address identity, linking to the file.
function PhotoIdentity({ txId, address, photoUrl }: { txId: string; address: string; photoUrl: string | null }) {
  const { line, location } = splitAddress(address);
  return (
    <Link href={fileHref(txId)} className="agent-link" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: "1 1 auto", textDecoration: "none" }}>
      <PropertyThumb photoUrl={photoUrl} size={40} />
      <div style={{ minWidth: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
          <span className="rem-addr" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{line}</span>
          <LinkArrow />
        </span>
        {location && <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</p>}
      </div>
    </Link>
  );
}

// The person the problem is about: their photo, or the side-tinted contact art
// (seller blue / buyer green / solicitor navy) — the same avatar as the file's
// contact card, so the circle matches the name in the headline. Still links to
// the file; the address sits alongside so the row stays identifiable.
function PersonIdentity({ txId, address, avatarName, avatarRole, avatarImage }: { txId: string; address: string; avatarName: string; avatarRole: string; avatarImage: string | null }) {
  const { line, location } = splitAddress(address);
  return (
    <Link href={fileHref(txId)} className="agent-link" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: "1 1 auto", textDecoration: "none" }}>
      <ContactAvatar contact={{ name: avatarName || "?", roleType: avatarRole || undefined }} image={avatarImage} size={40} />
      <div style={{ minWidth: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
          <span className="rem-addr" style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{line}</span>
          <LinkArrow />
        </span>
        {location && <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</p>}
      </div>
    </Link>
  );
}

const needIcon: Record<CockpitNeedKind, React.ReactNode> = {
  bounced: <Warning size={11} weight="fill" />,
  missing: <EnvelopeSimple size={11} weight="bold" />,
  errored: <Warning size={11} weight="bold" />,
  chased_out: <PhoneCall size={11} weight="bold" />,
};
const needTone: Record<CockpitNeedKind, "danger" | "warning" | "muted"> = {
  bounced: "danger", missing: "warning", errored: "danger", chased_out: "muted",
};

const CARD_STYLE = { borderRadius: 14 } as const;
const ROW_INNER = { padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const };

function Dots({ n, max }: { n: number; max: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, verticalAlign: "middle" }} aria-hidden>
      {Array.from({ length: Math.max(max, n) }).map((_, i) => (
        <i key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i < n ? "var(--agent-coral)" : "var(--agent-border-default)" }} />
      ))}
    </span>
  );
}

export function BySaleView({ cockpit }: { cockpit: Cockpit }) {
  const [showQuiet, setShowQuiet] = useState(false);
  const [showPaused, setShowPaused] = useState(false);
  const { needsYou, chasing, chasingRunLabel, allSet, paused } = cockpit;

  return (
    <div className="space-y-5">
      {/* NEEDS YOU */}
      <div data-bloom>
        <GroupHeader title="Needs you" count={needsYou.length} tone="danger"
          hint={needsYou.length ? "automation can't proceed until you act" : "all clear, nothing stuck"} />
        {needsYou.length === 0 ? (
          <GlassCard glassId="auto-cockpit-row" label="Cockpit · row" style={CARD_STYLE}>
            <p style={{ ...ROW_INNER, margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>Nothing needs you. Every file&rsquo;s automation is running or quiet.</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {needsYou.map((r) => (
              <GlassCard key={r.txId} glassId="auto-cockpit-row" label="Cockpit · row" className="agent-hover-row" style={CARD_STYLE}>
                <div style={ROW_INNER}>
                  <PersonIdentity txId={r.txId} address={r.address} avatarName={r.avatarName} avatarRole={r.avatarRole} avatarImage={r.avatarImage} />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
                    <StatusPill tone={needTone[r.kind]} icon={needIcon[r.kind]} label={r.pillLabel} />
                    <Link href={fileHref(r.txId)} className="agent-btn agent-btn-sm agent-btn-color-primary" style={{ textDecoration: "none" }}>{r.actionLabel}</Link>
                  </div>
                  <p style={{ flexBasis: "100%", margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{r.headline}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* CHASING NOW */}
      <div data-bloom>
        <GroupHeader title="Chasing now" count={chasing.length} tone="success"
          hint={chasing.length ? <>on their own{chasingRunLabel ? <> · next run <b style={{ color: "var(--agent-text-secondary)" }}>{chasingRunLabel}</b></> : null}</> : "no active chases"} />
        <div className="space-y-2">
          {chasing.map((r) => (
            <GlassCard key={r.txId} glassId="auto-cockpit-row" label="Cockpit · row" className="agent-hover-row" style={CARD_STYLE}>
              <div style={ROW_INNER}>
                <PhotoIdentity txId={r.txId} address={r.address} photoUrl={r.photoUrl} />
                {!r.onDefaultRun && (
                  <StatusPill tone="warning" icon={<CaretRight size={11} weight="bold" />} label={`Sends ${r.nextLabel}`} />
                )}
                <Link href={fileHref(r.txId)} className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ textDecoration: "none", flexShrink: 0 }}>View file</Link>
                <div style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--agent-text-muted)", flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--agent-text-secondary)", fontWeight: 600 }}>
                    {r.isSolicitor ? <PhoneCall size={12} weight="bold" /> : <RoleIcon role={r.isBuyerSide ? "purchaser" : "vendor"} size={12} />}
                    {r.who}
                  </span>
                  <span>·</span>
                  <span>{r.milestone}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 2 }}><Dots n={r.chaseNumber} max={r.chaseMax} /> chase {r.chaseNumber} of {r.chaseMax}</span>
                </div>
              </div>
            </GlassCard>
          ))}
          {chasing.length === 0 && (
            <GlassCard glassId="auto-cockpit-row" label="Cockpit · row" style={CARD_STYLE}>
              <p style={{ ...ROW_INNER, margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>No files are being chased right now.</p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* ALL SET */}
      {allSet.length > 0 && (
        <div data-bloom>
          <GroupHeader title="All set" count={allSet.length} tone="success" />
          <GlassCard glassId="auto-cockpit-quiet" label="Cockpit · quiet" className="agent-hover-row" style={CARD_STYLE}>
            <button type="button" onClick={() => setShowQuiet((s) => !s)} aria-expanded={showQuiet}
              style={{ width: "100%", background: "none", border: 0, cursor: "pointer", padding: "12px 15px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: "inherit", font: "inherit" }}>
              <CheckCircle size={20} weight="fill" style={{ color: "var(--agent-success, #16a34a)", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{allSet.length} {allSet.length === 1 ? "sale" : "sales"} fully covered</div>
                <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Every contact present, chasing on, nothing overdue. Tap to {showQuiet ? "collapse" : "expand"}.</div>
              </div>
              <CaretRight size={16} weight="bold" style={{ marginLeft: "auto", color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 150ms ease", transform: showQuiet ? "rotate(90deg)" : "none" }} />
            </button>
          </GlassCard>
          {showQuiet && (
            <div data-bloom style={{ marginTop: 8 }} className="space-y-2">
              {allSet.map((r) => (
                <GlassCard key={r.txId} glassId="auto-cockpit-row" label="Cockpit · row" className="agent-hover-row" style={CARD_STYLE}>
                  <div style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <PhotoIdentity txId={r.txId} address={r.address} photoUrl={r.photoUrl} />
                    {r.nextLabel && <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)", flexShrink: 0 }}>next {r.nextLabel}</span>}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAUSED */}
      {paused.length > 0 && (
        <div data-bloom>
          <GroupHeader title="Paused" count={paused.length} tone="muted" hint="automation off on these" />
          <GlassCard glassId="auto-cockpit-quiet" label="Cockpit · quiet" className="agent-hover-row" style={CARD_STYLE}>
            <button type="button" onClick={() => setShowPaused((s) => !s)} aria-expanded={showPaused}
              style={{ width: "100%", background: "none", border: 0, cursor: "pointer", padding: "12px 15px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: "inherit", font: "inherit" }}>
              <PauseCircle size={20} weight="fill" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{paused.length} paused</div>
                <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Automation is off on these. Tap to {showPaused ? "collapse" : "expand"}.</div>
              </div>
              <CaretRight size={16} weight="bold" style={{ marginLeft: "auto", color: "var(--agent-text-muted)", flexShrink: 0, transition: "transform 150ms ease", transform: showPaused ? "rotate(90deg)" : "none" }} />
            </button>
          </GlassCard>
          {showPaused && (
            <div data-bloom style={{ marginTop: 8 }} className="space-y-2">
              {paused.map((r) => (
                <GlassCard key={r.txId} glassId="auto-cockpit-row" label="Cockpit · row" className="agent-hover-row" style={CARD_STYLE}>
                  <div style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <PhotoIdentity txId={r.txId} address={r.address} photoUrl={r.photoUrl} />
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
