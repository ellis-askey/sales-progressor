"use client";

// components/account/v2/AccountDangerZonePlain.tsx
//
// Data export + account delete re-housed for the Account/Profile tab.
// Wiring identical to the original AccountDangerZone — same exportMyData
// + deleteMyAccount server actions, same email-confirmation modal, same
// signOut on successful delete, same Escape-key dismiss. Strips the outer
// glass-card wrapper so the section sits flat on the Account canvas; the
// modal itself stays as-is (modals are overlays — they read fine on any
// canvas).

import { useState, useTransition, useEffect } from "react";
import { signOut } from "next-auth/react";
import { X, DownloadSimple, Trash, CaretRight } from "@phosphor-icons/react";
import { deleteMyAccount } from "@/app/actions/delete-my-account";
import { exportMyData } from "@/app/actions/export-my-data";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function AccountDangerZonePlain({ userEmail }: { userEmail: string }) {
  const [showModal, setShowModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useAgentToast();

  useEffect(() => {
    if (!showModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `sales-progressor-export-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed — try again");
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="account-datarow"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.12)",
            borderRadius: 11,
            cursor: isExporting ? "default" : "pointer",
            opacity: isExporting ? 0.6 : 1,
            transition: "background 150ms, border-color 150ms, box-shadow 150ms",
          }}
        >
          <span className="account-datarow-icon" aria-hidden>
            <DownloadSimple size={16} weight="bold" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#111827" }}>
              {isExporting ? "Preparing…" : "Download my data"}
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 1 }}>
              Get a copy of your data in a secure file.
            </span>
          </span>
          <CaretRight size={14} weight="bold" className="account-datarow-chev" style={{ color: "#c0c4d0", flexShrink: 0 }} />
        </button>

        <button
          type="button"
          onClick={openModal}
          className="account-datarow account-datarow-danger"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            background: "#fff",
            border: "0.5px solid #fecaca",
            borderRadius: 11,
            cursor: "pointer",
            transition: "background 150ms, border-color 150ms, box-shadow 150ms",
          }}
        >
          <span className="account-datarow-icon account-datarow-icon-danger" aria-hidden>
            <Trash size={16} weight="bold" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#b91c1c" }}>
              Delete my account
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 1 }}>
              Permanently delete your account and all associated data.
            </span>
          </span>
          <CaretRight size={14} weight="bold" className="account-datarow-chev" style={{ color: "#f0a3a3", flexShrink: 0 }} />
        </button>

        <style>{`
          /* Hover lights the border in the row's accent (coral / red) and
             nudges the chevron right; both ease back on hover-off. */
          .account-datarow:hover { background: rgba(255,107,74,0.03); border-color: var(--agent-coral, #FF6B4A); box-shadow: inset 0 0 0 1px var(--agent-coral, #FF6B4A); }
          .account-datarow-danger:hover { background: #fef2f2; border-color: #ef4444; box-shadow: inset 0 0 0 1px #ef4444; }
          .account-datarow-chev { transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1); }
          .account-datarow:hover .account-datarow-chev { transform: translateX(3px); }
          .account-datarow-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px;
            background: rgba(0,0,0,0.05); color: #6b7280;
          }
          .account-datarow-icon-danger { background: #fef2f2; color: #dc2626; }
          @media (prefers-reduced-motion: reduce) {
            .account-datarow-chev { transition: none; }
            .account-datarow:hover .account-datarow-chev { transform: none; }
          }
        `}</style>
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              padding: 0,
              background: "#fff",
              borderRadius: 12,
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 56,
                padding: "0 20px",
                borderBottom: "0.5px solid rgba(0,0,0,0.08)",
                gap: 12,
              }}
            >
              <p style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Delete account
              </p>
              <button
                onClick={closeModal}
                aria-label="Close"
                disabled={isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  background: "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: isPending ? "default" : "pointer",
                  color: "#6b7280",
                  transition: "background 150ms",
                }}
                className="hover:bg-black/[0.05]"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55, margin: "0 0 18px" }}>
                This permanently deletes your account and all associated data. This cannot be undone.
              </p>

              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: 0.7,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Type your email address to confirm
              </label>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => {
                  setConfirmEmail(e.target.value);
                  setError(null);
                }}
                placeholder={userEmail}
                disabled={isPending}
                autoFocus
                className="account-input"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 13,
                  color: "#111827",
                  background: "#fff",
                  border: "0.5px solid rgba(0,0,0,0.18)",
                  borderRadius: 8,
                  outline: "none",
                  marginBottom: 14,
                }}
              />

              {error && (
                <div
                  style={{
                    padding: "9px 12px",
                    fontSize: 12.5,
                    color: "#b91c1c",
                    background: "#fef2f2",
                    border: "0.5px solid #fecaca",
                    borderRadius: 8,
                    marginBottom: 14,
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={closeModal}
                  disabled={isPending}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    color: "#6b7280",
                    background: "transparent",
                    border: "none",
                    borderRadius: 8,
                    cursor: isPending ? "default" : "pointer",
                    transition: "background 150ms",
                  }}
                  className="hover:bg-black/[0.04]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!emailMatches || isPending}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#fff",
                    background: !emailMatches || isPending ? "#fecaca" : "#dc2626",
                    border: "none",
                    borderRadius: 8,
                    cursor: !emailMatches || isPending ? "not-allowed" : "pointer",
                    transition: "background 150ms",
                  }}
                >
                  {isPending ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
