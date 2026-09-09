"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  captureThoughtAction,
  editThoughtAction,
  setThoughtStatusAction,
  deleteThoughtAction,
} from "@/app/actions/ellis-thoughts";

// Thoughts board (docs/active/content-brand/SPEC.md, Phase 1.1). Composer + a
// tabbed list of open / used / archived thoughts. Deliberately low-friction:
// type a line, save, move on. Nothing here is AI-generated; it is Ellis's own
// raw material for later.

type Thought = {
  id: string;
  createdAt: string | Date;
  body: string;
  topic: string | null;
  source: string;
  status: string;
};

type Board = {
  open: Thought[];
  used: Thought[];
  archived: Thought[];
  counts: { open: number; used: number; archived: number };
};

type Tab = "open" | "used" | "archived";

function relativeDate(d: string | Date): string {
  const then = new Date(d).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Written here",
  global_capture: "Quick capture",
  inbox_notme: "From the inbox",
};

export function ThoughtsPanel({ board }: { board: Board }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [pending, startTransition] = useTransition();

  // Composer state
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState("");

  // Which thought is being edited inline
  const [editingId, setEditingId] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<{ ok: boolean }>, fd: FormData, after?: () => void) {
    startTransition(async () => {
      const res = await action(fd);
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  function save() {
    const trimmed = body.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("body", trimmed);
    if (topic.trim()) fd.set("topic", topic.trim());
    run(captureThoughtAction, fd, () => {
      setBody("");
      setTopic("");
    });
  }

  const list = board[tab];
  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "open", label: "Open", count: board.counts.open },
    { key: "used", label: "Used", count: board.counts.used },
    { key: "archived", label: "Archived", count: board.counts.archived },
  ];

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
          }}
          rows={3}
          placeholder="What are you thinking? An opinion, a frustration, something you noticed. Doesn't need to be polished."
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (optional)"
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
          />
          <span className="hidden sm:block text-[11px] text-neutral-600">⌘↵ to save</span>
          <button
            onClick={save}
            disabled={pending || !body.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save thought
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                on
                  ? "bg-blue-600/20 text-blue-300 border-blue-600/40"
                  : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
              }`}
            >
              {t.label} <span className="tabular-nums text-neutral-500">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-10 text-center">
          <p className="text-sm text-neutral-400">
            {tab === "open" ? "No thoughts yet." : tab === "used" ? "Nothing used yet." : "Nothing archived."}
          </p>
          {tab === "open" && (
            <p className="mt-1 text-[12px] text-neutral-600">
              Save the next half-formed opinion you have. We&rsquo;ll bring it back when it&rsquo;s relevant.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((t) => (
            <ThoughtCard
              key={t.id}
              t={t}
              pending={pending}
              editing={editingId === t.id}
              onEdit={() => setEditingId(t.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(nb, nt) => {
                const fd = new FormData();
                fd.set("id", t.id);
                fd.set("body", nb);
                if (nt) fd.set("topic", nt);
                run(editThoughtAction, fd, () => setEditingId(null));
              }}
              onStatus={(status) => {
                const fd = new FormData();
                fd.set("id", t.id);
                fd.set("status", status);
                run(setThoughtStatusAction, fd);
              }}
              onDelete={() => {
                if (!window.confirm("Remove this thought for good?")) return;
                const fd = new FormData();
                fd.set("id", t.id);
                run(deleteThoughtAction, fd);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThoughtCard({
  t,
  pending,
  editing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onStatus,
  onDelete,
}: {
  t: Thought;
  pending: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (body: string, topic: string) => void;
  onStatus: (status: "open" | "used" | "archived") => void;
  onDelete: () => void;
}) {
  const [eb, setEb] = useState(t.body);
  const [et, setEt] = useState(t.topic ?? "");

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-900/60 bg-neutral-900 p-4 space-y-3">
        <textarea
          value={eb}
          onChange={(e) => setEb(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 focus:border-blue-600/50 focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <input
            value={et}
            onChange={(e) => setEt(e.target.value)}
            placeholder="Topic (optional)"
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
          />
          <button
            onClick={onCancelEdit}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-[13px] text-neutral-400 transition-colors hover:text-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={() => eb.trim() && onSaveEdit(eb.trim(), et.trim())}
            disabled={pending || !eb.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-100">{t.body}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-neutral-600">
        {t.topic && (
          <span className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[10.5px] text-neutral-300">
            {t.topic}
          </span>
        )}
        <span>{relativeDate(t.createdAt)}</span>
        <span className="text-neutral-700">·</span>
        <span>{SOURCE_LABEL[t.source] ?? t.source}</span>

        <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {t.status !== "open" ? (
            <Action label="Reopen" onClick={() => onStatus("open")} disabled={pending} />
          ) : (
            <>
              <Action label="Edit" onClick={onEdit} disabled={pending} />
              <Action label="Mark used" onClick={() => onStatus("used")} disabled={pending} />
              <Action label="Archive" onClick={() => onStatus("archived")} disabled={pending} />
            </>
          )}
          <Action label="Remove" onClick={onDelete} disabled={pending} danger />
        </span>
      </div>
    </div>
  );
}

function Action({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
        danger
          ? "text-neutral-500 hover:bg-red-950/40 hover:text-red-300"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
      }`}
    >
      {label}
    </button>
  );
}
