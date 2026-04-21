"use client";
// components/admin/AgentFeeManager.tsx
// Manage clientType and legacyFee per agent

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientType, UserRole } from "@prisma/client";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clientType: ClientType;
  legacyFee: number | null;
};

export function AgentFeeManager({ users }: { users: User[] }) {
  const router = useRouter();
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

  async function save(user: User) {
    const edit = getEdit(user);
    setSaving(user.id);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        clientType: edit.clientType,
        legacyFee: edit.legacyFee,
      }),
    });
    setSaving(null);
    router.refresh();
  }

  const agents = users.filter((u) => u.role !== "viewer");

  return (
    <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
         style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      {/* Header */}
      <div className="grid grid-cols-4 px-5 py-3 bg-gray-50 border-b border-[#e4e9f0] text-xs font-medium text-gray-400 uppercase tracking-wide">
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
               className="grid grid-cols-4 items-center px-5 py-4 border-b border-[#f0f4f8] last:border-0 gap-4">
            {/* Name */}
            <div>
              <p className="text-sm font-medium text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-400">{user.role.replace("_", " ")}</p>
            </div>

            {/* Client type toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {(["standard", "legacy"] as ClientType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => updateEdit(user.id, "clientType", t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                    edit.clientType === t
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
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
                  <span className="text-sm text-gray-400">£</span>
                  <input
                    type="number"
                    value={edit.legacyFee}
                    onChange={(e) => updateEdit(user.id, "legacyFee", e.target.value)}
                    placeholder="220"
                    className="w-20 px-2 py-1.5 text-sm border border-[#e4e9f0] rounded-lg focus:outline-none focus:border-blue-400"
                  />
                </div>
              ) : (
                <span className="text-xs text-gray-300 italic">N/A</span>
              )}
            </div>

            {/* Standard fee reference */}
            <div className="flex items-center justify-between">
              {!isLegacy ? (
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>Up to £349,999 → £250</p>
                  <p>£350k–£499k → £300</p>
                  <p>£500k+ → £350</p>
                </div>
              ) : (
                <span className="text-xs text-gray-300 italic">N/A</span>
              )}
              <button
                onClick={() => save(user)}
                disabled={saving === user.id}
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
