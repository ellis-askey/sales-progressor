"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProspectAction, addProspectContactAction, updateProspectContactAction, updateProspectAction, researchProspectAction } from "@/app/actions/prospects";
import { PROSPECT_SOURCES, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/command/prospect-labels";
import { ProspectDrawer } from "./ProspectDrawer";
import type { ProspectListRow } from "@/lib/command/prospects";
import { formatUKPhone } from "@/lib/utils/address";

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function overdue(d: Date | null): boolean {
  return !!d && new Date(d).getTime() <= Date.now();
}

const inputCls = "w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb]";

// Collapse a name to a comparison key so a brand's branches group even when
// they were typed in separately (no formal business link). Light on purpose:
// only lowercase + strip Ltd/Limited/LLP/PLC and punctuation, so we don't
// accidentally merge two genuinely different agencies.
function normBrand(name: string): string {
  return name.toLowerCase().replace(/\b(ltd|limited|llp|plc)\b/g, "").replace(/[^a-z0-9]/g, "");
}

type Group = { key: string; name: string; rows: ProspectListRow[] };

// One entry per business: rows linked to the same business group collapse
// together; unlinked rows fall back to matching on the (normalised) name.
function groupRows(rows: ProspectListRow[]): Group[] {
  const map = new Map<string, Group>();
  const order: string[] = [];
  for (const r of rows) {
    const key = r.groupId ?? `name:${normBrand(r.agencyName)}`;
    let g = map.get(key);
    if (!g) { g = { key, name: r.groupName ?? r.agencyName, rows: [] }; map.set(key, g); order.push(key); }
    if (r.groupName) g.name = r.groupName; // prefer the formal business name if there is one
    g.rows.push(r);
  }
  return order.map((k) => map.get(k)!);
}

export function ProspectsBoard({ rows }: { rows: ProspectListRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [quickId, setQuickId] = useState<string | null>(null);

  const groups = useMemo(() => groupRows(rows), [rows]);
  const multiBranch = groups.some((g) => g.rows.length > 1);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  const onQuick = (id: string) => setQuickId((prev) => (prev === id ? null : id));
  const onSaved = () => { setQuickId(null); router.refresh(); };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          {groups.length === rows.length ? `${rows.length} shown` : `${groups.length} businesses · ${rows.length} branches`}
        </p>
        <button onClick={() => setAdding((v) => !v)} className="text-xs px-3 py-1.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 transition-colors">
          {adding ? "Close" : "+ Add prospect"}
        </button>
      </div>

      {adding && <AddForm onDone={() => { setAdding(false); router.refresh(); }} />}

      <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="bg-neutral-950/60 text-left text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-2.5">Agency</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Last contact</th>
                <th className="px-4 py-2.5">Next follow-up</th>
                <th className="px-4 py-2.5">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">No prospects yet. Add one, or import a list.</td></tr>
              ) : (
                groups.map((g) => {
                  if (g.rows.length === 1) {
                    return <BranchRow key={g.rows[0].id} r={g.rows[0]} onOpen={setOpenId} indent={multiBranch} quickOpen={quickId === g.rows[0].id} onQuick={onQuick} onSaved={onSaved} />;
                  }
                  const isOpen = expanded.has(g.key);
                  return (
                    <BusinessRows
                      key={g.key}
                      group={g}
                      open={isOpen}
                      onToggle={() => toggle(g.key)}
                      onOpen={setOpenId}
                      quickId={quickId}
                      onQuick={onQuick}
                      onSaved={onSaved}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openId && <ProspectDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

const hasFillableGap = (r: ProspectListRow) => !r.hasContact || !r.hasEmail || !r.hasPhone || !r.hasWebsite;

// A single prospect row. `indent` aligns standalone rows with branch rows when
// the table also contains expandable businesses.
function BranchRow({ r, onOpen, indent, child, quickOpen, onQuick, onSaved }: {
  r: ProspectListRow; onOpen: (id: string) => void; indent?: boolean; child?: boolean;
  quickOpen: boolean; onQuick: (id: string) => void; onSaved: () => void;
}) {
  return (
    <>
      <tr onClick={() => onOpen(r.id)} className={`cursor-pointer hover:bg-neutral-800/40 transition-colors text-neutral-300 ${child ? "bg-neutral-950/30" : ""}`}>
        <td className="px-4 py-2.5">
          <div className={`text-xs text-neutral-100 font-medium ${indent || child ? "pl-6" : ""}`}>{child ? (r.location ?? r.agencyName) : r.agencyName}</div>
          {!child && r.branch && <div className="text-[11px] text-neutral-500">{r.branch}</div>}
          {child && r.branch && <div className="text-[11px] text-neutral-500 pl-6">{r.branch}</div>}
          <div className={`flex flex-wrap items-center gap-1.5 ${indent || child ? "pl-6" : ""}`}>
            <GapBadges r={r} />
            {hasFillableGap(r) && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuick(r.id); }}
                className="text-[10px] text-blue-300/90 hover:text-blue-200 mt-1"
              >
                {quickOpen ? "close" : "+ add data"}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-neutral-400">{r.location ?? "—"}</td>
        <td className="px-4 py-2.5">
          {r.primaryContactName ? (
            <><span className="text-xs text-neutral-200">{r.primaryContactName}</span>{r.primaryContactRole && <div className="text-[11px] text-neutral-500">{r.primaryContactRole}</div>}</>
          ) : <span className="text-xs text-neutral-600">—</span>}
        </td>
        <td className="px-4 py-2.5">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
        </td>
        <td className="px-4 py-2.5 text-xs text-neutral-400">{fmt(r.lastContactedAt)}</td>
        <td className={`px-4 py-2.5 text-xs ${overdue(r.nextFollowUpAt) ? "text-amber-400" : "text-neutral-400"}`}>{fmt(r.nextFollowUpAt)}</td>
        <td className="px-4 py-2.5 text-xs text-neutral-500">{SOURCE_LABEL[r.source]}</td>
      </tr>
      {quickOpen && <QuickFill r={r} onSaved={onSaved} onCancel={() => onQuick(r.id)} />}
    </>
  );
}

// Small coloured tag used for data-gap signals on a row.
function GapPill({ tone, children }: { tone: "amber" | "neutral" | "red"; children: React.ReactNode }) {
  const cls = {
    amber: "bg-amber-950/60 text-amber-300 border-amber-900",
    neutral: "bg-neutral-800 text-neutral-400 border-neutral-700",
    red: "bg-red-950 text-red-400 border-red-900",
  }[tone];
  return <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>{children}</span>;
}

// At-a-glance "what's missing / wrong" tags for a prospect row.
function GapBadges({ r }: { r: ProspectListRow }) {
  const badges: { label: string; tone: "amber" | "neutral" | "red" }[] = [];
  if (!r.hasContact) badges.push({ label: "no contact", tone: "amber" });
  else if (!r.hasEmail) badges.push({ label: "no email", tone: "amber" });
  if (!r.researched) badges.push({ label: "unresearched", tone: "neutral" });
  if (r.needsReview) badges.push({ label: "review", tone: "amber" });
  if (r.bounced) badges.push({ label: "bounced", tone: "red" });
  if (r.optedOut) badges.push({ label: "opted out", tone: "red" });
  if (badges.length === 0) return null;
  return <div className="flex flex-wrap gap-1 mt-1">{badges.map((b, i) => <GapPill key={i} tone={b.tone}>{b.label}</GapPill>)}</div>;
}

// A multi-branch business: one parent row that expands to its branch rows.
function BusinessRows({ group, open, onToggle, onOpen, quickId, onQuick, onSaved }: {
  group: Group; open: boolean; onToggle: () => void; onOpen: (id: string) => void;
  quickId: string | null; onQuick: (id: string) => void; onSaved: () => void;
}) {
  const n = group.rows.length;
  const noContact = group.rows.filter((r) => !r.hasContact).length;
  const noEmail = group.rows.filter((r) => r.hasContact && !r.hasEmail).length;
  const unresearched = group.rows.filter((r) => !r.researched).length;
  const gapBits = [
    noContact > 0 ? `${noContact} no contact` : null,
    noEmail > 0 ? `${noEmail} no email` : null,
    unresearched > 0 ? `${unresearched} unresearched` : null,
  ].filter(Boolean);
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-neutral-800/40 transition-colors text-neutral-300">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`text-neutral-500 text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
            <div>
              <div className="text-xs text-neutral-100 font-medium">{group.name}</div>
              <div className="text-[11px] text-neutral-500">{n} branches{gapBits.length > 0 && <span className="text-amber-400/80"> · {gapBits.join(" · ")}</span>}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-neutral-500" colSpan={6}>{open ? "" : "Click to see branches"}</td>
      </tr>
      {open && group.rows.map((r) => <BranchRow key={r.id} r={r} onOpen={onOpen} child quickOpen={quickId === r.id} onQuick={onQuick} onSaved={onSaved} />)}
    </>
  );
}

// Inline "add data" editor shown under a row. When the prospect has no contact,
// it adds a primary contact; otherwise it fills whichever of email / phone /
// website are missing, without opening the full file.
function QuickFill({ r, onSaved, onCancel }: { r: ProspectListRow; onSaved: () => void; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const noContact = !r.hasContact;

  function save() {
    setErr(null);
    startTransition(async () => {
      if (noContact) {
        if (!name.trim()) { setErr("A contact needs a name."); return; }
        const res = await addProspectContactAction(r.id, { name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined });
        if (res.ok) onSaved(); else setErr(res.error);
        return;
      }
      const tasks: Promise<{ ok: true } | { ok: false; error: string }>[] = [];
      const cp: { email?: string; phone?: string } = {};
      if (email.trim()) cp.email = email.trim().toLowerCase();
      if (phone.trim()) cp.phone = formatUKPhone(phone.trim());
      if (Object.keys(cp).length) {
        if (r.primaryContactId) tasks.push(updateProspectContactAction(r.primaryContactId, cp));
        else if (cp.email) tasks.push(updateProspectAction(r.id, { generalEmail: cp.email }));
      }
      if (website.trim()) tasks.push(updateProspectAction(r.id, { website: website.trim() }));
      if (!tasks.length) { setErr("Nothing to save."); return; }
      const results = await Promise.all(tasks);
      const bad = results.find((x) => !x.ok) as { ok: false; error: string } | undefined;
      if (bad) setErr(bad.error); else onSaved();
    });
  }

  return (
    <tr className="bg-neutral-950/70" onClick={(e) => e.stopPropagation()}>
      <td colSpan={7} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-2 pl-6">
          {noContact ? (
            <>
              <QField label="Contact name" value={name} onChange={setName} placeholder="Sarah Jones" autoFocus />
              <QField label="Email" value={email} onChange={setEmail} placeholder="sarah@agency.co.uk" />
              <QField label="Phone" value={phone} onChange={setPhone} />
            </>
          ) : (
            <>
              {!r.hasEmail && <QField label={r.primaryContactId ? "Contact email" : "General email"} value={email} onChange={setEmail} placeholder="name@agency.co.uk" autoFocus />}
              {!r.hasPhone && <QField label="Phone" value={phone} onChange={setPhone} />}
              {!r.hasWebsite && <QField label="Website" value={website} onChange={setWebsite} placeholder="agency.co.uk" />}
            </>
          )}
          <button onClick={save} disabled={pending} className="text-[11px] px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-900 hover:bg-emerald-900 disabled:opacity-40">{pending ? "Saving…" : "Save"}</button>
          <button onClick={onCancel} className="text-[11px] px-2 py-1 text-neutral-500 hover:text-neutral-300">Cancel</button>
          {err && <span className="text-[11px] text-red-400">{err}</span>}
        </div>
      </td>
    </tr>
  );
}

function QField({ label, value, onChange, placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] text-neutral-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="text-xs bg-[#0a0a0a] border border-[#262626] rounded px-2 py-1 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb] w-44" />
    </label>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [research, setResearch] = useState(false);
  const [f, setF] = useState({
    agencyName: "", source: "cold", branch: "", location: "", postcode: "", website: "", phone: "", generalEmail: "", notes: "",
    contactName: "", contactJobTitle: "", contactEmail: "", contactPhone: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createProspectAction(f);
      if (!res.ok) { setError(res.error); return; }
      if (research) {
        const rr = await researchProspectAction(res.id);
        if (!rr.ok) { setError(`Added, but research failed: ${rr.error}`); onDone(); return; }
      }
      onDone();
    });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Agency name *</span><input value={f.agencyName} onChange={set("agencyName")} className={inputCls} placeholder="Oakwood Estates" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Branch</span><input value={f.branch} onChange={set("branch")} className={inputCls} placeholder="Harlow" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Source</span>
          <select value={f.source} onChange={set("source")} className={inputCls}>{PROSPECT_SOURCES.map((s) => <option key={s} value={s} className="bg-neutral-900">{SOURCE_LABEL[s]}</option>)}</select>
        </label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Location</span><input value={f.location} onChange={set("location")} className={inputCls} placeholder="Harlow, Essex" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Postcode</span><input value={f.postcode} onChange={set("postcode")} className={inputCls} placeholder="CM20 1AB" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Website</span><input value={f.website} onChange={set("website")} className={inputCls} placeholder="oakwood.co.uk" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Phone</span><input value={f.phone} onChange={set("phone")} onBlur={(e) => { if (e.target.value.trim()) setF((p) => ({ ...p, phone: formatUKPhone(e.target.value) })); }} className={inputCls} /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">General email</span><input value={f.generalEmail} onChange={set("generalEmail")} onBlur={(e) => { if (e.target.value.trim()) setF((p) => ({ ...p, generalEmail: e.target.value.trim().toLowerCase() })); }} className={inputCls} /></label>
      </div>
      <p className="text-[11px] text-neutral-600 uppercase tracking-wider">First contact (optional)</p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Name</span><input value={f.contactName} onChange={set("contactName")} className={inputCls} placeholder="Sarah Jones" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Role</span><input value={f.contactJobTitle} onChange={set("contactJobTitle")} className={inputCls} placeholder="Director" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Email</span><input value={f.contactEmail} onChange={set("contactEmail")} onBlur={(e) => { if (e.target.value.trim()) setF((p) => ({ ...p, contactEmail: e.target.value.trim().toLowerCase() })); }} className={inputCls} /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Phone</span><input value={f.contactPhone} onChange={set("contactPhone")} onBlur={(e) => { if (e.target.value.trim()) setF((p) => ({ ...p, contactPhone: formatUKPhone(e.target.value) })); }} className={inputCls} /></label>
      </div>
      <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Notes / context</span><textarea value={f.notes} onChange={set("notes")} rows={2} className={inputCls} /></label>
      <label className="flex items-center gap-2 text-[11px] text-neutral-400">
        <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} />
        Research this one now (fills gaps from the web, uses AI credit and takes about a minute)
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={pending || !f.agencyName.trim()} className="text-xs px-3 py-1.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 transition-colors disabled:opacity-40">{pending ? (research ? "Adding + researching…" : "Adding…") : "Add prospect"}</button>
        <button onClick={onDone} className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-300">Cancel</button>
      </div>
    </div>
  );
}
