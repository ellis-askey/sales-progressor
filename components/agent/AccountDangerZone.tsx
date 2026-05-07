"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { deleteMyAccount } from "@/app/actions/delete-my-account";
import { exportMyData } from "@/app/actions/export-my-data";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function AccountDangerZone({ userEmail }: { userEmail: string }) {
  const [showModal, setShowModal]       = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [isPending, startTransition]    = useTransition();
  const [isExporting, setIsExporting]   = useState(false);
  const { toast } = useAgentToast();

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportMyData();
      const blob  = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      const date  = new Date().toISOString().split("T")[0];
      a.href     = url;
      a.download = `sales-progressor-export-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setIsExporting(false);
    }
  }

  const emailMatches = confirmEmail.toLowerCase().trim() === userEmail.toLowerCase();

  function openModal() {
    setConfirmEmail("");
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    if (isPending) return;
    setShowModal(false);
    setConfirmEmail("");
    setError(null);
  }

  function handleDelete() {
    if (!emailMatches || isPending) return;
    setError(null);
    const fd = new FormData();
    fd.set("confirmEmail", confirmEmail);
    startTransition(async () => {
      const result = await deleteMyAccount(fd);
      if (result.ok) {
        toast.success("Account deleted");
        await signOut({ callbackUrl: "/login" });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="glass-card p-6">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-slate-900/80 mb-1">Account</h2>
          <p className="text-xs text-slate-900/50">
            Download a copy of your data, or permanently delete your account.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-white/60 disabled:opacity-50 transition-colors"
          >
            {isExporting ? "Preparing…" : "Download my data"}
          </button>
          <button
            onClick={openModal}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete my account
          </button>
        </div>
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="glass-card" style={{
            width: "100%", maxWidth: 440, padding: 28,
            background: "rgba(255,255,255,0.97)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          }}>
            <h2 className="text-base font-bold text-slate-900/90 mb-2">Delete account</h2>
            <p className="text-sm text-slate-900/60 mb-5 leading-relaxed">
              This will permanently delete your account and all associated data. This cannot be undone.
            </p>

            <label className="block text-xs font-semibold text-slate-900/50 mb-1.5">
              Type your email address to confirm
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => { setConfirmEmail(e.target.value); setError(null); }}
              placeholder={userEmail}
              className="glass-input w-full px-3 py-2 text-sm mb-4"
              disabled={isPending}
              autoFocus
            />

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={!emailMatches || isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:bg-red-200 disabled:cursor-not-allowed text-white transition-colors"
              >
                {isPending ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                onClick={closeModal}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
