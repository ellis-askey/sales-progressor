import Link from "next/link";
import type { TrialSetup } from "@/lib/command/trial-cockpit";
import { Section, KpiCard, TableShell, Tr, Td, CardEmpty, fmtInt } from "@/components/command/ui/primitives";
import { fmtRelative } from "@/lib/command/format";

// Trial cockpit → Setup tab. How embedded they are: setup readiness, which
// automation switches are on, connected WhatsApp numbers and mailboxes, and
// how much they've made the product their own (copy + cadence overrides).
// Read-only — every switch and setting is EDITED on the Agency File, the one
// place per-agency settings change. Command-only (Law 8).

const LEVEL_META: Record<string, { label: string; cls: string }> = {
  ready: { label: "Ready", cls: "text-emerald-400 border-emerald-900/60 bg-emerald-950/30" },
  setting_up: { label: "Setting up", cls: "text-amber-400 border-amber-900/60 bg-amber-950/30" },
  broken: { label: "Broken", cls: "text-red-400 border-red-900/60 bg-red-950/30" },
  not_started: { label: "Not started", cls: "text-neutral-400 border-neutral-700 bg-neutral-900" },
};

function TickRow({ label, done, detail }: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-neutral-200">{label}</span>
      <span className="text-[12px] tabular-nums">
        {detail && <span className="text-neutral-500 mr-2">{detail}</span>}
        {done ? <span className="text-emerald-400">done</span> : <span className="text-amber-400">not yet</span>}
      </span>
    </div>
  );
}

export function SetupTab({ setup, agencyId }: { setup: TrialSetup; agencyId: string }) {
  const r = setup.readiness;
  const level = r ? LEVEL_META[r.level] ?? LEVEL_META.not_started : LEVEL_META.not_started;
  const switchesOn = setup.switches.filter((s) => s.on).length;

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-4">
        <Section
          title="Setup readiness"
          right={r ? <span className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${level.cls}`}>{level.label} · {r.doneCount}/{r.totalSignals}</span> : undefined}
          tip="The six scored signals. Editing happens on the Agency File; this is the trial-health read."
        >
          {!r ? (
            <CardEmpty>No readiness data.</CardEmpty>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 divide-y divide-neutral-800/70">
              <TickRow label="Sending address" done={r.senderSet} detail={r.senderEmail ?? undefined} />
              <TickRow label="Sending domain (DNS)" done={!!r.domain && r.domain.dkimValid && r.domain.spfValid} detail={r.domain?.domain} />
              <TickRow label="Email signatures" done={r.signature.done} detail={`${r.signature.withSignature}/${r.signature.total} people`} />
              <TickRow label="Profile photos" done={r.photo.done} detail={`${r.photo.withPhoto}/${r.photo.total} people`} />
              <TickRow label="Logo" done={r.logoSet} />
              <TickRow label="Email branding" done={r.emailThemeSet} />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-neutral-200">Inbound replies <span className="text-[10px] text-neutral-600">(not scored)</span></span>
                <span className="text-[12px]">
                  {r.inbound.level === "ready" ? <span className="text-emerald-400">flowing · {fmtInt(r.inbound.recentMessages)} recent</span>
                    : r.inbound.level === "connected_quiet" ? <span className="text-amber-400">connected, quiet</span>
                    : <span className="text-neutral-500">no mailbox</span>}
                </span>
              </div>
            </div>
          )}
          <p className="text-[11px] text-neutral-600 mt-2">
            Edit on the <Link href={`/command/agency/${agencyId}`} className="text-blue-400 hover:text-blue-300 transition-colors">Agency File →</Link>
          </p>
        </Section>

        <Section
          title={`Automation switches · ${switchesOn}/${setup.switches.length} on`}
          tip="Every switch they keep on is work the platform does for them — and a reason to stay."
        >
          {setup.switches.length === 0 ? (
            <CardEmpty>Agency not found.</CardEmpty>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 divide-y divide-neutral-800/70">
              {setup.switches.map((s) => (
                <div key={s.key} className="flex items-center justify-between py-2">
                  <span className="text-sm text-neutral-200">{s.label}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${s.on ? "text-emerald-400" : "text-neutral-600"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.on ? "bg-emerald-400" : "bg-neutral-700"}`} />
                    {s.on ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title={`WhatsApp numbers · ${setup.whatsapp.length}`} tip="Per-person WhatsApp connections feeding captured messages onto files.">
          {setup.whatsapp.length === 0 ? (
            <CardEmpty>No WhatsApp connections.</CardEmpty>
          ) : (
            <TableShell head={["Person", "Status", "Last message"]}>
              {setup.whatsapp.map((w, i) => (
                <Tr key={i}>
                  <Td first>{w.name}</Td>
                  <Td>
                    <span className={`text-[11px] font-medium ${w.status === "connected" ? "text-emerald-400" : w.status === "pending_qr" ? "text-amber-400" : "text-neutral-500"}`}>
                      {w.status === "pending_qr" ? "awaiting QR" : w.status}
                    </span>
                  </Td>
                  <Td muted>{w.lastMessageAt ? fmtRelative(w.lastMessageAt) : "—"}</Td>
                </Tr>
              ))}
            </TableShell>
          )}
        </Section>

        <Section title={`Connected mailboxes · ${setup.mailboxes.length}`} tip="Mailboxes capturing replies back onto files (Outlook or IMAP).">
          {setup.mailboxes.length === 0 ? (
            <CardEmpty>No connected mailboxes.</CardEmpty>
          ) : (
            <TableShell head={["Person", "Mailbox", "Kind"]}>
              {setup.mailboxes.map((m, i) => (
                <Tr key={i}>
                  <Td first>{m.name}</Td>
                  <Td muted>{m.email}</Td>
                  <Td muted>{m.kind === "outlook" ? "Outlook" : "IMAP"}</Td>
                </Tr>
              ))}
            </TableShell>
          )}
        </Section>
      </div>

      <Section
        title="Made it their own"
        subtitle="Customisation depth: every override is configuration they would lose by leaving."
        tip="Their own versions of client email copy and chase cadences, counted from the override tables."
      >
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <KpiCard label="Milestone emails" value={fmtInt(setup.customisation.milestoneEmails)} sub="own versions" tip="Milestone email copy they have overridden for their agency." />
          <KpiCard label="Other client emails" value={fmtInt(setup.customisation.emailTemplates)} sub="own versions" tip="Non-milestone client email templates they have customised." />
          <KpiCard label="Chase cadences" value={fmtInt(setup.customisation.chaseRules)} sub="own rules" tip="Chase timing rules they have tuned away from the platform defaults." />
        </div>
      </Section>
    </div>
  );
}
