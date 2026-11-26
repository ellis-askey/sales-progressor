"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle } from "@phosphor-icons/react";
import { AddressCard } from "./AddressCard";
import { DomainAuthFlow } from "./DomainAuthFlow";
import { InboxVerifyFlow } from "./InboxVerifyFlow";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";

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

const coralPrimary = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

export function SendingAddressesSection({ initialVerified, domainVerified, ownAddress, homeHref = "/agent/account/connections" }: { initialVerified?: boolean; domainVerified?: boolean; ownAddress?: string; homeHref?: string }) {
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
      // Clears the ?verified=1 query string. Targets the new Account/Profile
      // surface (the inventory'd migration home) so that completing
      // verification from EITHER the legacy /agent/settings page OR the new
      // /agent/account/profile page funnels users into the new home. The
      // old settings page remains fully functional otherwise; this is a
      // deliberate one-way migration nudge on success.
      router.replace(homeHref);
    }
  }, [loadEmails, initialVerified, router, homeHref]);

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
    window.dispatchEvent(new CustomEvent("sp_onboarding_step", { detail: { hasVerifiedEmail: true } }));
  }

  const pendingDomains = emails
    .filter((e) => e.verifiedDomain?.status === "pending")
    .map((e) => e.verifiedDomain?.domain)
    .filter((d, i, arr) => d && arr.indexOf(d) === i);

  return (
    <div className="space-y-4">

      {/* Pending domain banner */}
      {pendingDomains.length > 0 && step.type === "list" && (
        <InlineAlert kind="warning">
          <b>DNS setup incomplete.</b> {pendingDomains.join(", ")}: the DNS records haven&apos;t been added yet. Your emails won&apos;t send from this domain until setup is complete.
        </InlineAlert>
      )}

      {/* Domain already authenticated → they already send from their own address,
          so reassure rather than pushing the per-address code step (which only
          matters for someone who hasn't done DNS). */}
      {domainVerified && step.type === "list" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-white" style={{ borderColor: "rgba(47,158,107,0.4)" }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" weight="fill" style={{ color: "#2F9E6B" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#2F9E6B" }}>You&rsquo;re all set</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Your emails already send from your own address{ownAddress ? ` (${ownAddress})` : ""}, with replies coming straight back to you. There&rsquo;s nothing to set up here.
            </p>
          </div>
        </div>
      )}

      {/* Success */}
      {step.type === "success" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-white" style={{ borderColor: "rgba(47,158,107,0.4)" }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" weight="fill" style={{ color: "#2F9E6B" }} />
          <p className="text-sm font-semibold" style={{ color: "#2F9E6B" }}>
            {step.email ? `${step.email} is verified.` : "Address verified."} Emails to clients and solicitors now send from your own address, with replies coming straight back to you.
          </p>
        </div>
      )}

      {/* Email list */}
      {step.type !== "domain-auth" && step.type !== "inbox-verify" && (
        <div className="space-y-2">
          {emails.length === 0 && step.type !== "add-email" && !domainVerified && (
            <div
              className="px-5 py-7 text-center"
              style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fcfbfa" }}
            >
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#4b5563" }}>No sending address connected</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9ca3af" }}>
                Add a work email address to start sending from Sales Progressor.
              </p>
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
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Add a sending address</p>
            <p className="text-xs text-gray-500">Use an email on your own work domain. Personal addresses such as Gmail or Outlook aren&apos;t supported here.</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (!loading && newEmail.includes("@")) startAddEmail(); }}
            className="space-y-4"
          >
            <LabelInput
              field="Email address"
              label="Email address"
              type="email"
              size="sm"
              fullWidth
              accent="#FF6B4A"
              autoFocus
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            {error && <InlineAlert kind="danger">{error}</InlineAlert>}
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                style={coralPrimary}
                disabled={!newEmail.includes("@")}
                loading={loading}
              >
                Continue
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => { setStep({ type: "list" }); setError(null); setNewEmail(""); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Domain auth flow */}
      {step.type === "domain-auth" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--agent-coral-deep, #E2452A)" }}>Step 1 of 2: Domain authentication</p>
            <p className="text-sm font-semibold text-gray-800">Set up {step.domain.domain}</p>
            <p className="text-xs text-gray-500 mt-0.5">You only need to do this once. Once the domain is verified, you can add other addresses on it without repeating this step.</p>
          </div>
          <DomainAuthFlow
            domain={step.domain}
            onVerified={() => startInboxVerify(step.pendingEmail)}
          />
          <button
            onClick={() => { setStep({ type: "list" }); setNewEmail(""); setError(null); }}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Inbox verify flow */}
      {step.type === "inbox-verify" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--agent-coral-deep, #E2452A)" }}>Step 2 of 2: Inbox verification</p>
            <p className="text-sm font-semibold text-gray-800">Confirm {step.email}</p>
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
        <Button
          variant="secondary"
          size="md"
          onClick={() => { setStep({ type: "add-email" }); setError(null); }}
          className="w-full"
        >
          <Plus className="w-4 h-4" />
          Add a sending address
        </Button>
      )}
    </div>
  );
}
