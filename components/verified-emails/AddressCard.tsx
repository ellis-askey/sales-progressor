"use client";

import { useState } from "react";
import { CheckCircle, Clock, XCircle, PaperPlaneTilt, Trash } from "@phosphor-icons/react";

type VerifiedEmail = {
  id: string;
  email: string;
  status: string;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  verifiedDomain?: { domain: string; status: string } | null;
};

type Props = {
  record: VerifiedEmail;
  onRevoke: (id: string) => void;
  onContinueVerify?: (email: string) => void;
};

function fmtDate(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  verified:            { label: "Verified",        icon: <CheckCircle weight="fill" className="w-4 h-4" />, cls: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  pending_inbox_check: { label: "Pending",          icon: <Clock weight="fill" className="w-4 h-4" />,       cls: "text-amber-600 bg-amber-50 border-amber-100" },
  legacy_single_sender:{ label: "Legacy — migrate", icon: <Clock weight="fill" className="w-4 h-4" />,       cls: "text-orange-600 bg-orange-50 border-orange-100" },
  expired:             { label: "Expired",          icon: <XCircle weight="fill" className="w-4 h-4" />,     cls: "text-red-500 bg-red-50 border-red-100" },
};

export function AddressCard({ record, onRevoke, onContinueVerify }: Props) {
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.pending_inbox_check;

  async function sendTest() {
    setTesting(true);
    await fetch(`/api/agent/verified-emails/${record.id}`, { method: "POST" });
    setTesting(false);
    setTested(true);
    setTimeout(() => setTested(false), 4000);
  }

  async function revoke() {
    setRevoking(true);
    await fetch(`/api/agent/verified-emails/${record.id}`, { method: "DELETE" });
    onRevoke(record.id);
  }

  const domainWarning =
    record.status === "verified" &&
    record.verifiedDomain &&
    record.verifiedDomain.status !== "verified";

  return (
    <div className="glass-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-slate-900/90">{record.email}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
              {cfg.icon}
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {record.verifiedAt && (
              <p className="text-xs text-slate-900/40">Verified {fmtDate(record.verifiedAt)}</p>
            )}
            {record.lastUsedAt ? (
              <p className="text-xs text-slate-900/40">Last sent {fmtDate(record.lastUsedAt)}</p>
            ) : record.status === "verified" ? (
              <p className="text-xs text-slate-900/30">Never used</p>
            ) : null}
          </div>
          {domainWarning && (
            <p className="text-xs text-red-500 mt-1">
              Domain authentication issue — check DNS settings
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {record.status === "verified" && (
            <button
              onClick={sendTest}
              disabled={testing}
              title="Send test email"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <PaperPlaneTilt className="w-3.5 h-3.5" />
              {tested ? "Sent!" : testing ? "…" : "Test"}
            </button>
          )}
          {record.status === "pending_inbox_check" && onContinueVerify && (
            <button
              onClick={() => onContinueVerify(record.email)}
              className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
            >
              Enter code
            </button>
          )}
          <button
            onClick={revoke}
            disabled={revoking}
            title="Remove"
            className="p-1.5 text-slate-900/30 hover:text-red-400 transition-colors"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
