"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "@phosphor-icons/react/dist/ssr";
import { assignUserAction } from "@/app/actions/transactions";
import type { HubUnassignedFile } from "@/lib/services/hub";

type SPUser = { id: string; name: string };

function AssignInline({ transactionId, onAssigned }: { transactionId: string; onAssigned: () => void }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<SPUser[]>([]);
  const [selected, setSelected] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDropdown() {
    if (users.length === 0) {
      fetch("/api/agency/users")
        .then((r) => r.json())
        .then(setUsers)
        .catch(() => {});
    }
    setOpen(true);
  }

  function save() {
    if (!selected) return;
    startTransition(async () => {
      await assignUserAction(transactionId, selected);
      onAssigned();
    });
  }

  if (!open) {
    return (
      <button
        onClick={openDropdown}
        style={{
          fontSize: 11, fontWeight: 600,
          color: "var(--agent-coral-deep)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          flexShrink: 0,
        }}
      >
        Assign
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          fontSize: 11, padding: "3px 6px", borderRadius: 6,
          border: "0.5px solid var(--agent-border-default)",
          background: "var(--agent-surface-glass)",
          color: "var(--agent-text-primary)", maxWidth: 140,
        }}
      >
        <option value="">Select…</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={!selected || isPending}
        style={{
          fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
          background: "var(--agent-coral)", color: "white",
          border: "none", cursor: selected ? "pointer" : "default",
          opacity: !selected || isPending ? 0.5 : 1,
        }}
      >
        {isPending ? "…" : "Save"}
      </button>
      <button
        onClick={() => setOpen(false)}
        style={{ fontSize: 11, color: "var(--agent-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        Cancel
      </button>
    </div>
  );
}

export function UnassignedFilesView({ initialFiles }: { initialFiles: HubUnassignedFile[] }) {
  const [files, setFiles] = useState(initialFiles);

  if (files.length === 0) return null;

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div
      className="agent-glass-strong"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}
    >
      {/* Header */}
      <div className="agent-card-hdr" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <UserPlus size={15} color="var(--agent-text-muted)" />
          <div>
            <p className="agent-card-title-emphasis">Needs assigning</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
              Outsourced files without a progressor.
            </p>
          </div>
        </div>
      </div>

      {/* Rows */}
      {files.slice(0, 5).map((file, i) => (
        <div
          key={file.id}
          style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 20px 13px 17px",
            borderLeft: "3px solid var(--agent-coral)",
            background: "var(--agent-coral-bg-tint)",
            borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 500,
              color: "var(--agent-text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {file.propertyAddress}
            </p>
            {file.agencyName && (
              <p style={{
                margin: "2px 0 0", fontSize: 11,
                color: "var(--agent-text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {file.agencyName}
              </p>
            )}
          </div>
          <AssignInline transactionId={file.id} onAssigned={() => removeFile(file.id)} />
        </div>
      ))}
    </div>
  );
}
