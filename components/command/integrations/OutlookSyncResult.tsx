"use client";

// components/command/integrations/OutlookSyncResult.tsx
//
// Renders the result of a mailbox sync: the freshly logged emails, plus
// collapsible "already logged" and "unmatched" groups. An unmatched email can
// be hand-placed onto a file (via its suggested candidates or a file search);
// on success the row dissolves out of "unmatched" and appears in "logged".

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, Search, Check } from "lucide-react";
import type { SyncSummary, LoggedItem, UnmatchedItem, FileRef } from "@/lib/integrations/outlook/sync";

function fileHref(transactionId: string) {
  return `/agent/transactions/${transactionId}`;
}

export function OutlookSyncResult({
  connectionId,
  summary,
}: {
  connectionId: string;
  summary: SyncSummary;
}) {
  const [logged, setLogged] = useState<LoggedItem[]>(summary.logged);
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>(summary.unmatched);
  const [openAlready, setOpenAlready] = useState(false);
  const [openUnmatched, setOpenUnmatched] = useState(false);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // Re-initialise when a new sync arrives (summary is a fresh object each time).
  useEffect(() => {
    setLogged(summary.logged);
    setUnmatched(summary.unmatched);
    setAddingId(null);
    setRemovingIds(new Set());
    setRowError({});
  }, [summary]);

  async function addToFile(item: UnmatchedItem, target: FileRef) {
    setAddingId(item.messageId);
    setRowError((e) => ({ ...e, [item.messageId]: "" }));
    try {
      const res = await fetch("/api/integrations/outlook/log-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          messageId: item.messageId,
          transactionId: target.transactionId,
        }),
      });
      if (!res.ok) {
        setRowError((e) => ({ ...e, [item.messageId]: "Couldn't add that one. Try again." }));
        setAddingId(null);
        return;
      }
      const data = (await res.json()) as { item: LoggedItem };
      // Dissolve the row, then move it into the logged group.
      setRemovingIds((s) => new Set(s).add(item.messageId));
      setAddingId(null);
      window.setTimeout(() => {
        setUnmatched((list) => list.filter((u) => u.messageId !== item.messageId));
        setLogged((list) => [{ ...data.item }, ...list]);
        setRemovingIds((s) => {
          const n = new Set(s);
          n.delete(item.messageId);
          return n;
        });
      }, 320);
    } catch {
      setRowError((e) => ({ ...e, [item.messageId]: "Couldn't add that one. Try again." }));
      setAddingId(null);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[12px] text-neutral-400">
        Checked {summary.checked} across {summary.folders} folder
        {summary.folders === 1 ? "" : "s"} · logged {logged.length} new ·{" "}
        {summary.alreadyLogged.length} already logged · {unmatched.length} unmatched
      </p>
      {summary.folderNames.length > 0 && (
        <p className="text-[11px] text-neutral-600">Folders: {summary.folderNames.join(", ")}</p>
      )}

      {/* Logged */}
      {logged.length > 0 && (
        <ul className="space-y-1">
          {logged.map((it, i) => (
            <li key={`${it.messageId}-${i}`} className="text-[12px] leading-snug">
              <a
                href={fileHref(it.transactionId)}
                className="text-blue-400 hover:text-blue-300 hover:underline"
              >
                {it.address || "View file"}
              </a>
              <span className="text-neutral-500"> · {it.subject}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Already logged (collapsible) */}
      {summary.alreadyLogged.length > 0 && (
        <Group
          label={`Already logged (${summary.alreadyLogged.length})`}
          open={openAlready}
          onToggle={() => setOpenAlready((o) => !o)}
        >
          <ul className="space-y-1 pt-1">
            {summary.alreadyLogged.map((it, i) => (
              <li key={`${it.messageId}-${i}`} className="text-[12px] leading-snug">
                <a
                  href={fileHref(it.transactionId)}
                  className="text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {it.address || "View file"}
                </a>
                <span className="text-neutral-500"> · {it.subject}</span>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {/* Unmatched (collapsible, actionable) */}
      {unmatched.length > 0 && (
        <Group
          label={`Unmatched (${unmatched.length})`}
          open={openUnmatched}
          onToggle={() => setOpenUnmatched((o) => !o)}
        >
          <ul className="space-y-1.5 pt-1.5">
            {unmatched.map((item) => (
              <UnmatchedRow
                key={item.messageId}
                item={item}
                busy={addingId === item.messageId}
                removing={removingIds.has(item.messageId)}
                error={rowError[item.messageId]}
                onPick={(target) => addToFile(item, target)}
              />
            ))}
          </ul>
        </Group>
      )}
    </div>
  );
}

function Group({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-medium text-neutral-300 hover:text-neutral-100"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {label}
      </button>
      {open && <div className="px-3 pb-2.5">{children}</div>}
    </div>
  );
}

function UnmatchedRow({
  item,
  busy,
  removing,
  error,
  onPick,
}: {
  item: UnmatchedItem;
  busy: boolean;
  removing: boolean;
  error?: string;
  onPick: (target: FileRef) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileRef[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!searchOpen) return;
    if (timer.current) window.clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/integrations/outlook/file-search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data = (await res.json()) as { results: FileRef[] };
          setResults(data.results);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query, searchOpen]);

  const when = new Date(item.receivedDateTime);
  const dateLabel = isNaN(when.getTime())
    ? ""
    : when.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <li
      style={{
        transition: "opacity 300ms ease, max-height 300ms ease, margin 300ms ease",
        opacity: removing ? 0 : 1,
        maxHeight: removing ? 0 : 400,
        overflow: "hidden",
      }}
      className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-2.5"
    >
      <p className="truncate text-[12.5px] text-neutral-200">{item.subject}</p>
      <p className="truncate text-[11px] text-neutral-500">
        {item.fromName ? `${item.fromName} · ` : ""}
        {item.from || "unknown sender"}
        {item.folder ? ` · ${item.folder}` : ""}
        {dateLabel ? ` · ${dateLabel}` : ""}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Adding…
          </span>
        ) : (
          <>
            {item.candidates.map((c) => (
              <button
                key={c.transactionId}
                onClick={() => onPick(c)}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-900/60 bg-emerald-950/40 px-2 py-1 text-[11.5px] font-medium text-emerald-300 hover:bg-emerald-900/40"
              >
                <Check className="h-3 w-3" />
                Add to {c.address || "file"}
              </button>
            ))}
            <button
              onClick={() => setSearchOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11.5px] font-medium text-neutral-300 hover:bg-neutral-700"
            >
              <Search className="h-3 w-3" />
              Find file
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}

      {searchOpen && !busy && (
        <div className="mt-1.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files by address…"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          {searching && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching…
            </p>
          )}
          {results.length > 0 && (
            <ul className="mt-1 divide-y divide-neutral-800 rounded-md border border-neutral-800">
              {results.map((r) => (
                <li key={r.transactionId}>
                  <button
                    onClick={() => onPick(r)}
                    className="block w-full truncate px-2.5 py-1.5 text-left text-[12px] text-neutral-200 hover:bg-neutral-800"
                  >
                    {r.address}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
