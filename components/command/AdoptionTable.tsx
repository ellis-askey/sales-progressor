"use client";

import { useMemo, useState } from "react";
import {
  isDeeplyEngaged,
  isUnreachable,
  type AdoptionClient,
  type CommsStatus,
  type LastEmail,
  type LastEmailStatus,
} from "@/lib/command/adoption";

// Command Centre → App adoption table. Client component so each row can expand
// into a full per-client detail panel (Stage 2). The base row stays light: one
// glance-value per column. Everything else lives in the expand.

function fmtWhen(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtWhenYear(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function titleCase(code: string): string {
  return code
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

const SALE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  on_hold: "On hold",
};

type FilterKey = "all" | "never_visited" | "notifications_off" | "cant_reach" | "engaged";

const FILTERS: { key: FilterKey; label: string; match: (c: AdoptionClient) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "never_visited", label: "Never visited", match: (c) => c.lastVisited == null },
  { key: "notifications_off", label: "Notifications off", match: (c) => !c.notifications },
  { key: "cant_reach", label: "Can't reach", match: (c) => isUnreachable(c.comms.kind) },
  { key: "engaged", label: "Deeply engaged", match: (c) => isDeeplyEngaged(c) },
];

export function AdoptionTable({ clients }: { clients: AdoptionClient[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>("all");

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const counts = useMemo(() => {
    const m = {} as Record<FilterKey, number>;
    for (const f of FILTERS) m[f.key] = clients.filter(f.match).length;
    return m;
  }, [clients]);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = useMemo(() => clients.filter(active.match), [clients, active]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-b border-neutral-800">
        {FILTERS.map((f) => {
          const on = f.key === filter;
          const warn = f.key === "cant_reach" && counts[f.key] > 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                on
                  ? "bg-neutral-100 text-neutral-900 border-neutral-100"
                  : warn
                    ? "bg-transparent text-[#f6b17a] border-[#5a3f2c] hover:bg-neutral-800/60"
                    : "bg-transparent text-neutral-400 border-neutral-700 hover:bg-neutral-800/60"
              }`}
            >
              {f.label}
              <span className={on ? "text-neutral-500" : "text-neutral-600"}> {counts[f.key]}</span>
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
              <th className="w-8 border-b border-neutral-800" />
              <Th>Client</Th>
              <Th>Agency</Th>
              <Th>Side</Th>
              <Th>Comms</Th>
              <Th>Notifications</Th>
              <Th>Installed</Th>
              <Th>Last opened</Th>
              <Th>Last visit</Th>
              <Th>Engaged</Th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-[13px] text-neutral-500">
                  {clients.length === 0 ? "No live-file clients yet." : "No clients match this filter."}
                </td>
              </tr>
            ) : (
              shown.map((c) => {
                const isOpen = open.has(c.id);
                return (
                  <RowGroup key={c.id} client={c} isOpen={isOpen} onToggle={() => toggle(c.id)} />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({
  client: c,
  isOpen,
  onToggle,
}: {
  client: AdoptionClient;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors ${isOpen ? "bg-neutral-800/40" : "hover:bg-neutral-800/30"}`}
      >
        <td className="pl-3 border-b border-neutral-800/70 align-middle">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={isOpen ? `Hide ${c.name} detail` : `Show ${c.name} detail`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
          </button>
        </td>
        <Td className="text-neutral-200 font-medium">
          {c.name}
          <div className="text-[11px] text-neutral-500 font-normal">{c.address}</div>
        </Td>
        <Td className="text-neutral-400 text-[12px]">{c.agencyName}</Td>
        <Td className="text-neutral-400 text-[12px]">{c.role}</Td>
        <Td><CommsChip comms={c.comms} /></Td>
        <Td><YesNo on={c.notifications} /></Td>
        <Td><YesNo on={c.installed} /></Td>
        <Td className="text-neutral-400 text-[12px]">{fmtWhen(c.lastOpened)}</Td>
        <Td className="text-neutral-400 text-[12px]">{fmtWhen(c.lastVisited)}</Td>
        <Td className="text-neutral-400 text-[12px] tabular-nums">
          {c.engagedMinutes > 0 ? `${c.engagedMinutes}m` : "—"}
        </Td>
      </tr>
      {isOpen && (
        <tr className="bg-neutral-950">
          <td colSpan={10} className="px-6 py-5 border-b border-neutral-800">
            <DetailPanel client={c} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailPanel({ client: c }: { client: AdoptionClient }) {
  const d = c.detail;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <Section title="Contact">
        <Field label="Email" value={d.email || "No email on file"} muted={!d.email} />
        <Field label="Phone" value={d.phone || "No phone on file"} muted={!d.phone} />
      </Section>

      <Section title="Comms">
        <p className="text-[13px] text-neutral-300 leading-relaxed">{commsSentence(c.comms, d.lastEmail)}</p>
      </Section>

      <Section title="Last email">
        {d.lastEmail ? (
          <>
            <Field label="Type" value={titleCase(d.lastEmail.type)} />
            <Field label="Outcome" value={<LastEmailBadge status={d.lastEmail.status} />} />
            <Field label="Sent" value={fmtWhenYear(d.lastEmail.at)} />
            {d.lastEmail.reason && <Field label="Reason" value={d.lastEmail.reason} muted />}
          </>
        ) : (
          <p className="text-[13px] text-neutral-600">No emails sent yet.</p>
        )}
      </Section>

      <Section title="Engagement">
        <Field label="Visits" value={String(d.visits)} muted={d.visits === 0} />
        <Field label="First visit" value={fmtWhenYear(d.firstVisitAt)} muted={!d.firstVisitAt} />
        <Field label="Last visit" value={fmtWhenYear(c.lastVisited)} muted={!c.lastVisited} />
        <Field label="Total time" value={c.engagedMinutes > 0 ? `${c.engagedMinutes} min` : "None yet"} muted={c.engagedMinutes === 0} />
        <Field label="Installed" value={c.installed ? fmtWhenYear(d.installedAt) : "No"} muted={!c.installed} />
        <Field label="Notifications" value={c.notifications ? "On" : "Off"} muted={!c.notifications} />
      </Section>

      <Section title="Signals">
        <div className="flex flex-wrap gap-1.5">
          <SignalChip on={d.welcomeSeen} label="Welcome seen" />
          <SignalChip on={d.hasPhoto} label="Profile photo" />
          <SignalChip on={d.customisedOverview} label="Customised overview" />
          <SignalChip on={d.requestedBrokerCallback} label="Broker call-back" />
          <SignalChip on={d.gaveExchangeAuthority} label="Exchange authority" />
        </div>
      </Section>

      <Section title="Sale">
        <Field label="Status" value={SALE_STATUS_LABEL[d.saleStatus] ?? titleCase(d.saleStatus)} />
        <Field label="Agency" value={c.agencyName} />
      </Section>
    </div>
  );
}

// Plain-English description of the comms status for the detail panel.
function commsSentence(comms: CommsStatus, lastEmail: LastEmail | null): string {
  switch (comms.kind) {
    case "reachable":
      return "Reachable by email.";
    case "no_email":
      return "No email on file, so we can't email this client.";
    case "opted_out":
      return comms.since
        ? `Opted out of all emails on ${fmtWhenYear(comms.since)}.`
        : "Opted out of all emails.";
    case "bouncing":
      return lastEmail?.reason
        ? `Email is bouncing: ${lastEmail.reason}`
        : "Email to this address is bouncing.";
    case "agent_paused":
      return comms.since
        ? `Chase emails paused by an agent since ${fmtWhenYear(comms.since)}.`
        : "Chase emails paused by an agent.";
    case "client_paused":
      return comms.pausedUntil
        ? `Client paused chases until ${fmtWhenYear(comms.pausedUntil)}.`
        : "Client paused chases.";
  }
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-[13px]">
      <span className="text-neutral-600 w-28 shrink-0">{label}</span>
      <span className={muted ? "text-neutral-600" : "text-neutral-200"}>{value}</span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 border-b border-neutral-800/70 text-[13px] ${className}`}>{children}</td>;
}

function CommsChip({ comms }: { comms: CommsStatus }) {
  const map: Record<CommsStatus["kind"], { label: string; cls: string }> = {
    reachable: { label: "Reachable", cls: "bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]" },
    no_email: { label: "No email", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
    opted_out: { label: "Opted out", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
    bouncing: { label: "Bouncing", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
    agent_paused: { label: "Agent paused", cls: "bg-[#352c14] text-[#f6d17a] border-[#5a4f2c]" },
    client_paused: {
      label: comms.pausedUntil ? `Paused til ${fmtWhen(comms.pausedUntil)}` : "Paused",
      cls: "bg-[#352c14] text-[#f6d17a] border-[#5a4f2c]",
    },
  };
  const { label, cls } = map[comms.kind];
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function LastEmailBadge({ status }: { status: LastEmailStatus }) {
  const map: Record<LastEmailStatus, { label: string; cls: string }> = {
    delivered: { label: "Delivered", cls: "bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]" },
    sent: { label: "Sent", cls: "bg-neutral-800 text-neutral-400 border-neutral-700" },
    pending: { label: "Pending", cls: "bg-neutral-800 text-neutral-500 border-neutral-700" },
    deferred: { label: "Deferred", cls: "bg-[#352c14] text-[#f6d17a] border-[#5a4f2c]" },
    bounced: { label: "Bounced", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
    blocked: { label: "Blocked", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
  };
  const { label, cls } = map[status];
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function SignalChip({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]">
      {label}
    </span>
  ) : (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-neutral-900 text-neutral-600 border-neutral-800">
      {label}
    </span>
  );
}

function YesNo({ on }: { on: boolean }) {
  return on ? (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]">On</span>
  ) : (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-neutral-800 text-neutral-600 border-neutral-700">—</span>
  );
}
