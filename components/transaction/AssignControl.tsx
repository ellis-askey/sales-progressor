"use client";

import { useState, useEffect, useTransition } from "react";
import { assignUserAction } from "@/app/actions/transactions";

type User = { id: string; name: string };

type Props = {
  transactionId: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
};

export function AssignControl({ transactionId, currentAssigneeId, currentAssigneeName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState(currentAssigneeId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing && users.length === 0) {
      fetch("/api/agency/users")
        .then((r) => r.json())
        .then(setUsers)
        .catch(() => {});
    }
  }, [editing, users.length]);

  function save() {
    setSaving(true);
    setEditing(false);
    startTransition(async () => {
      try {
        await assignUserAction(transactionId, selected || null);
      } finally {
        setSaving(false);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="glass-input text-sm px-2 py-1"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button onClick={save} disabled={saving || isPending}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium">
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)}
          className="text-xs text-slate-900/40 hover:text-slate-900/70">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-900/80">
        {currentAssigneeName ?? <span className="text-slate-900/30 italic">Unassigned</span>}
      </span>
      <button onClick={() => setEditing(true)}
        className="text-xs text-slate-900/30 hover:text-slate-900/60 transition-colors">
        {currentAssigneeName ? "Change" : "Assign"}
      </button>
    </div>
  );
}
