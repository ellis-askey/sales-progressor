"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getProspectDetailAction, changeProspectStatusAction, addProspectNoteAction,
  addProspectContactAction, setPrimaryContactAction, updateProspectAction,
} from "@/app/actions/prospects";
import { PROSPECT_STATUSES, STATUS_LABEL, STATUS_TONE, SOURCE_LABEL } from "@/lib/command/prospect-labels";
import type { ProspectDetail } from "@/lib/command/prospects";
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
  const [panel, setPanel] = useState<null | "note" | "contact" | "edit">(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setD(await getProspectDetailAction(id)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  function after() { setPanel(null); load(); router.refresh(); }

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
              <div className="bg-emerald-950/30 border border-emerald-900/70 rounded-lg px-4 py-2.5 text-xs text-emerald-300">
                Converted to <span className="font-medium">{d.convertedAgency.name}</span>{d.convertedAt ? ` · ${fmtDateTime(d.convertedAt)}` : ""}.
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <StatusChanger current={d.status} onChange={(s) => startTransition(async () => { await changeProspectStatusAction(id, s); after(); })} disabled={pending} />
              <ActionBtn onClick={() => setPanel(panel === "note" ? null : "note")} active={panel === "note"}>Add note</ActionBtn>
              <ActionBtn onClick={() => setPanel(panel === "contact" ? null : "contact")} active={panel === "contact"}>Add contact</ActionBtn>
              <ActionBtn onClick={() => setPanel(panel === "edit" ? null : "edit")} active={panel === "edit"}>Edit details</ActionBtn>
            </div>

            {panel === "note" && <NotePanel onSave={(text) => startTransition(async () => { await addProspectNoteAction(id, text); after(); })} pending={pending} />}
            {panel === "contact" && <ContactPanel onSave={(input) => startTransition(async () => { await addProspectContactAction(id, input); after(); })} pending={pending} />}
            {panel === "edit" && <EditPanel d={d} onSave={(patch) => startTransition(async () => { await updateProspectAction(id, patch); after(); })} pending={pending} />}

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
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-neutral-900 pb-1">
      <dt className="text-neutral-600 shrink-0">{label}</dt>
      <dd className="text-neutral-300 text-right truncate">{value ?? "—"}</dd>
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
