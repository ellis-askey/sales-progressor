"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Warning } from "@phosphor-icons/react";
import { AddressCard } from "./AddressCard";
import { DomainAuthFlow } from "./DomainAuthFlow";
import { InboxVerifyFlow } from "./InboxVerifyFlow";

type VerifiedEmail = {
  id: string;
  email: string;
  status: string;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  verifiedDomain?: { domain: string; status: string } | null;
};

type DomainRecord = {
  id: string;
  domain: string;
  status: string;
  dkimValid: boolean;
  spfValid: boolean;
  cnameRecords: { host: string; data: string; type: string }[];
};

type Step =
  | { type: "list" }
  | { type: "add-email" }
  | { type: "domain-auth"; domain: DomainRecord; pendingEmail: string }
  | { type: "inbox-verify"; email: string }
  | { type: "success"; email: string };

export function SendingAddressesSection({ initialVerified }: { initialVerified?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ type: "list" });
  const [emails, setEmails] = useState<VerifiedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmails = useCallback(async () => {
    const res = await fetch("/api/agent/verified-emails");
    if (res.ok) setEmails(await res.json());
  }, []);

  useEffect(() => {
    loadEmails();
    if (initialVerified) {
      setStep({ type: "success", email: "" });
      router.replace("/agent/settings");
    }
  }, [loadEmails, initialVerified, router]);

  async function startAddEmail() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/agent/verified-emails/domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    const domainRecord: DomainRecord = data.domain;

    if (domainRecord.status === "verified") {
      // Domain already auth'd — go straight to inbox verify
      await startInboxVerify(newEmail.trim().toLowerCase());
    } else {
      setStep({ type: "domain-auth", domain: domainRecord, pendingEmail: newEmail.trim().toLowerCase() });
    }
  }

  async function startInboxVerify(email: string) {
    const res = await fetch("/api/agent/verified-emails/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to send verification code");
      return;
    }
    setStep({ type: "inbox-verify", email });
  }

  function onRevoke(id: string) {
    setEmails((prev) => prev.filter((e) => e.id !== id));
  }

  function onVerified(email: string) {
    setStep({ type: "success", email });
    loadEmails();
  }

  const pendingDomains = emails
    .filter((e) => e.verifiedDomain?.status === "pending")
    .map((e) => e.verifiedDomain?.domain)
    .filter((d, i, arr) => d && arr.indexOf(d) === i);

  return (
    <div className="space-y-4">

      {/* Pending domain banner */}
      {pendingDomains.length > 0 && step.type === "list" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
          <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="fill" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">DNS setup incomplete</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {pendingDomains.join(", ")} — DNS records haven&apos;t been added yet. Your emails won&apos;t send until this is complete.
            </p>
          </div>
        </div>
      )}

      {/* Success */}
      {step.type === "success" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
          <p className="text-sm font-semibold text-emerald-700">
            ✓ {step.email ? `${step.email} is verified` : "Email address verified"} — you can now send emails from the dashboard.
          </p>
        </div>
      )}

      {/* Email list */}
      {step.type !== "domain-auth" && step.type !== "inbox-verify" && (
        <div className="space-y-2">
          {emails.length === 0 && step.type !== "add-email" && (
            <div className="glass-card px-5 py-8 text-center">
              <p className="text-sm text-slate-900/50">No verified sending addresses yet.</p>
              <p className="text-xs text-slate-900/35 mt-1">Add a work email address to start sending from the dashboard.</p>
            </div>
          )}
          {emails.map((e) => (
            <AddressCard
              key={e.id}
              record={e}
              onRevoke={onRevoke}
              onContinueVerify={(email) => startInboxVerify(email)}
            />
          ))}
        </div>
      )}

      {/* Add email form */}
      {step.type === "add-email" && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900/80 mb-1">Add a sending address</p>
            <p className="text-xs text-slate-900/50">Use a work email address — personal email (Gmail, Outlook, etc.) is not supported.</p>
          </div>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@youragency.co.uk"
            className="glass-input w-full px-3 py-2.5 text-sm"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && startAddEmail()}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={startAddEmail}
              disabled={loading || !newEmail.includes("@")}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium text-white transition-colors"
            >
              {loading ? "Checking…" : "Continue"}
            </button>
            <button
              onClick={() => { setStep({ type: "list" }); setError(null); setNewEmail(""); }}
              className="px-4 py-2 rounded-lg text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Domain auth flow */}
      {step.type === "domain-auth" && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-1">Step 1 of 2 — Domain authentication</p>
            <p className="text-sm font-semibold text-slate-900/80">Set up {step.domain.domain}</p>
            <p className="text-xs text-slate-900/50 mt-0.5">This only needs to be done once. All addresses on this domain can be added afterwards without repeating this step.</p>
          </div>
          <DomainAuthFlow
            domain={step.domain}
            onVerified={() => startInboxVerify(step.pendingEmail)}
          />
          <button
            onClick={() => { setStep({ type: "list" }); setNewEmail(""); setError(null); }}
            className="text-xs text-slate-900/40 hover:text-slate-900/70"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Inbox verify flow */}
      {step.type === "inbox-verify" && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-1">Step 2 of 2 — Inbox verification</p>
            <p className="text-sm font-semibold text-slate-900/80">Confirm {step.email}</p>
          </div>
          <InboxVerifyFlow
            email={step.email}
            onVerified={() => onVerified(step.email)}
            onCancel={() => { setStep({ type: "list" }); setNewEmail(""); }}
          />
        </div>
      )}

      {/* Add button */}
      {(step.type === "list" || step.type === "success") && (
        <button
          onClick={() => { setStep({ type: "add-email" }); setError(null); }}
          className="flex items-center gap-2 text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add a sending address
        </button>
      )}
    </div>
  );
}
