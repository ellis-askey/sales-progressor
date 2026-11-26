"use client";

import { useState } from "react";
import { PaperPlaneTilt, Trash } from "@/components/icons/ph";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/arc/button/button";

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

// Canonical Badge tones (bordered, no fill) replace the washed status pills.
const STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  verified:             { label: "Verified", tone: "success" },
  pending_inbox_check:  { label: "Pending", tone: "amber" },
  legacy_single_sender: { label: "Legacy, migrate", tone: "amber" },
  expired:              { label: "Expired", tone: "danger" },
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
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-gray-900">{record.email}</p>
            <Badge tone={cfg.tone} caps={false}>{cfg.label}</Badge>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {record.verifiedAt && (
              <p className="text-xs text-gray-400">Verified {fmtDate(record.verifiedAt)}</p>
            )}
            {record.lastUsedAt ? (
              <p className="text-xs text-gray-400">Last sent {fmtDate(record.lastUsedAt)}</p>
            ) : record.status === "verified" ? (
              <p className="text-xs text-gray-400">Never used</p>
            ) : null}
          </div>
          {domainWarning && (
            <p className="text-xs text-[color:var(--agent-danger,#C73E3E)] mt-1">
              Domain authentication issue: check DNS settings
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {record.status === "verified" && (
            <Button variant="secondary" size="sm" onClick={sendTest} loading={testing} title="Send test email">
              <PaperPlaneTilt className="w-3.5 h-3.5" />
              {tested ? "Sent" : "Test"}
            </Button>
          )}
          {record.status === "pending_inbox_check" && onContinueVerify && (
            <Button variant="secondary" size="sm" onClick={() => onContinueVerify(record.email)}>
              Enter code
            </Button>
          )}
          <Button variant="ghost" size="sm" icon onClick={revoke} loading={revoking} title="Remove">
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
