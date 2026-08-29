"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getProspectDetailAction, changeProspectStatusAction, addProspectNoteAction,
  addProspectContactAction, setPrimaryContactAction, updateProspectAction,
  logProspectCallAction, scheduleFollowUpAction, completeFollowUpAction, markProspectLostAction,
  convertProspectAction, unlinkProspectAction, searchAgenciesAction, getConvertedAgencyStatsAction,
} from "@/app/actions/prospects";
import {
  PROSPECT_STATUSES, STATUS_LABEL, STATUS_TONE, SOURCE_LABEL,
  CALL_OUTCOMES, CALL_OUTCOME_LABEL, LOST_REASONS, LOST_REASON_LABEL,
} from "@/lib/command/prospect-labels";
import { FollowUpCompose } from "./FollowUpCompose";
import type { ProspectDetail, AgencyMatch, ConvertedAgencyStats } from "@/lib/command/prospects";
import type { ProspectStatus } from "@prisma/client";

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
const ACTIVITY_LABEL: Record<string, string> = {
  created: "Prospect created", email_sent: "Email sent", email_received: "Reply received",
  call_logged: "Call logged", note: "Note", status_changed: "Status changed",
  follow_up_scheduled: "Follow-up scheduled", follow_up_completed: "Follow-up done",
  contact_added: "Contact added", converted: "Converted", lost: "Marked lost",
};
const inputCls = "w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb]";

export function ProspectDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<null | "note" | "contact" | "edit" | "call" | "followup" | "lost" | "email" | "convert">(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setD(await getProspectDetailAction(id)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  function after() { setPanel(null); load(); router.refresh(); }

  const primaryEmail = d ? (d.contacts.find((c) => c.isPrimary)?.email ?? d.contacts[0]?.email ?? d.generalEmail ?? null) : null;
  const canEmail = d ? !d.optedOutAt && !d.bouncedAt : false;
  const emailDisabledReason = d?.optedOutAt ? "they've opted out" : d?.bouncedAt ? "a previous email bounced" : "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg h-full bg-neutral-950 border-l border-neutral-800 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {loading || !d ? <p className="text-sm text-neutral-500">Loading…</p> : (
              <>
                <h2 className="text-lg font-semibold text-neutral-100 truncate">{d.agencyName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_TONE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  <span className="text-[11px] text-neutral-500">{SOURCE_LABEL[d.source]}</span>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 text-sm shrink-0">Close</button>
        </div>

        {d && (
          <div className="p-6 space-y-6">
            {d.convertedAgency && (
              <ConvertedBanner
                agencyId={d.convertedAgency.id}
                agencyName={d.convertedAgency.name}
                convertedAt={d.convertedAt}
                onUnlink={() => startTransition(async () => { await unlinkProspectAction(id); after(); })}
                pending={pending}
              />
            )}

            {/* Next follow-up */}
            <div className="flex items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5">
              <div className="text-xs">
                <span className="text-neutral-500">Next follow-up: </span>
                {d.nextFollowUpAt ? (
                  <span className={new Date(d.nextFollowUpAt).getTime() <= Date.now() ? "text-amber-400" : "text-neutral-200"}>{fmtDateTime(d.nextFollowUpAt)}</span>
                ) : (
                  <span className="text-neutral-600">none set</span>
                )}
              </div>
              {d.nextFollowUpAt && (
                <button onClick={() => startTransition(async () => { await completeFollowUpAction(id); after(); })} disabled={pending} className="text-[11px] text-neutral-500 hover:text-neutral-300">Mark done</button>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <StatusChanger current={d.status} onChange={(s) => startTransition(async () => { await changeProspectStatusAction(id, s); after(); })} disabled={pending} />
              <ActionBtn onClick={() => setPanel(panel === "email" ? null : "email")} active={panel === "email"}>Email</ActionBtn>
              <ActionBtn onClick={() => setPanel(panel === "call" ? null : "call")} active={panel === "call"}>Log call</ActionBtn>
              <ActionBtn onClick={() => setPanel(panel === "followup" ? null : "followup")} active={panel === "followup"}>Follow up</ActionBtn>
              <ActionBtn onClick={() => setPanel(panel === "note" ? null : "note")} active={panel === "note"}>Add note</ActionBtn>
              <ActionBtn onClick={() => setPanel(panel === "contact" ? null : "contact")} active={panel === "contact"}>Add contact</ActionBtn>
              <ActionBtn onClick={() => setPanel(panel === "edit" ? null : "edit")} active={panel === "edit"}>Edit details</ActionBtn>
              {!d.convertedAgency && <ActionBtn onClick={() => setPanel(panel === "convert" ? null : "convert")} active={panel === "convert"}>Won / convert</ActionBtn>}
              <ActionBtn onClick={() => setPanel(panel === "lost" ? null : "lost")} active={panel === "lost"}>Mark lost</ActionBtn>
            </div>

            {panel === "email" && <FollowUpCompose prospectId={id} defaultTo={primaryEmail} disabled={!canEmail} disabledReason={emailDisabledReason} onSent={after} />}
            {panel === "call" && <CallPanel onSave={(input) => startTransition(async () => { await logProspectCallAction(id, input); after(); })} pending={pending} />}
            {panel === "followup" && <FollowUpPanel onSave={(iso) => startTransition(async () => { await scheduleFollowUpAction(id, iso); after(); })} pending={pending} />}
            {panel === "lost" && <LostPanel onSave={(reason, revisit) => startTransition(async () => { await markProspectLostAction(id, reason, revisit); after(); })} pending={pending} />}
            {panel === "note" && <NotePanel onSave={(text) => startTransition(async () => { await addProspectNoteAction(id, text); after(); })} pending={pending} />}
            {panel === "contact" && <ContactPanel onSave={(input) => startTransition(async () => { await addProspectContactAction(id, input); after(); })} pending={pending} />}
            {panel === "edit" && <EditPanel d={d} onSave={(patch) => startTransition(async () => { await updateProspectAction(id, patch); after(); })} pending={pending} />}
            {panel === "convert" && <ConvertPanel onConvert={async (agencyId) => { const r = await convertProspectAction(id, agencyId); if (r.ok) after(); return r; }} />}

            {/* Agency info */}
            <Section title="Agency">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <Field label="Location" value={d.location} />
                <Field label="Postcode" value={d.postcode} />
                <Field label="Website" value={d.website} />
                <Field label="Phone" value={d.phone} />
                <Field label="General email" value={d.generalEmail} />
                <Field label="Branches" value={d.branchCount != null ? String(d.branchCount) : null} />
                <Field label="Size" value={d.sizeNote} />
                <Field label="Follow-ups sent" value={String(d.followUpCount)} />
              </dl>
            </Section>

            {/* Contacts */}
            <Section title={`Contacts · ${d.contacts.length}`}>
              {d.contacts.length === 0 ? <p className="text-xs text-neutral-600">No contacts yet.</p> : (
                <div className="space-y-2">
                  {d.contacts.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3 border-b border-neutral-900 pb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-200">{c.name}</span>
                          {c.isPrimary && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-900">primary</span>}
                          {c.isDecisionMaker && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400">decision-maker</span>}
                        </div>
                        <div className="text-[11px] text-neutral-500">{[c.jobTitle, c.email, c.phone].filter(Boolean).join(" · ") || "—"}</div>
                      </div>
                      {!c.isPrimary && (
                        <button onClick={() => startTransition(async () => { await setPrimaryContactAction(id, c.id); after(); })} disabled={pending} className="text-[10px] text-neutral-500 hover:text-neutral-300 shrink-0">Make primary</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Emails */}
            {d.emails.length > 0 && (
              <Section title={`Emails · ${d.emails.length}`}>
                <div className="space-y-2">
                  {d.emails.map((e) => (
                    <div key={e.id} className="border-b border-neutral-900 pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-200 truncate">{e.subject}</span>
                        <span className="text-[10px] text-neutral-600 shrink-0">{fmtDateTime(e.sentAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {e.repliedAt && <EmailChip label="Replied" tone="emerald" />}
                        {e.openedAt && <EmailChip label="Opened" tone="blue" />}
                        {e.clickedAt && <EmailChip label="Clicked" tone="cyan" />}
                        {e.bouncedAt ? <EmailChip label="Bounced" tone="red" /> : e.deliveredAt && <EmailChip label="Delivered" tone="neutral" />}
                        {e.aiGenerated && <EmailChip label="AI" tone="violet" />}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Notes */}
            {d.notes && (
              <Section title="Notes">
                <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">{d.notes}</p>
              </Section>
            )}

            {/* Timeline */}
            <Section title="Activity">
              {d.activities.length === 0 ? <p className="text-xs text-neutral-600">Nothing logged yet.</p> : (
                <div className="space-y-2.5">
                  {d.activities.map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 shrink-0 mt-0.5">{ACTIVITY_LABEL[a.type] ?? a.type}</span>
                      <div className="flex-1 min-w-0">
                        {a.summary && <p className="text-xs text-neutral-300">{a.summary}</p>}
                        {a.body && <p className="text-[11px] text-neutral-500 mt-0.5 whitespace-pre-wrap">{a.body}</p>}
                      </div>
                      <span className="text-[10px] text-neutral-600 shrink-0 whitespace-nowrap">{fmtDateTime(a.occurredAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return <button onClick={onClick} className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${active ? "bg-neutral-100 text-neutral-900 border-neutral-100" : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800"}`}>{children}</button>;
}

function StatusChanger({ current, onChange, disabled }: { current: ProspectStatus; onChange: (s: ProspectStatus) => void; disabled: boolean }) {
  return (
    <select value={current} onChange={(e) => onChange(e.target.value as ProspectStatus)} disabled={disabled} className="text-xs bg-neutral-900 text-neutral-200 border border-neutral-700 rounded-md px-2 py-1 focus:outline-none focus:border-neutral-500">
      {PROSPECT_STATUSES.map((s) => <option key={s} value={s} className="bg-neutral-900">{STATUS_LABEL[s]}</option>)}
    </select>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}
function EmailChip({ label, tone }: { label: string; tone: "emerald" | "blue" | "cyan" | "red" | "neutral" | "violet" }) {
  const cls: Record<string, string> = {
    emerald: "bg-emerald-950 text-emerald-300 border-emerald-900",
    blue: "bg-blue-950 text-blue-300 border-blue-900",
    cyan: "bg-cyan-950 text-cyan-300 border-cyan-900",
    red: "bg-red-950 text-red-400 border-red-900",
    neutral: "bg-neutral-800 text-neutral-400 border-neutral-700",
    violet: "bg-violet-950 text-violet-300 border-violet-900",
  };
  return <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${cls[tone]}`}>{label}</span>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-neutral-900 pb-1">
      <dt className="text-neutral-600 shrink-0">{label}</dt>
      <dd className="text-neutral-300 text-right truncate">{value ?? "—"}</dd>
    </div>
  );
}

const fmtDay = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—");

// Shown once a prospect is linked to a real agency: the win banner + a live
// rollup of what that agency is now worth (files on the platform + revenue).
function ConvertedBanner({ agencyId, agencyName, convertedAt, onUnlink, pending }: {
  agencyId: string; agencyName: string; convertedAt: Date | null; onUnlink: () => void; pending: boolean;
}) {
  const [stats, setStats] = useState<ConvertedAgencyStats | null>(null);
  useEffect(() => { getConvertedAgencyStatsAction(agencyId).then(setStats).catch(() => {}); }, [agencyId]);
  return (
    <div className="bg-emerald-950/30 border border-emerald-900/70 rounded-lg px-4 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-emerald-300">Won: now the agency <span className="font-medium">{agencyName}</span>{convertedAt ? ` · ${fmtDay(convertedAt)}` : ""}.</p>
        <button onClick={onUnlink} disabled={pending} className="text-[10px] text-emerald-500/70 hover:text-emerald-200 shrink-0">Unlink</button>
      </div>
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Files" value={String(stats.transactions)} />
          <MiniStat label="Billed sales" value={String(stats.billedSales)} />
          <MiniStat label="Revenue" value={`£${Math.round(stats.bankedPence / 100).toLocaleString("en-GB")}`} />
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-emerald-950/40 border border-emerald-900/50 px-2 py-1.5 text-center">
      <div className="text-sm font-semibold text-emerald-200 tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-emerald-500/70">{label}</div>
    </div>
  );
}

// Suggest-and-confirm conversion: search real agency accounts, pick the one this
// prospect became, confirm. Debounced live search; already-linked agencies are
// shown but not selectable.
function ConvertPanel({ onConvert }: { onConvert: (agencyId: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AgencyMatch[]>([]);
  const [searching, setSearching] = useState(true);
  const [picked, setPicked] = useState<AgencyMatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try { const r = await searchAgenciesAction(q); if (live) setResults(r); }
      finally { if (live) setSearching(false); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  async function confirm() {
    if (!picked) return;
    setSaving(true); setError(null);
    const r = await onConvert(picked.id);
    if (!r.ok) { setError(r.error ?? "Couldn't convert."); setSaving(false); }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2.5">
      <p className="text-[11px] text-neutral-500">Link this prospect to the real agency account it became. This records the win and starts tracking their files and revenue here.</p>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Search agency accounts by name…" className={inputCls} autoFocus />
      <div className="max-h-56 overflow-y-auto space-y-1">
        {searching ? <p className="text-[11px] text-neutral-600 px-1">Searching…</p>
          : results.length === 0 ? <p className="text-[11px] text-neutral-600 px-1">No matching agency accounts.</p>
          : results.map((r) => (
            <button
              key={r.id}
              onClick={() => !r.alreadyLinked && setPicked(r)}
              disabled={r.alreadyLinked}
              className={`w-full text-left px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                picked?.id === r.id ? "bg-emerald-950 text-emerald-200 border-emerald-800"
                : r.alreadyLinked ? "bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed"
                : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600"}`}
            >
              <span className="font-medium">{r.name}</span>
              <span className="text-neutral-600"> · created {fmtDay(r.createdAt)}</span>
              {r.alreadyLinked && <span className="text-neutral-600"> · already linked</span>}
            </button>
          ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={confirm} disabled={!picked || saving} className="text-xs px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 disabled:opacity-40">
        {saving ? "Converting…" : picked ? `Confirm: ${picked.name} won` : "Pick an agency"}
      </button>
    </div>
  );
}

function NotePanel({ onSave, pending }: { onSave: (t: string) => void; pending: boolean }) {
  const [t, setT] = useState("");
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2">
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={3} placeholder="What happened / context…" className={inputCls} />
      <button onClick={() => onSave(t)} disabled={pending || !t.trim()} className="text-xs px-2.5 py-1 rounded-md bg-blue-950 text-blue-300 border border-blue-900 hover:bg-blue-900 disabled:opacity-40">{pending ? "…" : "Save note"}</button>
    </div>
  );
}

function ContactPanel({ onSave, pending }: { onSave: (i: { name: string; jobTitle?: string; email?: string; phone?: string; isDecisionMaker?: boolean }) => void; pending: boolean }) {
  const [f, setF] = useState({ name: "", jobTitle: "", email: "", phone: "", isDecisionMaker: false });
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className={inputCls} />
        <input value={f.jobTitle} onChange={(e) => setF((p) => ({ ...p, jobTitle: e.target.value }))} placeholder="Role" className={inputCls} />
        <input value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className={inputCls} />
        <input value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className={inputCls} />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-400"><input type="checkbox" checked={f.isDecisionMaker} onChange={(e) => setF((p) => ({ ...p, isDecisionMaker: e.target.checked }))} /> Decision-maker</label>
      <button onClick={() => onSave(f)} disabled={pending || !f.name.trim()} className="text-xs px-2.5 py-1 rounded-md bg-blue-950 text-blue-300 border border-blue-900 hover:bg-blue-900 disabled:opacity-40">{pending ? "…" : "Add contact"}</button>
    </div>
  );
}

function EditPanel({ d, onSave, pending }: { d: ProspectDetail; onSave: (patch: Record<string, string>) => void; pending: boolean }) {
  const [f, setF] = useState({
    agencyName: d.agencyName, branch: d.branch ?? "", website: d.website ?? "", location: d.location ?? "",
    postcode: d.postcode ?? "", phone: d.phone ?? "", generalEmail: d.generalEmail ?? "", sizeNote: d.sizeNote ?? "", notes: d.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={f.agencyName} onChange={set("agencyName")} placeholder="Agency name" className={inputCls} />
        <input value={f.branch} onChange={set("branch")} placeholder="Branch" className={inputCls} />
        <input value={f.location} onChange={set("location")} placeholder="Location" className={inputCls} />
        <input value={f.postcode} onChange={set("postcode")} placeholder="Postcode" className={inputCls} />
        <input value={f.website} onChange={set("website")} placeholder="Website" className={inputCls} />
        <input value={f.phone} onChange={set("phone")} placeholder="Phone" className={inputCls} />
        <input value={f.generalEmail} onChange={set("generalEmail")} placeholder="General email" className={inputCls} />
        <input value={f.sizeNote} onChange={set("sizeNote")} placeholder="Size / listings" className={inputCls} />
      </div>
      <textarea value={f.notes} onChange={set("notes")} rows={2} placeholder="Notes" className={inputCls} />
      <button onClick={() => onSave(f)} disabled={pending || !f.agencyName.trim()} className="text-xs px-2.5 py-1 rounded-md bg-blue-950 text-blue-300 border border-blue-900 hover:bg-blue-900 disabled:opacity-40">{pending ? "…" : "Save"}</button>
    </div>
  );
}

function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
const QUICK_DAYS: [string, number][] = [["+2d", 2], ["+5d", 5], ["+1w", 7], ["+2w", 14]];

function CallPanel({ onSave, pending }: { onSave: (i: { outcome: string; notes?: string; nextFollowUpAt?: string; newStatus?: string }) => void; pending: boolean }) {
  const [outcome, setOutcome] = useState("spoke");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {CALL_OUTCOMES.map((o) => (
          <button key={o} onClick={() => setOutcome(o)} className={`text-[11px] px-2 py-0.5 rounded-md border ${outcome === o ? "bg-neutral-100 text-neutral-900 border-neutral-100" : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-neutral-200"}`}>{CALL_OUTCOME_LABEL[o]}</button>
        ))}
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)…" className={inputCls} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-neutral-500">Next follow-up</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-auto`} />
        {QUICK_DAYS.map(([lbl, n]) => <button key={lbl} onClick={() => setDate(isoInDays(n))} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">{lbl}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-neutral-500">Set status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="" className="bg-neutral-900">No change</option>
          {PROSPECT_STATUSES.map((s) => <option key={s} value={s} className="bg-neutral-900">{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <button onClick={() => onSave({ outcome, notes: notes.trim() || undefined, nextFollowUpAt: date || undefined, newStatus: status || undefined })} disabled={pending} className="text-xs px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 disabled:opacity-40">{pending ? "…" : "Log call"}</button>
    </div>
  );
}

function FollowUpPanel({ onSave, pending }: { onSave: (iso: string) => void; pending: boolean }) {
  const [date, setDate] = useState(isoInDays(5));
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-auto`} />
        {QUICK_DAYS.map(([lbl, n]) => <button key={lbl} onClick={() => setDate(isoInDays(n))} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200">{lbl}</button>)}
      </div>
      <button onClick={() => onSave(date)} disabled={pending || !date} className="text-xs px-2.5 py-1 rounded-md bg-blue-950 text-blue-300 border border-blue-900 hover:bg-blue-900 disabled:opacity-40">{pending ? "…" : "Schedule follow-up"}</button>
    </div>
  );
}

function LostPanel({ onSave, pending }: { onSave: (reason: string, revisit: string | null) => void; pending: boolean }) {
  const [reason, setReason] = useState("no_response");
  const [revisit, setRevisit] = useState("");
  return (
    <div className="bg-neutral-900 border border-red-950/60 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
          {LOST_REASONS.map((r) => <option key={r} value={r} className="bg-neutral-900">{LOST_REASON_LABEL[r]}</option>)}
        </select>
        <select value={revisit} onChange={(e) => setRevisit(e.target.value)} className={inputCls}>
          <option value="" className="bg-neutral-900">Never revisit</option>
          <option value={isoInDays(90)} className="bg-neutral-900">Revisit in 3 months</option>
          <option value={isoInDays(180)} className="bg-neutral-900">Revisit in 6 months</option>
        </select>
      </div>
      <button onClick={() => onSave(reason, revisit || null)} disabled={pending} className="text-xs px-2.5 py-1 rounded-md bg-red-950 text-red-400 border border-red-900 hover:bg-red-900 disabled:opacity-40">{pending ? "…" : "Mark lost"}</button>
    </div>
  );
}
