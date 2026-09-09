"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProspectAction } from "@/app/actions/prospects";
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

  const groups = useMemo(() => groupRows(rows), [rows]);
  const multiBranch = groups.some((g) => g.rows.length > 1);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

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
                    return <BranchRow key={g.rows[0].id} r={g.rows[0]} onOpen={setOpenId} indent={multiBranch} />;
                  }
                  const isOpen = expanded.has(g.key);
                  return (
                    <BusinessRows
                      key={g.key}
                      group={g}
                      open={isOpen}
                      onToggle={() => toggle(g.key)}
                      onOpen={setOpenId}
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

// A single prospect row. `indent` aligns standalone rows with branch rows when
// the table also contains expandable businesses.
function BranchRow({ r, onOpen, indent, child }: { r: ProspectListRow; onOpen: (id: string) => void; indent?: boolean; child?: boolean }) {
  return (
    <tr onClick={() => onOpen(r.id)} className={`cursor-pointer hover:bg-neutral-800/40 transition-colors text-neutral-300 ${child ? "bg-neutral-950/30" : ""}`}>
      <td className="px-4 py-2.5">
        <div className={`text-xs text-neutral-100 font-medium ${indent || child ? "pl-6" : ""}`}>{child ? (r.location ?? r.agencyName) : r.agencyName}</div>
        {!child && r.branch && <div className="text-[11px] text-neutral-500">{r.branch}</div>}
        {child && r.branch && <div className="text-[11px] text-neutral-500 pl-6">{r.branch}</div>}
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
  );
}

// A multi-branch business: one parent row that expands to its branch rows.
function BusinessRows({ group, open, onToggle, onOpen }: { group: Group; open: boolean; onToggle: () => void; onOpen: (id: string) => void }) {
  const n = group.rows.length;
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-neutral-800/40 transition-colors text-neutral-300">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`text-neutral-500 text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
            <div>
              <div className="text-xs text-neutral-100 font-medium">{group.name}</div>
              <div className="text-[11px] text-neutral-500">{n} branches</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-neutral-500" colSpan={6}>{open ? "" : "Click to see branches"}</td>
      </tr>
      {open && group.rows.map((r) => <BranchRow key={r.id} r={r} onOpen={onOpen} child />)}
    </>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    agencyName: "", source: "cold", location: "", website: "", phone: "", generalEmail: "", notes: "",
    contactName: "", contactJobTitle: "", contactEmail: "", contactPhone: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createProspectAction(f);
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Agency name *</span><input value={f.agencyName} onChange={set("agencyName")} className={inputCls} placeholder="Oakwood Estates" /></label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Source</span>
          <select value={f.source} onChange={set("source")} className={inputCls}>{PROSPECT_SOURCES.map((s) => <option key={s} value={s} className="bg-neutral-900">{SOURCE_LABEL[s]}</option>)}</select>
        </label>
        <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Location</span><input value={f.location} onChange={set("location")} className={inputCls} placeholder="Harlow" /></label>
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
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={pending || !f.agencyName.trim()} className="text-xs px-3 py-1.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 transition-colors disabled:opacity-40">{pending ? "Adding…" : "Add prospect"}</button>
        <button onClick={onDone} className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-300">Cancel</button>
      </div>
    </div>
  );
}
