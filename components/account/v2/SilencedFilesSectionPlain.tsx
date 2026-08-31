"use client";

// components/account/v2/SilencedFilesSectionPlain.tsx
//
// Bulk-management lens for PropertyTransaction.clientEmailsPaused —
// re-housed onto the Account/Notifications tab per the Stage 0
// inventory decision ("silenced files → Notifications" — same mental
// model as the email/push prefs, all "paused automated outbound
// emails"). Wiring identical to the original SilencedFilesSection:
// same pauseClientEmails / resumeClientEmails server actions, same
// optimistic add/remove on the silenced list, same access-scope
// semantics (negotiators stay scoped to their own files; directors see
// every self-managed agency file — enforced server-side by the actions
// AND by the parent page's role-scoped silenceable query).
//
// Outsourced files are excluded server-side by pauseClientEmails;
// they're also excluded from the picker server-side by the parent
// query.

import { useState, useTransition } from "react";
import { Bell, BellSlash } from "@phosphor-icons/react";
import { pauseClientEmails, resumeClientEmails } from "@/app/actions/automation";
import { AccountCard } from "@/components/account/chrome/AccountCard";

type FileRow = {
  id: string;
  propertyAddress: string;
  pausedAt: Date | null;
  pausedByName: string | null;
};

export function SilencedFilesSectionPlain({
  initialSilenced,
  silenceable,
}: {
  initialSilenced: FileRow[];
  silenceable: { id: string; propertyAddress: string }[];
}) {
  const [silenced, setSilenced] = useState<FileRow[]>(initialSilenced);
  const [available, setAvailable] = useState(silenceable);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function relTime(d: Date | null): string {
    if (!d) return "";
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.round(days / 7)} weeks ago`;
    return `${Math.round(days / 30)} months ago`;
  }

  function handleResume(file: FileRow) {
    if (isPending) return;
    setBusyId(file.id);
    startTransition(async () => {
      const result = await resumeClientEmails(file.id);
      if (result.ok) {
        setSilenced((rows) => rows.filter((r) => r.id !== file.id));
        setAvailable((rows) =>
          [...rows, { id: file.id, propertyAddress: file.propertyAddress }].sort((a, b) =>
            a.propertyAddress.localeCompare(b.propertyAddress),
          ),
        );
      }
      setBusyId(null);
    });
  }

  function handleSilence() {
    if (!pickerValue || isPending) return;
    const target = available.find((r) => r.id === pickerValue);
    if (!target) return;
    setBusyId(target.id);
    startTransition(async () => {
      const result = await pauseClientEmails(target.id);
      if (result.ok) {
        setSilenced((rows) => [
          {
            id: target.id,
            propertyAddress: target.propertyAddress,
            pausedAt: new Date(),
            pausedByName: "You",
          },
          ...rows,
        ]);
        setAvailable((rows) => rows.filter((r) => r.id !== target.id));
        setPickerValue("");
        setPickerOpen(false);
      }
      setBusyId(null);
    });
  }

  return (
    <AccountCard
      icon={<Bell size={18} weight="bold" />}
      title="Silenced files"
      subtitle="Pause automated client emails for individual sales."
      headerAction={
        !pickerOpen ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={available.length === 0}
            title={available.length === 0 ? "All your active files are already silenced" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 13px",
              fontSize: 12.5,
              fontWeight: 600,
              color: available.length === 0 ? "#9ca3af" : "var(--agent-coral-deep, #E2452A)",
              background: "#fff",
              border: available.length === 0 ? "0.5px solid rgba(0,0,0,0.12)" : "0.5px solid rgba(255,107,74,0.5)",
              borderRadius: 9,
              cursor: available.length === 0 ? "default" : "pointer",
            }}
          >
            + Silence a file
          </button>
        ) : undefined
      }
      bodyStyle={{ marginTop: 12 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {pickerOpen && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 13, color: "#111827", background: "#fff", border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 8, outline: "none" }}
          >
            <option value="">Choose a file</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>{r.propertyAddress}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSilence}
            disabled={!pickerValue || isPending}
            style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, color: "#fff", background: "var(--agent-coral, #FF6B4A)", border: "none", borderRadius: 8, cursor: !pickerValue || isPending ? "default" : "pointer", opacity: !pickerValue || isPending ? 0.45 : 1 }}
          >
            Silence
          </button>
          <button
            type="button"
            onClick={() => { setPickerOpen(false); setPickerValue(""); }}
            disabled={isPending}
            style={{ padding: "8px 12px", fontSize: 13, color: "#6b7280", background: "transparent", border: "none", borderRadius: 6, cursor: isPending ? "default" : "pointer" }}
            className="hover:bg-black/[0.04]"
          >
            Cancel
          </button>
        </div>
      )}

      {silenced.length === 0 ? (
        <div style={{ textAlign: "center", padding: "26px 0 20px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,107,74,0.10)", color: "var(--agent-coral-deep, #E2452A)", marginBottom: 12 }}>
            <BellSlash size={20} weight="bold" />
          </span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>No files are silenced</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af" }}>All active files are currently sending as normal.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {silenced.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(254, 243, 199, 0.30)",
                border: "0.5px solid rgba(217, 119, 6, 0.18)",
                borderRadius: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.propertyAddress}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#6b7280" }}>
                  Paused {relTime(f.pausedAt)}
                  {f.pausedByName ? ` by ${f.pausedByName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResume(f)}
                disabled={busyId === f.id}
                style={{
                  flexShrink: 0,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#374151",
                  background: "#fff",
                  border: "0.5px solid rgba(0,0,0,0.18)",
                  borderRadius: 6,
                  cursor: busyId === f.id ? "default" : "pointer",
                  opacity: busyId === f.id ? 0.6 : 1,
                  transition: "background 150ms",
                }}
                className="hover:bg-black/[0.03]"
              >
                {busyId === f.id ? "…" : "Resume"}
              </button>
            </div>
          ))}
        </div>
      )}

      </div>
    </AccountCard>
  );
}
