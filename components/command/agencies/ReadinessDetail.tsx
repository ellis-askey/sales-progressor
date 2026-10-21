"use client";

// Command Centre: the per-agency setup-readiness breakdown, shared between the
// Agencies list board (AgencySetupReadiness) and the Agency File page. One
// source of truth for the level/inbound styling, the tick marks, and the full
// two-column Email / Experience detail with per-person breakdown.

import Link from "next/link";
import { AgencyDomainAuth } from "@/components/command/email-senders/AgencyDomainAuth";
import type {
  AgencySetupReadiness as Row,
  ReadinessLevel,
  InboundLevel,
} from "@/lib/command/agency-readiness";

export const LEVEL: Record<ReadinessLevel, { label: string; cls: string; rank: number }> = {
  broken: { label: "Action needed", cls: "text-red-400 bg-red-950/40 border-red-900", rank: 0 },
  not_started: { label: "Not started", cls: "text-neutral-400 bg-neutral-800 border-neutral-700", rank: 1 },
  setting_up: { label: "Setting up", cls: "text-amber-400 bg-amber-950/50 border-amber-900", rank: 2 },
  ready: { label: "Fully set up", cls: "text-emerald-400 bg-emerald-950/50 border-emerald-900", rank: 3 },
};

// Inbound is shown but not scored into the pill: a connected mailbox landing
// replies back on files. Kept visually distinct so it never folds into the
// overall readiness state.
export const INBOUND: Record<InboundLevel, { label: string; mark: string; color: string; pill: string }> = {
  ready: { label: "Receiving", mark: "✓", color: "#6ee7b7", pill: "text-emerald-400 bg-emerald-950/50 border-emerald-900" },
  connected_quiet: { label: "Quiet", mark: "◑", color: "#fbbf24", pill: "text-amber-400 bg-amber-950/50 border-amber-900" },
  none: { label: "Not connected", mark: "○", color: "#71717a", pill: "text-neutral-400 bg-neutral-800 border-neutral-700" },
};

export function ReadinessPill({ level }: { level: ReadinessLevel }) {
  const s = LEVEL[level];
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function Tick({ done, label }: { done: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: done ? "#6ee7b7" : "#71717a" }}>
      <span className="text-[13px] leading-none">{done ? "✓" : "○"}</span>
      {label}
    </span>
  );
}

// Thin separator between tick groups in the compact Setup cell.
export function GroupGap() {
  return <span className="inline-block w-px h-3.5 bg-neutral-800" aria-hidden />;
}

// A labelled item inside the expanded detail, with a done mark and body copy.
function DetailItem({
  done,
  title,
  children,
  mark,
  markColor,
}: {
  done: boolean;
  title: string;
  children: React.ReactNode;
  mark?: string;
  markColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[13px] leading-6" style={{ color: markColor ?? (done ? "#6ee7b7" : "#71717a") }}>
        {mark ?? (done ? "✓" : "○")}
      </span>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-neutral-200">{title}</p>
        {children}
      </div>
    </div>
  );
}

// The full per-agency detail, shared across the list board's expanded row and
// the Agency File's Setup section.
export function ReadinessDetail({ r }: { r: Row }) {
  const dnsDone = r.domain?.status === "verified";
  return (
    <div className="grid md:grid-cols-2 gap-x-8 gap-y-5 max-w-4xl">
      {/* ---- Email ---- */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-neutral-600">Email</p>

        <DetailItem done={r.senderSet} title="Sending address">
          {r.senderSet ? (
            <p className="text-[12px] text-neutral-400 font-mono break-all">{r.senderEmail}</p>
          ) : (
            <p className="text-[12px] text-neutral-500">
              No sending address set. Mail goes out from the shared Sales Progressor address
              until the domain below is authenticated, which sets this automatically.
            </p>
          )}
        </DetailItem>

        {/* Domain authentication reuses the email-senders cell */}
        <div className="flex items-start gap-3">
          <span className="text-[13px] leading-6" style={{ color: dnsDone ? "#6ee7b7" : "#71717a" }}>
            {dnsDone ? "✓" : "○"}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[13px] font-semibold text-neutral-200">Domain authentication (DNS)</p>
              <AgencyDomainAuth
                agency={{ id: r.id, name: r.name, quoteSenderEmail: r.senderEmail }}
                initial={r.domain}
              />
            </div>
            <p className="text-[12px] text-neutral-500 mt-1">
              {dnsDone
                ? "DKIM and SPF verified. This agency sends from its own domain."
                : r.domain
                  ? "DNS records generated. The agency needs to add them at their registrar, then check status here."
                  : "Not started. Generate the DNS records, then send them to the agency to add at their registrar."}
            </p>
          </div>
        </div>

        <DetailItem
          done={r.inbound.level === "ready"}
          title="Inbound email (replies land on files)"
          mark={INBOUND[r.inbound.level].mark}
          markColor={INBOUND[r.inbound.level].color}
        >
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[10px] font-mono uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${INBOUND[r.inbound.level].pill}`}
            >
              {INBOUND[r.inbound.level].label}
            </span>
            <span className="text-[10px] text-neutral-600">not scored</span>
          </div>
          <p className="text-[12px] text-neutral-500 mt-1">
            {r.inbound.level === "ready"
              ? "Connected and receiving. Recent replies are landing on files."
              : r.inbound.level === "connected_quiet"
                ? "A mailbox is connected, but no replies have landed in the last 30 days."
                : "No mailbox connected yet. A director or negotiator connects their inbox from their Account > Connections page."}
          </p>
        </DetailItem>
      </div>

      {/* ---- Experience ---- */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-neutral-600">Experience</p>

        <DetailItem done={r.logoSet} title="Agency logo">
          <p className="text-[12px] text-neutral-500">
            {r.logoSet ? (
              "Logo uploaded. It appears on the agency's client emails."
            ) : r.primaryUserId ? (
              <>
                No logo yet.{" "}
                <Link href={`/command/agencies/${r.primaryUserId}`} className="text-blue-400 hover:text-blue-300">
                  Set it from the agency&rsquo;s profile
                </Link>
                .
              </>
            ) : (
              "No logo yet, and no director to set it up."
            )}
          </p>
        </DetailItem>

        <DetailItem done={r.emailThemeSet} title="Client-email branding">
          <p className="text-[12px] text-neutral-500">
            {r.emailThemeSet ? (
              "Branded client emails set up."
            ) : r.primaryUserId ? (
              <>
                Using the default look.{" "}
                <Link href={`/command/agencies/${r.primaryUserId}`} className="text-blue-400 hover:text-blue-300">
                  Customise their branding
                </Link>
                .
              </>
            ) : (
              "Using the default look, and no director to customise it."
            )}
          </p>
        </DetailItem>

        {/* Per-person signatures & photos (director-anchored ticks above) */}
        <div className="flex items-start gap-3">
          <span
            className="text-[13px] leading-6"
            style={{ color: r.signature.done && r.photo.done ? "#6ee7b7" : "#71717a" }}
          >
            {r.signature.done && r.photo.done ? "✓" : "○"}
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-neutral-200">Signatures &amp; photos</p>
            {r.members.length === 0 ? (
              <p className="text-[12px] text-neutral-500 mt-0.5">No team members yet.</p>
            ) : (
              <>
                <p className="text-[12px] text-neutral-500 mt-0.5">
                  {r.photo.withPhoto} of {r.photo.total} have a photo ·{" "}
                  {r.signature.withSignature} of {r.signature.total} have personalised their signature
                </p>
                <ul className="mt-2 space-y-1">
                  {r.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 text-[12px]">
                      <Link
                        href={`/command/agencies/${m.id}`}
                        className="text-neutral-300 hover:text-blue-300 min-w-[9rem]"
                      >
                        {m.name}
                        <span className="text-neutral-600 capitalize"> · {m.role}</span>
                      </Link>
                      <span style={{ color: m.hasPhoto ? "#6ee7b7" : "#71717a" }}>
                        {m.hasPhoto ? "✓" : "○"} photo
                      </span>
                      <span style={{ color: m.hasSignature ? "#6ee7b7" : "#71717a" }}>
                        {m.hasSignature ? "✓" : "○"} signature
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* ---- Team (informational) ---- */}
        <DetailItem done={r.team.done} title="Team">
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-neutral-600">not scored</span>
          </div>
          <p className="text-[12px] text-neutral-500 mt-1">
            {r.team.userCount} {r.team.userCount === 1 ? "person" : "people"} on the account
            {r.team.invitationCount > 0
              ? `, ${r.team.invitationCount} invite${r.team.invitationCount === 1 ? "" : "s"} outstanding.`
              : r.team.userCount <= 1
                ? ". A one-person agency is fine here, nothing to chase."
                : "."}
          </p>
        </DetailItem>
      </div>
    </div>
  );
}
