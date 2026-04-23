"use client";

import { useState } from "react";
import { Copy, CheckCircle, ArrowClockwise, EnvelopeSimple } from "@phosphor-icons/react";

type CnameRecord = { host: string; data: string; type: string };
type DomainRecord = {
  id: string;
  domain: string;
  status: string;
  dkimValid: boolean;
  spfValid: boolean;
  cnameRecords: CnameRecord[];
};

type Props = {
  domain: DomainRecord;
  onVerified: () => void;
};

const REGISTRAR_GUIDES: { name: string; steps: string }[] = [
  { name: "Cloudflare", steps: "DNS → Add record → Type: CNAME → Name: {host} → Target: {data} → Proxy: DNS Only (grey cloud)" },
  { name: "GoDaddy", steps: "My Products → DNS → Add → Type: CNAME → Host: {host} → Points to: {data}" },
  { name: "Google Domains", steps: "DNS → Custom records → Create new record → Type: CNAME → Host name: {host} → Data: {data}" },
  { name: "Namecheap", steps: "Domain List → Manage → Advanced DNS → Add New Record → CNAME → Host: {host} → Value: {data}" },
  { name: "123-reg", steps: "Manage DNS → Add Records → CNAME → Subdomain: {host} → Destination: {data}" },
  { name: "IONOS", steps: "Domain → DNS → Add record → Type: CNAME → Hostname: {host} → Points to: {data}" },
];

export function DomainAuthFlow({ domain, onVerified }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<null | { valid: boolean }>(null);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [sendingInstructions, setSendingInstructions] = useState(false);
  const [instructionsEmail, setInstructionsEmail] = useState("");
  const [instructionsSent, setInstructionsSent] = useState(false);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function checkDns() {
    setChecking(true);
    setCheckResult(null);
    const res = await fetch(`/api/agent/verified-emails/domain/${domain.id}/check`, { method: "POST" });
    const data = await res.json();
    setChecking(false);
    setCheckResult({ valid: data.valid });
    if (data.valid) onVerified();
  }

  async function sendInstructions() {
    if (!instructionsEmail.trim()) return;
    setSendingInstructions(true);
    const records = (domain.cnameRecords as CnameRecord[])
      .map((r, i) => `Record ${i + 1}:\n  Type: CNAME\n  Host: ${r.host}\n  Value: ${r.data}`)
      .join("\n\n");
    await fetch("/api/agent/send-instructions-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: instructionsEmail, domain: domain.domain, records }),
    });
    setSendingInstructions(false);
    setInstructionsSent(true);
  }

  const records = domain.cnameRecords as CnameRecord[];
  const isVerified = domain.status === "verified";

  return (
    <div className="space-y-5">
      {isVerified ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" weight="fill" />
          <div>
            <p className="text-sm font-semibold text-emerald-700">{domain.domain} is authenticated</p>
            <p className="text-xs text-emerald-600">All email addresses on this domain can now be verified</p>
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-sm font-semibold text-amber-800 mb-1">DNS setup required</p>
            <p className="text-xs text-amber-700">
              Add these {records.length} CNAME records to <strong>{domain.domain}</strong>&apos;s DNS.
              Your IT team or domain registrar can do this — it usually takes 30 minutes to take effect.
            </p>
          </div>

          {/* CNAME records */}
          <div className="space-y-3">
            {records.map((r, i) => (
              <div key={i} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900/40 uppercase tracking-wider">Record {i + 1} — CNAME</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-900/40 font-medium uppercase tracking-wide mb-0.5">Host / Name</p>
                      <code className="block text-xs font-mono text-slate-900/80 truncate bg-white/60 px-2 py-1.5 rounded-lg">{r.host}</code>
                    </div>
                    <button
                      onClick={() => copyText(r.host, `host-${i}`)}
                      className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      {copied === `host-${i}` ? "✓" : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-900/40 font-medium uppercase tracking-wide mb-0.5">Value / Points to</p>
                      <code className="block text-xs font-mono text-slate-900/80 truncate bg-white/60 px-2 py-1.5 rounded-lg">{r.data}</code>
                    </div>
                    <button
                      onClick={() => copyText(r.data, `data-${i}`)}
                      className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      {copied === `data-${i}` ? "✓" : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Registrar guides */}
          <div>
            <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-2">Where to add these — step by step</p>
            <div className="space-y-1">
              {REGISTRAR_GUIDES.map((g) => (
                <div key={g.name} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setOpenGuide(openGuide === g.name ? null : g.name)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-medium text-slate-900/80">{g.name}</span>
                    <span className="text-slate-900/30 text-xs">{openGuide === g.name ? "▲" : "▼"}</span>
                  </button>
                  {openGuide === g.name && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-slate-900/60 leading-relaxed">
                        {g.steps.replace(/{host}/g, records[0]?.host ?? "").replace(/{data}/g, records[0]?.data ?? "")}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Email instructions */}
          <div className="glass-card p-4">
            <p className="text-xs font-semibold text-slate-900/60 mb-2">
              <EnvelopeSimple className="w-3.5 h-3.5 inline mr-1" />
              Email these instructions to your IT team
            </p>
            {instructionsSent ? (
              <p className="text-xs text-emerald-600 font-medium">✓ Instructions sent</p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={instructionsEmail}
                  onChange={(e) => setInstructionsEmail(e.target.value)}
                  placeholder="it@yourcompany.com"
                  className="glass-input flex-1 px-3 py-2 text-sm"
                />
                <button
                  onClick={sendInstructions}
                  disabled={sendingInstructions || !instructionsEmail.trim()}
                  className="px-3 py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                >
                  {sendingInstructions ? "Sending…" : "Send"}
                </button>
              </div>
            )}
          </div>

          {/* Verify button */}
          <div className="space-y-2">
            {checkResult && !checkResult.valid && (
              <p className="text-xs text-amber-600 font-medium px-1">
                DNS records not detected yet — they can take up to 48 hours to propagate. Try again shortly.
              </p>
            )}
            <button
              onClick={checkDns}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-semibold transition-colors"
            >
              <ArrowClockwise className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking DNS…" : "I've added the records — check now"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
