"use client";

// Command Centre → Agencies & agents → Setup readiness.
//
// One place to see, per agency, everything that should be set up for the best
// client experience: sending email, signatures, photos, logo, branded client
// emails, and whether they've brought their team on. Each row expands to the
// full detail with per-person breakdown and links to fix each gap.
//
// Responsive (critique: the 820px table forced a sideways scroll on smaller
// screens). Desktop keeps the table; tablet shows three group-progress bars
// (Email / Experience / Team) per agency; mobile shows status cards with the
// ticks wrapping under the name. All three share the same expand detail and the
// same open/only-gaps state. Read-only signals from lib/command/agency-readiness.ts.

import { Fragment, useState } from "react";
import InfoTip from "@/components/command/shared/InfoTip";
import {
  LEVEL,
  ReadinessPill,
  Tick,
  GroupGap,
  ReadinessDetail,
} from "@/components/command/agencies/ReadinessDetail";
import type { AgencySetupReadiness as Row } from "@/lib/command/agency-readiness";

// Tablet group-progress segments.
function Seg({ n, total }: { n: number; total: number }) {
  return (
    <span className="flex gap-[3px] flex-1">
      {Array.from({ length: total }).map((_, i) => (
        <i
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{ background: i < n ? "#34d399" : "#2a2a2a" }}
        />
      ))}
    </span>
  );
}
function BarRow({ label, n, total, mark }: { label: string; n: number; total: number; mark?: boolean }) {
  return (
    <div className="grid grid-cols-[74px_1fr_30px] items-center gap-2.5">
      <span className="text-[10px] font-mono uppercase tracking-wide text-neutral-500">{label}</span>
      <Seg n={n} total={total} />
      <span className="text-[10.5px] font-mono text-neutral-500 text-right">
        {mark ? (n > 0 ? "✓" : "○") : `${n}/${total}`}
      </span>
    </div>
  );
}

// One agency in the mobile (status card) view.
function MobileCard({ r, open, onToggle }: { r: Row; open: boolean; onToggle: () => void }) {
  const dnsDone = r.domain?.status === "verified";
  return (
    <div>
      <div onClick={onToggle} className="flex items-center gap-2.5 px-4 py-3 cursor-pointer">
        <span className={`text-neutral-600 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        <span className="flex-1 min-w-0 text-[13px] font-medium text-neutral-200 truncate">{r.name}</span>
        <ReadinessPill level={r.level} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-4 pb-3 pl-9">
        <Tick done={r.senderSet} label="Sender" />
        <Tick done={!!dnsDone} label="DNS" />
        <Tick done={r.inbound.level === "ready"} label="Inbound" />
        <span className="basis-full h-0" aria-hidden />
        <Tick done={r.signature.done} label="Signature" />
        <Tick done={r.photo.done} label="Photo" />
        <Tick done={r.logoSet} label="Logo" />
        <Tick done={r.emailThemeSet} label="Branding" />
        <span className="basis-full h-0" aria-hidden />
        <Tick done={r.team.done} label="Team" />
      </div>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-neutral-800/70 bg-neutral-950/40">
          <ReadinessDetail r={r} />
        </div>
      )}
    </div>
  );
}

// One agency in the tablet (group-progress) view.
function TabletRow({ r, open, onToggle }: { r: Row; open: boolean; onToggle: () => void }) {
  const emailOn = (r.senderSet ? 1 : 0) + (r.domain?.status === "verified" ? 1 : 0);
  const expOn = (r.signature.done ? 1 : 0) + (r.photo.done ? 1 : 0) + (r.logoSet ? 1 : 0) + (r.emailThemeSet ? 1 : 0);
  return (
    <div>
      <div onClick={onToggle} className="flex items-center gap-2.5 px-4 pt-3 pb-2 cursor-pointer">
        <span className={`text-neutral-600 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        <span className="flex-1 min-w-0 text-[13px] font-medium text-neutral-200 truncate">{r.name}</span>
        <ReadinessPill level={r.level} />
      </div>
      <div className="px-4 pb-3 pl-9 flex flex-col gap-2">
        <BarRow label="Email" n={emailOn} total={2} />
        <BarRow label="Experience" n={expOn} total={4} />
        <BarRow label="Team" n={r.team.done ? 1 : 0} total={1} mark />
      </div>
      {open && (
        <div className="px-4 pb-4 pt-3 pl-9 border-t border-neutral-800/70 bg-neutral-950/40">
          <ReadinessDetail r={r} />
        </div>
      )}
    </div>
  );
}

export function AgencySetupReadiness({
  rows,
  readyCount,
  total,
}: {
  rows: Row[];
  readyCount: number;
  total: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlyGaps, setOnlyGaps] = useState(false);

  const sorted = [...rows].sort(
    (a, b) => LEVEL[a.level].rank - LEVEL[b.level].rank || a.name.localeCompare(b.name),
  );
  const shown = onlyGaps ? sorted.filter((r) => r.level !== "ready") : sorted;
  const gaps = total - readyCount;
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const emptyLabel = total === 0 ? "No agencies yet." : "Every agency is fully set up.";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h2 className="text-[12px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          Setup readiness
          <InfoTip label="What setup readiness means">
            Everything an agency should set up for the best client experience: sending mail from their own
            domain, personalised signatures and photos, their logo, branded client emails, and bringing
            their team on. Fully set up means all six scored items are done (sender, DNS, signature, photo,
            logo, branding). Inbound and team are shown but not scored. Signals come from the same records
            the rest of the platform uses, rechecked nightly where relevant.
          </InfoTip>
          <span className="ml-1 font-mono text-neutral-600 normal-case tracking-normal">
            {readyCount}/{total} fully set up
          </span>
        </h2>
        {gaps > 0 && (
          <button
            type="button"
            onClick={() => setOnlyGaps((v) => !v)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
              onlyGaps
                ? "bg-neutral-700 text-white border-neutral-600"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {onlyGaps ? "Showing gaps" : `Show ${gaps} not done`}
          </button>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">{emptyLabel}</p>
        ) : (
          <>
            {/* Desktop: full table (lg and up) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                    <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Agency</th>
                    <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Setup</th>
                    <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Status</th>
                    <th className="text-right font-semibold px-4 py-2.5 border-b border-neutral-800"></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const open = openId === r.id;
                    const dnsDone = r.domain?.status === "verified";
                    return (
                      <Fragment key={r.id}>
                        <tr
                          onClick={() => toggle(r.id)}
                          className="cursor-pointer hover:bg-neutral-950/40 transition-colors"
                        >
                          <td className="px-4 py-3 border-b border-neutral-800/70 text-[13px] text-neutral-200 font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <span className={`text-neutral-600 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                              {r.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-neutral-800/70">
                            <span className="inline-flex items-center gap-3">
                              <Tick done={r.senderSet} label="Sender" />
                              <Tick done={!!dnsDone} label="DNS" />
                              <Tick done={r.inbound.level === "ready"} label="Inbound" />
                              <GroupGap />
                              <Tick done={r.signature.done} label="Signature" />
                              <Tick done={r.photo.done} label="Photo" />
                              <Tick done={r.logoSet} label="Logo" />
                              <Tick done={r.emailThemeSet} label="Branding" />
                              <GroupGap />
                              <Tick done={r.team.done} label="Team" />
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-neutral-800/70 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <ReadinessPill level={r.level} />
                              <span className="text-[11px] font-mono text-neutral-600">
                                {r.doneCount}/{r.totalSignals}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-neutral-800/70 text-right whitespace-nowrap">
                            <span className="text-[11px] text-neutral-500">{open ? "Close" : "View"}</span>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 border-b border-neutral-800/70 bg-neutral-950/40">
                              <ReadinessDetail r={r} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tablet: group-progress cards (md up to lg) */}
            <div className="hidden md:block lg:hidden divide-y divide-neutral-800">
              {shown.map((r) => (
                <TabletRow key={r.id} r={r} open={openId === r.id} onToggle={() => toggle(r.id)} />
              ))}
            </div>

            {/* Mobile: status cards (below md) */}
            <div className="md:hidden divide-y divide-neutral-800">
              {shown.map((r) => (
                <MobileCard key={r.id} r={r} open={openId === r.id} onToggle={() => toggle(r.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
