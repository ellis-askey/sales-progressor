"use client";

// Command Centre → Agency file: the data / GDPR danger zone. Superadmin-only
// tools, each confirm-gated, that post to step-up-protected routes:
//   - Close agency (reversible)      → /api/command/agencies/[id]/offboard mode=close
//   - Remove all data (permanent)    → …/offboard mode=purge  (type the name to confirm)
//   - Erase a person (GDPR)          → /api/gdpr/contact       (by email, within this agency)
// Nothing fires without an explicit action here; the real deletion happens only
// when a superadmin presses the button.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { tone: "ok" | "err"; text: string } | null;

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
    />
  );
}

export function AgencyDataControls({
  agencyId,
  agencyName,
  isInternal,
}: {
  agencyId: string;
  agencyName: string;
  isInternal: boolean;
}) {
  const router = useRouter();

  const [closeReason, setCloseReason] = useState("");
  const [purgeReason, setPurgeReason] = useState("");
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [eraseEmail, setEraseEmail] = useState("");
  const [eraseReason, setEraseReason] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  async function post(url: string, payload: unknown, key: string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: "err", text: data.error ?? "Something went wrong." });
      } else {
        return data as Record<string, unknown>;
      }
    } catch {
      setMsg({ tone: "err", text: "Network error. Please try again." });
    } finally {
      setBusy(null);
    }
    return null;
  }

  if (isInternal) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="text-sm font-semibold text-neutral-300">Data &amp; GDPR</h2>
        <p className="mt-2 text-xs text-neutral-500">This is an internal agency, so offboarding and data removal are disabled.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-red-900/50 bg-red-950/10 p-5 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-red-300">Data &amp; GDPR</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Superadmin tools. Each needs a recent two-factor step-up and a reason, and is written to the audit log.
        </p>
      </div>

      {msg && (
        <p className={`text-xs ${msg.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
      )}

      {/* Close — reversible */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-200">Close agency</p>
        <p className="text-xs text-neutral-500">Archives and locks the agency. Reversible.</p>
        <Field placeholder="Reason" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
        <button
          type="button"
          disabled={busy !== null || !closeReason.trim()}
          onClick={async () => {
            const r = await post(`/api/command/agencies/${agencyId}/offboard`, { mode: "close", reason: closeReason }, "close");
            if (r) { setMsg({ tone: "ok", text: "Agency closed and archived." }); setCloseReason(""); router.refresh(); }
          }}
          className="rounded-md border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy === "close" ? "Closing…" : "Close agency"}
        </button>
      </div>

      {/* Erase a person — GDPR */}
      <div className="space-y-2 border-t border-neutral-800 pt-5">
        <p className="text-sm font-medium text-neutral-200">Erase a person (GDPR)</p>
        <p className="text-xs text-neutral-500">
          Anonymises every contact record for this email in this agency, removes their documents, and kills their portal link.
        </p>
        <Field type="email" placeholder="Person's email" value={eraseEmail} onChange={(e) => setEraseEmail(e.target.value)} />
        <Field placeholder="Reason" value={eraseReason} onChange={(e) => setEraseReason(e.target.value)} />
        <button
          type="button"
          disabled={busy !== null || !eraseEmail.trim() || !eraseReason.trim()}
          onClick={async () => {
            if (!window.confirm(`Erase ${eraseEmail} from this agency? This can't be undone.`)) return;
            const r = await post(`/api/gdpr/contact`, { agencyId, email: eraseEmail, reason: eraseReason }, "erase");
            if (r) { setMsg({ tone: "ok", text: `Erased ${r.contacts} contact record(s), removed ${r.documentsRemoved} document(s).` }); setEraseEmail(""); setEraseReason(""); router.refresh(); }
          }}
          className="rounded-md border border-red-800 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-50"
        >
          {busy === "erase" ? "Erasing…" : "Erase this person"}
        </button>
      </div>

      {/* Remove all data — permanent */}
      <div className="space-y-2 border-t border-neutral-800 pt-5">
        <p className="text-sm font-medium text-red-300">Remove all data (permanent)</p>
        <p className="text-xs text-neutral-500">
          Permanently deletes every sale, contact, message and document for this agency. Staff are anonymised; invoices are kept.
          Type the agency name <span className="text-neutral-300">{agencyName}</span> to confirm.
        </p>
        <Field placeholder={`Type "${agencyName}" to confirm`} value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} />
        <Field placeholder="Reason" value={purgeReason} onChange={(e) => setPurgeReason(e.target.value)} />
        <button
          type="button"
          disabled={busy !== null || purgeConfirm.trim() !== agencyName || !purgeReason.trim()}
          onClick={async () => {
            if (!window.confirm(`Permanently remove ALL data for ${agencyName}? This cannot be undone.`)) return;
            const r = await post(`/api/command/agencies/${agencyId}/offboard`, { mode: "purge", confirmPurge: true, reason: purgeReason }, "purge");
            if (r) {
              setMsg({ tone: "ok", text: `Removed ${r.transactionsDeleted} sale(s)${Number(r.transactionsFailed) > 0 ? `, ${r.transactionsFailed} could not be removed` : ""}; ${r.usersAnonymised} staff anonymised.` });
              setPurgeConfirm(""); setPurgeReason(""); router.refresh();
            }
          }}
          className="rounded-md bg-red-900 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-800 disabled:opacity-40"
        >
          {busy === "purge" ? "Removing…" : "Remove all data"}
        </button>
      </div>
    </section>
  );
}
