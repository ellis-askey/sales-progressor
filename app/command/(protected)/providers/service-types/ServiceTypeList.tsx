"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateServiceType, deleteServiceType } from "@/app/actions/provider-service-types";
import type { ProviderKind } from "@prisma/client";
import { Trash2, Pencil, X, Check } from "lucide-react";

type Row = {
  id: string;
  kind: ProviderKind;
  label: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  firmCount: number;
  quoteRequestCount: number;
};

export function ServiceTypeList({ rows }: { rows: Row[] }) {
  return (
    <div className="border border-[#262626] rounded-md overflow-hidden">
      {rows.map((r) => (
        <RowView key={r.id} row={r} />
      ))}
    </div>
  );
}

function RowView({ row }: { row: Row }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(row.label);
  const [description, setDescription] = useState(row.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(row.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await updateServiceType(row.id, {
        kind: row.kind,
        label,
        description: description || null,
        sortOrder: parseInt(sortOrder, 10) || 0,
        active: row.active,
      });
      if (r.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const r = await updateServiceType(row.id, {
        kind: row.kind,
        label: row.label,
        description: row.description,
        sortOrder: row.sortOrder,
        active: !row.active,
      });
      if (r.ok) router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await deleteServiceType(row.id);
      if (r.ok) router.refresh();
      else {
        setError(r.error);
        setDeleteConfirm(false);
      }
    });
  }

  if (editing) {
    return (
      <div className="border-b border-[#1a1a1a] last:border-0 bg-[#111111] p-3 space-y-2">
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb]"
          />
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            min={0}
            max={999}
            className="bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb] font-mono"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[12px] text-[#d4d4d4] focus:outline-none focus:border-[#2563eb] resize-none"
          placeholder="Description (shown to clients)"
        />
        {error && <p className="text-[11px] text-[#fca5a5]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setLabel(row.label);
              setDescription(row.description ?? "");
              setSortOrder(String(row.sortOrder));
              setEditing(false);
              setError(null);
            }}
            className="px-2.5 py-1 rounded text-[11px] font-semibold text-[#a3a3a3] hover:text-[#fafafa] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending || !label.trim()}
            className="px-2.5 py-1 rounded text-[11px] font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: label.trim() && !pending ? "#2563eb" : "#404040" }}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#111111] transition-colors">
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-[13px] font-semibold ${row.active ? "text-[#fafafa]" : "text-[#525252] line-through"}`}>
              {row.label}
            </p>
            <span className="text-[10px] font-mono text-[#404040]">#{row.sortOrder}</span>
            {!row.active && (
              <span className="text-[10px] font-semibold text-[#737373] bg-[#1a1a1a] px-1.5 py-0.5 rounded uppercase tracking-wide">
                Inactive
              </span>
            )}
          </div>
          {row.description && (
            <p className="text-[11px] text-[#737373] leading-snug">{row.description}</p>
          )}
          <p className="text-[10px] text-[#525252] mt-1">
            {row.firmCount} firm{row.firmCount === 1 ? "" : "s"} opted in · {row.quoteRequestCount} quote{row.quoteRequestCount === 1 ? "" : "s"} ever
          </p>
          {error && <p className="text-[11px] text-[#fca5a5] mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleActive}
            disabled={pending}
            className={`p-1.5 rounded transition-colors disabled:opacity-40 ${row.active ? "text-[#86efac] hover:bg-[#0c2418]" : "text-[#525252] hover:bg-[#1a1a1a] hover:text-[#a3a3a3]"}`}
            title={row.active ? "Hide from clients" : "Show to clients"}
          >
            {row.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded text-[#737373] hover:bg-[#1a1a1a] hover:text-[#fafafa] transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {deleteConfirm ? (
            <>
              <button
                onClick={remove}
                disabled={pending}
                className="px-2 py-1 rounded text-[10px] font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition-colors disabled:opacity-40"
              >
                {pending ? "…" : "Confirm"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="p-1.5 rounded text-[#737373] hover:text-[#fafafa] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-1.5 rounded text-[#737373] hover:bg-[#2a1010] hover:text-[#fca5a5] transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
