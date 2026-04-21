"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; name: string };

type Props = {
  transactionId: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
};

export function AssignControl({ transactionId, currentAssigneeId, currentAssigneeName }: Props) {
  const router = useRouter();
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

  async function save() {
    setSaving(true);
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedUserId: selected || null }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="text-sm border border-[#e4e9f0] rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button onClick={save} disabled={saving}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium">
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)}
          className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-700">
        {currentAssigneeName ?? <span className="text-gray-300 italic">Unassigned</span>}
      </span>
      <button onClick={() => setEditing(true)}
        className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
        {currentAssigneeName ? "Change" : "Assign"}
      </button>
    </div>
  );
}
