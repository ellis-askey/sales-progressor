"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMemoryAction,
  editMemoryAction,
  setMemoryStatusAction,
  deleteMemoryAction,
} from "@/app/actions/brand";
import {
  MEMORY_KINDS,
  CLAIM_CLASSES,
  memoryKindLabel,
  claimClass as resolveClaim,
  type ClaimTone,
} from "@/lib/command/content/brand-taxonomy";

// Brand memory manager (docs/active/content-brand/SPEC.md, Phase 1.2). Add,
// classify, approve and prune the structured facts about Ellis's public
// persona. The claim class keeps facts, opinions, inferences and unverified
// statements honestly separated so nothing invented ever reads as fact.

type Entry = {
  id: string;
  createdAt: string;
  kind: string;
  body: string;
  claimClass: string;
  status: string;
  source: string;
};

type StatusFilter = "active" | "suggested" | "rejected";

const TONE_CLASS: Record<ClaimTone, string> = {
  good: "border-emerald-900/60 bg-emerald-950/30 text-emerald-300",
  info: "border-blue-900/60 bg-blue-950/30 text-blue-300",
  watch: "border-amber-900/60 bg-amber-950/30 text-amber-300",
  bad: "border-red-900/60 bg-red-950/30 text-red-300",
};

function ClaimBadge({ id }: { id: string }) {
  const { label, tone } = resolveClaim(id);
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TONE_CLASS[tone]}`}>{label}</span>;
}

export function BrandMemoryManager({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [status, setStatus] = useState<StatusFilter>("active");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<string>("opinion");
  const [claim, setClaim] = useState<string>("ellis_opinion");

  const counts = useMemo(() => {
    let active = 0, suggested = 0, rejected = 0;
    for (const e of entries) {
      if (e.status === "rejected") rejected++;
      else { active++; if (e.status === "suggested") suggested++; }
    }
    return { active, suggested, rejected };
  }, [entries]);

  const visible = useMemo(() => {
    return entries.filter((e) => {
      const statusOk =
        status === "rejected" ? e.status === "rejected"
        : status === "suggested" ? e.status === "suggested"
        : e.status !== "rejected";
      const kindOk = kindFilter === "all" || e.kind === kindFilter;
      return statusOk && kindOk;
    });
  }, [entries, status, kindFilter]);

  function run(action: (fd: FormData) => Promise<{ ok: boolean }>, fd: FormData, after?: () => void) {
    startTransition(async () => {
      const res = await action(fd);
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  function add() {
    const trimmed = body.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("body", trimmed);
    fd.set("kind", kind);
    fd.set("claimClass", claim);
    run(addMemoryAction, fd, () => setBody(""));
  }

  const statusTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: "active", label: "Active", count: counts.active },
    { key: "suggested", label: "To review", count: counts.suggested },
    { key: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="space-y-5">
      {/* Add */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add(); }}
          rows={2}
          placeholder="Something true about how you think, speak, or what you care about."
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-600 focus:border-blue-600/50 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onChange={setKind} title="Kind">
            {MEMORY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </Select>
          <Select value={claim} onChange={setClaim} title="Claim">
            {CLAIM_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <span className="hidden sm:block text-[11px] text-neutral-600">{MEMORY_KINDS.find((k) => k.id === kind)?.hint}</span>
          <button
            onClick={add}
            disabled={pending || !body.trim()}
            className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            Add to memory
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {statusTabs.map((t) => {
          const on = t.key === status;
          return (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                on ? "bg-blue-600/20 text-blue-300 border-blue-600/40" : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
              }`}
            >
              {t.label} <span className="tabular-nums text-neutral-500">{t.count}</span>
            </button>
          );
        })}
        <span className="ml-auto">
          <Select value={kindFilter} onChange={setKindFilter} title="Filter by kind">
            <option value="all">All kinds</option>
            {MEMORY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </Select>
        </span>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-10 text-center">
          <p className="text-sm text-neutral-400">
            {status === "suggested" ? "Nothing waiting for review." : status === "rejected" ? "Nothing rejected." : "No memory yet."}
          </p>
          {status === "active" && kindFilter === "all" && (
            <p className="mt-1 text-[12px] text-neutral-600">Add the opinions, phrases and expertise that make a post recognisably yours.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((e) => (
            <MemoryCard
              key={e.id}
              e={e}
              pending={pending}
              editing={editingId === e.id}
              onEdit={() => setEditingId(e.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(nb, nk, nc) => {
                const fd = new FormData();
                fd.set("id", e.id);
                fd.set("body", nb);
                fd.set("kind", nk);
                fd.set("claimClass", nc);
                run(editMemoryAction, fd, () => setEditingId(null));
              }}
              onStatus={(s) => {
                const fd = new FormData();
                fd.set("id", e.id);
                fd.set("status", s);
                run(setMemoryStatusAction, fd);
              }}
              onDelete={() => {
                if (!window.confirm("Remove this from memory for good?")) return;
                const fd = new FormData();
                fd.set("id", e.id);
                run(deleteMemoryAction, fd);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryCard({
  e, pending, editing, onEdit, onCancelEdit, onSaveEdit, onStatus, onDelete,
}: {
  e: Entry;
  pending: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (body: string, kind: string, claim: string) => void;
  onStatus: (status: "approved" | "suggested" | "rejected") => void;
  onDelete: () => void;
}) {
  const [eb, setEb] = useState(e.body);
  const [ek, setEk] = useState(e.kind);
  const [ec, setEc] = useState(e.claimClass);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-900/60 bg-neutral-900 p-4 space-y-3">
        <textarea
          value={eb}
          onChange={(ev) => setEb(ev.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-100 focus:border-blue-600/50 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ek} onChange={setEk} title="Kind">
            {MEMORY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </Select>
          <Select value={ec} onChange={setEc} title="Claim">
            {CLAIM_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <button onClick={onCancelEdit} className="ml-auto rounded-lg border border-neutral-700 px-3 py-2 text-[13px] text-neutral-400 transition-colors hover:text-neutral-200">Cancel</button>
          <button
            onClick={() => eb.trim() && onSaveEdit(eb.trim(), ek, ec)}
            disabled={pending || !eb.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  const suggested = e.status === "suggested";
  const rejected = e.status === "rejected";
  return (
    <div className={`group rounded-xl border p-4 ${suggested ? "border-amber-900/50 bg-amber-950/10" : "border-neutral-800 bg-neutral-900"} ${rejected ? "opacity-60" : ""}`}>
      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-100">{e.body}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[10.5px] text-neutral-300">{memoryKindLabel(e.kind)}</span>
        <ClaimBadge id={e.claimClass} />
        {suggested && <span className="rounded border border-amber-900/60 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">Suggested</span>}
        {e.source !== "manual" && <span className="text-[10.5px] text-neutral-600">via {e.source.replace("_", " ")}</span>}

        <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {suggested && <Action label="Approve" onClick={() => onStatus("approved")} disabled={pending} good />}
          {suggested && <Action label="Reject" onClick={() => onStatus("rejected")} disabled={pending} />}
          {rejected && <Action label="Restore" onClick={() => onStatus("approved")} disabled={pending} />}
          {!rejected && <Action label="Edit" onClick={onEdit} disabled={pending} />}
          <Action label="Remove" onClick={onDelete} disabled={pending} danger />
        </span>
      </div>
    </div>
  );
}

function Action({ label, onClick, disabled, danger, good }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; good?: boolean }) {
  const tone = danger
    ? "text-neutral-500 hover:bg-red-950/40 hover:text-red-300"
    : good
    ? "text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-200"
    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100";
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${tone}`}>
      {label}
    </button>
  );
}

function Select({ value, onChange, title, children }: { value: string; onChange: (v: string) => void; title: string; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
      className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-[12px] text-neutral-200 focus:border-blue-600/50 focus:outline-none"
    >
      {children}
    </select>
  );
}
