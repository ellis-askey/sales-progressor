import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  getPhotoQueue,
  searchFiles,
  getFileOperational,
  getFilesList,
  dismissPhotoReminder,
  type FileOperational,
  type FileListRow,
  type FileAttention,
} from "@/lib/command/files";
import { listStoredPhotoTxIds } from "@/lib/supabase-storage";
import { getBusinessNameMap } from "@/lib/command/businesses";
import { ManagedByTag } from "@/components/command/businesses/ManagedByTag";
import { PhotoUploadButton } from "@/components/command/files/PhotoUploadButton";
import InfoTip from "@/components/command/shared/InfoTip";
import { FilterSelect } from "@/components/command/shared/FilterSelect";

// ── formatters ───────────────────────────────────────────────────────────────
function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
function fmtRelative(d: Date | null): string {
  if (!d) return "never";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days >= 2) return `${days} days ago`;
  if (days === 1) return "yesterday";
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs >= 1) return `${hrs}h ago`;
  const mins = Math.floor(diff / 60_000);
  if (mins >= 1) return `${mins}m ago`;
  return "just now";
}
function fmtAge(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days >= 60) return `added ${Math.floor(days / 30)} months ago`;
  if (days >= 2) return `added ${days} days ago`;
  if (days === 1) return "added yesterday";
  return "added today";
}
function fmtExchange(days: number | null): string {
  if (days == null) return "—";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "today";
  return `${days}d`;
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
// Address → street on line one, town + postcode as subtext (like the app's file
// cards). Splits on the first comma; everything after is the subtext.
function splitAddress(a: string): { line1: string; rest: string } {
  const i = a.indexOf(",");
  if (i === -1) return { line1: a.trim(), rest: "" };
  return { line1: a.slice(0, i).trim(), rest: a.slice(i + 1).trim() };
}
const AV_COLORS = ["#8b9dff", "#34d399", "#e0a44a", "#f0716f", "#c084fc", "#38bdf8"];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", active: "Active", on_hold: "On hold", completed: "Completed", withdrawn: "Withdrawn",
};

// Colour dot per status, matching the statuses shown on the files themselves.
const STATUS_DOT: Record<string, string> = {
  draft: "bg-neutral-500", active: "bg-emerald-400", on_hold: "bg-amber-400", completed: "bg-blue-400", withdrawn: "bg-red-400",
};

function fmtExchangedDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

const ATTENTION_META: Record<FileAttention, { label: string; style: string }> = {
  no_photo:      { label: "No photo",      style: "text-amber-400 bg-amber-950/50 border-amber-900" },
  incomplete:    { label: "Incomplete",    style: "text-orange-400 bg-orange-950/50 border-orange-900" },
  exchange_soon: { label: "Exchange soon", style: "text-blue-400 bg-blue-950/50 border-blue-900" },
  idle:          { label: "No recent work", style: "text-neutral-400 bg-neutral-800/60 border-neutral-700" },
};

// ── dismiss action ───────────────────────────────────────────────────────────
async function dismissAction(formData: FormData) {
  "use server";
  const id = formData.get("txId");
  if (typeof id === "string" && id) {
    await dismissPhotoReminder(id);
    revalidatePath("/command/files");
  }
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tx?: string; status?: string; att?: string; managed?: string; created?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusFilter = sp.status === "active" || sp.status === "on_hold" ? sp.status : undefined;
  const attFilter = (["no_photo", "incomplete", "exchange_soon", "idle"] as const).find((a) => a === sp.att);
  // "Created this week" drill-down from the Command Centre Today page.
  const createdAfter = sp.created === "7d" ? new Date(Date.now() - 7 * 86_400_000) : undefined;
  // Service-tier scope. "self" = self-progressed (the agency runs it, so upkeep
  // matters most); "outsourced" = our team runs it. Scopes both the list and the
  // photo queue so the whole page narrows to the chosen tier.
  const managedKey = sp.managed === "self" || sp.managed === "outsourced" ? sp.managed : undefined;
  const serviceType = managedKey === "self" ? "self_managed" : managedKey === "outsourced" ? "outsourced" : undefined;

  // One storage listing serves the photo queue, search results and the list.
  const storedIds = await listStoredPhotoTxIds();

  const selectedId = sp.tx;
  const [photoQueue, results, file, list, businessNames] = await Promise.all([
    getPhotoQueue({ storedIds, serviceType }),
    q ? searchFiles(q, storedIds) : Promise.resolve([]),
    selectedId ? getFileOperational(selectedId) : Promise.resolve(null),
    !selectedId && !q ? getFilesList({ storedIds, status: statusFilter, attention: attFilter, serviceType, createdAfter }) : Promise.resolve(null),
    getBusinessNameMap(),
  ]);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...extra });
    return `/command/files?${p.toString()}`;
  };
  const listHref = (extra: Record<string, string>) => {
    const base: Record<string, string> = {};
    if (statusFilter) base.status = statusFilter;
    if (attFilter) base.att = attFilter;
    if (managedKey) base.managed = managedKey;
    if (sp.created === "7d") base.created = sp.created;
    const merged = { ...base, ...extra };
    for (const k of Object.keys(merged)) if (!merged[k]) delete merged[k];
    const p = new URLSearchParams(merged);
    return `/command/files${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Files</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Browse any live property to see who&rsquo;s working it, how engaged the client is, and whether it needs upkeep.
        </p>
      </div>

      {/* search */}
      <form method="GET" className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
        <svg className="w-4 h-4 text-neutral-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search any property by address (includes completed + withdrawn)"
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-600"
        />
        <button type="submit" className="text-xs font-medium text-blue-400 hover:text-blue-300">Search</button>
      </form>

      {/* search results */}
      {q && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
          </p>
          {results.length === 0 ? (
            <p className="text-sm text-neutral-500">No properties match that address.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {results.map((r) => {
                const active = r.id === selectedId;
                return (
                  <Link
                    key={r.id}
                    href={qs({ tx: r.id })}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      active
                        ? "bg-blue-950/40 border-blue-900 text-neutral-100"
                        : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                    }`}
                  >
                    <span className="flex-1 min-w-0 truncate font-medium">{r.address}</span>
                    <span className="text-neutral-500 text-xs truncate hidden sm:block">{r.agencyName}</span>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-500">{STATUS_LABEL[r.status] ?? r.status}</span>
                    {!r.hasPhoto && <span className="text-[10px] uppercase text-amber-400">no photo</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* main column */}
        <div>
          {file ? (
            <div className="space-y-3">
              <Link href={q ? qs({}) : listHref({})} className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200">
                ← {q ? "Back to results" : "All files"}
              </Link>
              <FilePanel file={file} />
            </div>
          ) : q ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
              <p className="text-sm text-neutral-500">Pick a property above to open its operational view.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {createdAfter && (
                <div className="flex items-center justify-between gap-3 bg-blue-950/30 border border-blue-900/60 rounded-lg px-4 py-2.5 text-xs">
                  <span className="text-blue-200">Showing files created in the last 7 days.</span>
                  <Link href={listHref({ created: "" })} className="text-blue-400 hover:text-blue-300 font-medium">Show all →</Link>
                </div>
              )}
              <BrowsableList list={list} statusFilter={statusFilter} attFilter={attFilter} managedKey={managedKey} listHref={listHref} businessNames={businessNames} />
            </div>
          )}
        </div>

        {/* photos-to-add upkeep queue */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              Photos to add
              <span className="text-[11px] font-mono text-amber-400 bg-amber-950/50 border border-amber-900 rounded-full px-2 py-0.5">
                {photoQueue.count}
              </span>
              <InfoTip label="How the photo queue works" align="right">
                Live files (in progress or on hold) with genuinely no photo. We now check storage too, so a file whose
                image is already uploaded is not flagged even if its record was out of sync. Demo and internal files are excluded.
              </InfoTip>
            </div>
            <p className="text-[11.5px] text-neutral-500 mt-1">
              Add one, or dismiss the old ones you&rsquo;ll never fill.
            </p>
          </div>

          {photoQueue.files.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-500 text-center">Every live file has a photo. Nothing to do.</p>
          ) : (
            photoQueue.files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 last:border-b-0">
                <div className="w-9 h-9 rounded-md shrink-0 bg-neutral-950 border border-dashed border-neutral-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 5h16v14H4z" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4 4 3 3-2 4 3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-neutral-100 truncate">{f.address}</div>
                  <div className="text-[11px] text-neutral-500">{f.agencyName} · {fmtAge(f.createdAt)}</div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  <PhotoUploadButton transactionId={f.id} />
                  <form action={dismissAction}>
                    <input type="hidden" name="txId" value={f.id} />
                    <button type="submit" className="text-[11px] text-neutral-500 hover:text-neutral-300">Dismiss</button>
                  </form>
                </div>
              </div>
            ))
          )}
          <p className="px-4 py-3 text-[11.5px] text-neutral-600">
            Dismissed files drop off for good. You can still add a photo later from the file itself.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── browsable live-files list ─────────────────────────────────────────────────
function BrowsableList({
  list,
  statusFilter,
  attFilter,
  managedKey,
  listHref,
  businessNames,
}: {
  list: { rows: FileListRow[]; total: number } | null;
  statusFilter?: "active" | "on_hold";
  attFilter?: FileAttention;
  managedKey?: "self" | "outsourced";
  listHref: (extra: Record<string, string>) => string;
  businessNames: Map<string, string>;
}) {
  const rows = list?.rows ?? [];
  const total = list?.total ?? 0;

  const managedChips: Array<{ v: string; label: string }> = [
    { v: "", label: "All files" },
    { v: "self", label: "Self-progressed" },
    { v: "outsourced", label: "Outsourced" },
  ];
  const statusChips: Array<{ v: string; label: string }> = [
    { v: "", label: "All live" },
    { v: "active", label: "Active" },
    { v: "on_hold", label: "On hold" },
  ];
  const attChips: Array<{ v: string; label: string }> = [
    { v: "", label: "All" },
    { v: "no_photo", label: "Needs photo" },
    { v: "incomplete", label: "Incomplete" },
    { v: "exchange_soon", label: "Exchange soon" },
    { v: "idle", label: "No recent work" },
  ];

  return (
    <div className="space-y-3">
      {/* filters — compact dropdowns on one line instead of three pill rows */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterSelect
          label="Managed by"
          current={managedKey ?? ""}
          options={managedChips.map((c) => ({ value: c.v, label: c.label, href: listHref({ managed: c.v }) }))}
        />
        <FilterSelect
          label="Status"
          current={statusFilter ?? ""}
          options={statusChips.map((c) => ({ value: c.v, label: c.label, href: listHref({ status: c.v }) }))}
        />
        <FilterSelect
          label="Attention"
          current={attFilter ?? ""}
          options={attChips.map((c) => ({ value: c.v, label: c.label, href: listHref({ att: c.v }) }))}
        />
      </div>

      <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
        <table className="w-full border-collapse text-[13px] min-w-[720px]">
          <thead>
            <tr className="bg-neutral-950/60">
              {["Property", "Agency", "Status", "Last worked", "Team time", "Exchange", "Attention"].map((h, i) => (
                <th key={h} className={`text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold px-3.5 py-2.5 border-b border-neutral-800 whitespace-nowrap ${i >= 4 && i <= 5 ? "text-right" : "text-left"} ${h === "Property" ? "w-[38%]" : h === "Agency" ? "w-[15%]" : ""}`}>
                  <span className="inline-flex items-center gap-1">
                    {h}
                    {h === "Team time" && <InfoTip label="What Team time means">Measured engaged time from completed work sessions, plus weighted time for calls, emails and WhatsApp logged on the file.</InfoTip>}
                    {h === "Last worked" && <InfoTip label="What Last worked means">When anyone on the team last had this file open.</InfoTip>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">No live files match this filter.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/30 transition-colors">
                  <td className="px-3.5 py-2.5">
                    <Link href={`/command/files?tx=${r.id}`} className="group flex items-center gap-3 min-w-0">
                      {r.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photoUrl} alt="" className="w-9 h-9 rounded-md object-cover shrink-0 border border-neutral-800" />
                      ) : (
                        <span className="w-9 h-9 rounded-md shrink-0 border border-neutral-800 bg-neutral-950 flex items-center justify-center text-neutral-700" aria-hidden>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-medium text-neutral-100 group-hover:text-blue-300 transition-colors truncate">{splitAddress(r.address).line1}</span>
                        {splitAddress(r.address).rest && (
                          <span className="block text-[11.5px] text-neutral-500 truncate">{splitAddress(r.address).rest}</span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3.5 py-2.5 text-neutral-400">
                    <span className="block max-w-[160px] truncate" title={r.agencyName}>{r.agencyName}</span>
                    {r.progressionBusinessId && businessNames.get(r.progressionBusinessId) && (
                      <span className="mt-1 block"><ManagedByTag businessName={businessNames.get(r.progressionBusinessId)!} /></span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-300">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[r.status] ?? "bg-neutral-500"}`} aria-hidden />
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-neutral-400 whitespace-nowrap">{fmtRelative(r.lastTeamActivityAt)}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{fmtDuration(r.teamSeconds)}</td>
                  {r.exchangedAt ? (
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap text-emerald-400">
                      {/* Full date on tablet/desktop, just "Exchanged" on mobile */}
                      <span className="sm:hidden">Exchanged</span>
                      <span className="hidden sm:inline">Exchanged · {fmtExchangedDate(r.exchangedAt)}</span>
                    </td>
                  ) : (
                    <td className={`px-3.5 py-2.5 text-right tabular-nums ${r.daysToExchange != null && r.daysToExchange < 0 ? "text-red-400" : r.daysToExchange != null && r.daysToExchange <= 14 ? "text-amber-400" : "text-neutral-300"}`}>{fmtExchange(r.daysToExchange)}</td>
                  )}
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {r.attention.map((a) => (
                        <span
                          key={a}
                          title={a === "incomplete" ? r.incompleteReasons.join(" · ") : undefined}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ATTENTION_META[a].style}`}
                        >
                          {a === "incomplete" && r.incompleteReasons.length > 0
                            ? `Incomplete: ${r.incompleteReasons[0]}${r.incompleteReasons.length > 1 ? ` +${r.incompleteReasons.length - 1}` : ""}`
                            : ATTENTION_META[a].label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > rows.length && (
        <p className="text-[11.5px] text-neutral-600">Showing {rows.length} of {total} live files. Narrow with a filter or search for a specific address.</p>
      )}
    </div>
  );
}

// ── operational panel ────────────────────────────────────────────────────────
function FilePanel({ file }: { file: FileOperational }) {
  const maxSeconds = Math.max(1, ...file.team.members.map((m) => m.seconds));
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* header */}
      <div className="flex gap-4 p-4 border-b border-neutral-800">
        {file.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
        ) : (
          // Command Centre is always dark → point at the dark placeholder directly.
          <div
            className="w-16 h-16 rounded-lg shrink-0 border border-neutral-800 bg-cover bg-center"
            style={{ backgroundImage: "url(/property-photo-fallback-dark.webp)" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-neutral-100">{file.address}</div>
          <div className="text-[12.5px] text-neutral-400 mt-0.5">{file.agencyName}</div>
          <div className="flex gap-1.5 mt-2">
            <span className="text-[10px] font-mono uppercase tracking-wide text-blue-400 bg-blue-950/50 border border-blue-900 rounded px-1.5 py-0.5">
              {STATUS_LABEL[file.status] ?? file.status}
            </span>
            {file.hasPhoto ? (
              <span className="text-[10px] font-mono uppercase tracking-wide text-emerald-400 bg-emerald-950/50 border border-emerald-900 rounded px-1.5 py-0.5">✓ Photo</span>
            ) : (
              <span className="text-[10px] font-mono uppercase tracking-wide text-amber-400 bg-amber-950/50 border border-amber-900 rounded px-1.5 py-0.5">No photo</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!file.hasPhoto && <PhotoUploadButton transactionId={file.id} />}
          <Link
            href={`/transactions/${file.id}`}
            className="text-xs text-blue-400 border border-blue-900 bg-blue-950/40 hover:bg-blue-950/70 px-2.5 py-1.5 rounded-lg whitespace-nowrap"
          >
            Open file →
          </Link>
        </div>
      </div>

      {/* team time */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between text-[10.5px] font-mono uppercase tracking-wider text-neutral-500">
          <span>Team time on this file</span>
          <span>last active {fmtRelative(file.team.lastActiveAt)}</span>
        </div>
        {file.team.members.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-2">No time recorded on this file yet.</p>
        ) : (
          <>
            <div className="text-[23px] font-semibold tracking-tight mt-2 tabular-nums text-neutral-100">
              {fmtDuration(file.team.totalSeconds)} <span className="text-[13px] text-neutral-400 font-medium">engaged</span>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {file.team.members.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[13px]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-neutral-950" style={{ background: avColor(m.name) }}>
                      {initials(m.name)}
                    </span>
                    <span className="truncate">
                      {m.name} <span className="text-neutral-500 text-[11.5px]">{m.internal ? "internal" : "agent"}</span>
                    </span>
                  </div>
                  <span className="flex-1 h-[5px] rounded bg-neutral-800 overflow-hidden min-w-[40px]">
                    <i className="block h-full rounded" style={{ width: `${(m.seconds / maxSeconds) * 100}%`, background: avColor(m.name) }} />
                  </span>
                  <span className="tabular-nums text-neutral-100 font-semibold min-w-[52px] text-right">{fmtDuration(m.seconds)}</span>
                </div>
              ))}
              {file.team.commsSeconds > 0 && (
                <div className="flex items-center gap-2.5 text-[13px] pt-2 mt-0.5 border-t border-neutral-800">
                  <span className="flex items-center gap-2 min-w-0 flex-1 text-neutral-300">
                    <span className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[11px] bg-neutral-800 text-neutral-300">✉</span>
                    <span className="truncate">Communications <span className="text-neutral-500 text-[11.5px]">calls · email · WhatsApp</span></span>
                  </span>
                  <span className="tabular-nums text-neutral-100 font-semibold min-w-[52px] text-right">{fmtDuration(file.team.commsSeconds)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* client engagement */}
      <div className="p-4">
        <div className="text-[10.5px] font-mono uppercase tracking-wider text-neutral-500">Client engagement · portal</div>
        {file.clients.length === 0 ? (
          <p className="text-sm text-neutral-500 mt-2">No portal clients on this file.</p>
        ) : (
          <div className="flex flex-col gap-3 mt-3">
            {file.clients.map((c, i) => (
              <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-neutral-100">
                    {c.name} <span className="text-neutral-500 font-normal text-[11.5px]">· {c.role === "vendor" ? "seller" : "buyer"}</span>
                  </div>
                  {c.quiet && (
                    <span className="text-[10px] font-mono uppercase tracking-wide text-amber-400 bg-amber-950/50 border border-amber-900 rounded px-1.5 py-0.5">Gone quiet</span>
                  )}
                </div>
                <div className="text-[13px] tabular-nums mt-2 text-neutral-100">
                  <b className="text-[18px] font-semibold">{c.measuredSessions > 0 ? fmtDuration(c.seconds) : "—"}</b>
                  <span className="text-neutral-400"> &nbsp;over {c.visitDays} visit{c.visitDays !== 1 ? "s" : ""}</span>
                </div>
                <div className="text-[11.5px] text-neutral-500 mt-0.5">
                  {c.lastVisit ? `Last on the portal ${fmtRelative(c.lastVisit)}` : "Hasn't opened the portal yet"}
                </div>
              </div>
            ))}
            <div className="flex gap-2 items-start bg-neutral-950 border border-dashed border-neutral-800 rounded-lg px-3 py-2 text-[11px] text-neutral-500">
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
              </svg>
              <span>Portal minutes measure from when tracking went live. Older visits count as visits, not minutes, so the minute totals fill in from here.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
