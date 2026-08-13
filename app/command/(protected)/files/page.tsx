import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  getFilesNeedingPhoto,
  countFilesNeedingPhoto,
  searchFiles,
  getFileOperational,
  dismissPhotoReminder,
  type FileOperational,
} from "@/lib/command/files";
import { PhotoUploadButton } from "@/components/command/files/PhotoUploadButton";

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
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
const AV_COLORS = ["#8b9dff", "#34d399", "#e0a44a", "#f0716f", "#c084fc", "#38bdf8"];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", active: "In progress", on_hold: "On hold", completed: "Completed", withdrawn: "Withdrawn",
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
  searchParams: Promise<{ q?: string; tx?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const [noPhoto, noPhotoCount, results] = await Promise.all([
    getFilesNeedingPhoto(),
    countFilesNeedingPhoto(),
    q ? searchFiles(q) : Promise.resolve([]),
  ]);

  const selectedId = sp.tx ?? (results.length === 1 ? results[0].id : undefined);
  const file: FileOperational | null = selectedId ? await getFileOperational(selectedId) : null;

  const qs = (txId: string) => `/command/files?${new URLSearchParams({ ...(q ? { q } : {}), tx: txId }).toString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Files</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Search any property to see who&rsquo;s working it, how engaged the client is, and whether it needs upkeep.
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
          placeholder="Search by address, e.g. Oakfield Road"
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
                    href={qs(r.id)}
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
        {/* operational panel */}
        <div>
          {file ? (
            <FilePanel file={file} />
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
              <p className="text-sm text-neutral-500">
                {q ? "Pick a property above to open its operational view." : "Search for a property to begin."}
              </p>
            </div>
          )}
        </div>

        {/* photos-to-add upkeep queue */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              Photos to add
              <span className="text-[11px] font-mono text-amber-400 bg-amber-950/50 border border-amber-900 rounded-full px-2 py-0.5">
                {noPhotoCount}
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 mt-1">
              Live files with no property photo. Add one, or dismiss the old ones you&rsquo;ll never fill.
            </p>
          </div>

          {noPhoto.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-500 text-center">Every live file has a photo. Nothing to do.</p>
          ) : (
            noPhoto.map((f) => (
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
          <div className="w-16 h-16 rounded-lg shrink-0 bg-neutral-950 border border-dashed border-neutral-700" />
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
