"use client";
// components/admin/AgentFeeManager.tsx
// Manage clientType and legacyFee per agent

import { useState, useTransition } from "react";
import type { ClientType, UserRole } from "@prisma/client";
import { saveAgentFeeSettingsAction } from "@/app/actions/admin";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clientType: ClientType;
  legacyFee: number | null;
};

export function AgentFeeManager({ users }: { users: User[] }) {
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { clientType: ClientType; legacyFee: string }>>({});

  function getEdit(user: User) {
    return edits[user.id] ?? {
      clientType: user.clientType,
      legacyFee: user.legacyFee ? String(user.legacyFee / 100) : "",
    };
  }

  function updateEdit(userId: string, field: string, value: string) {
    setEdits((prev) => ({
      ...prev,
      [userId]: { ...getEdit(users.find((u) => u.id === userId)!), [field]: value },
    }));
  }

  function save(user: User) {
    const edit = getEdit(user);
    setSaving(user.id);
    startTransition(async () => {
      try {
        await saveAgentFeeSettingsAction({ userId: user.id, clientType: edit.clientType, legacyFee: edit.legacyFee });
      } finally {
        setSaving(null);
      }
    });
  }

  const agents = users.filter((u) => u.role !== "viewer");

  return (
    <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
      {/* Header */}
      <div className="grid grid-cols-4 px-5 py-3 bg-white/10 border-b border-white/20 text-xs font-medium text-slate-900/40 uppercase tracking-wide">
        <span>Agent</span>
        <span>Fee type</span>
        <span>Fixed fee (if legacy)</span>
        <span>Standard fee</span>
      </div>

      {agents.map((user) => {
        const edit = getEdit(user);
        const isLegacy = edit.clientType === "legacy";

        return (
          <div key={user.id}
               className="grid grid-cols-4 items-center px-5 py-4 border-b border-white/15 last:border-0 gap-4">
            {/* Name */}
            <div>
              <p className="text-sm font-medium text-slate-900/90">{user.name}</p>
              <p className="text-xs text-slate-900/40">{user.role.replace("_", " ")}</p>
            </div>

            {/* Client type toggle */}
            <div className="flex items-center gap-1 glass-subtle p-1 w-fit">
              {(["standard", "legacy"] as ClientType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => updateEdit(user.id, "clientType", t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                    edit.clientType === t
                      ? "bg-white/60 text-slate-900/90 shadow-sm"
                      : "text-slate-900/50 hover:text-slate-900/70"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Legacy fee input */}
            <div>
              {isLegacy ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-slate-900/40">£</span>
                  <input
                    type="number"
                    value={edit.legacyFee}
                    onChange={(e) => updateEdit(user.id, "legacyFee", e.target.value)}
                    placeholder="220"
                    className="glass-input w-20 px-2 py-1.5 text-sm"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-900/30 italic">N/A</span>
              )}
            </div>

            {/* Standard fee reference */}
            <div className="flex items-center justify-between">
              {!isLegacy ? (
                <div className="text-xs text-slate-900/50 space-y-0.5">
                  <p>Up to £349,999 → £250</p>
                  <p>£350k–£499k → £300</p>
                  <p>£500k+ → £350</p>
                </div>
              ) : (
                <span className="text-xs text-slate-900/30 italic">N/A</span>
              )}
              <button
                onClick={() => save(user)}
                disabled={saving === user.id || isPending}
                className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors ml-2"
              >
                {saving === user.id ? "…" : "Save"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
