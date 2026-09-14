"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle, ArrowClockwise, EnvelopeSimple } from "@phosphor-icons/react";
import { REGISTRAR_GUIDES } from "@/lib/verified-emails/registrar-hints";
import { relativeHost } from "@/lib/verified-emails/dns-host";

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

export function DomainAuthFlow({ domain, onVerified }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<null | { valid: boolean }>(null);
  // Which provider's step-guide is shown. Auto-detected from the domain's
  // nameservers where possible (Phase 3), else the agent picks. "__other" shows
  // the generic guidance.
  const [selectedRegistrar, setSelectedRegistrar] = useState<string | null>(null);
  const [detectedRegistrar, setDetectedRegistrar] = useState<string | null>(null);
  const [sendingInstructions, setSendingInstructions] = useState(false);
  const [instructionsEmail, setInstructionsEmail] = useState("");
  const [instructionsSent, setInstructionsSent] = useState(false);

  // Best-effort auto-detect of the DNS provider so we can pre-select their exact
  // steps. Silent on any failure — the picker still works manually.
  useEffect(() => {
    if (domain.status === "verified") return;
    let cancelled = false;
    fetch("/api/agent/verified-emails/detect-registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domain.domain }),
    })
      .then((r) => r.json())
      .then((d: { registrar?: string | null }) => {
        if (cancelled || !d.registrar) return;
        setDetectedRegistrar(d.registrar);
        setSelectedRegistrar((cur) => cur ?? d.registrar ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [domain.domain, domain.status]);

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
      .map((r, i) => `Record ${i + 1}:\n  Type: CNAME\n  Host / Name (enter this): ${relativeHost(r.host, domain.domain)}\n  (full name, only if your DNS provider asks for it: ${r.host})\n  Value / Points to: ${r.data}`)
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
              Your IT team or domain registrar can do this. It usually takes 30 minutes to take effect.
            </p>
          </div>

          <p className="text-xs text-slate-900/60 leading-relaxed">
            Enter just the <strong>Host / Name</strong> shown for each record. Most providers
            (GoDaddy, Namecheap, IONOS) add <span className="font-mono">{domain.domain}</span> for
            you automatically, so you only need the short part. Only use the full name if your
            provider specifically asks for it.
          </p>

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
                      <code className="block text-xs font-mono text-slate-900/80 truncate bg-white/60 px-2 py-1.5 rounded-lg">{relativeHost(r.host, domain.domain)}</code>
                      <p className="text-[10px] text-slate-900/40 mt-1 truncate">
                        Full name if asked: <span className="font-mono">{r.host}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => copyText(relativeHost(r.host, domain.domain), `host-${i}`)}
                      className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium agent-badge-brand rounded-lg transition-colors"
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
                      className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium agent-badge-brand rounded-lg transition-colors"
                    >
                      {copied === `data-${i}` ? "✓" : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Provider picker + tailored steps (auto-detected where possible) */}
          <div>
            <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-2">
              Where&apos;s your domain? Pick your provider for exact steps
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {REGISTRAR_GUIDES.map((g) => {
                const on = selectedRegistrar === g.name;
                return (
                  <button
                    key={g.name}
                    onClick={() => setSelectedRegistrar(g.name)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${on ? "border-[#FF6B4A] bg-[#FF6B4A]/10 text-[#E24E2E]" : "border-slate-900/10 text-slate-900/55 hover:border-[#FF6B4A]/40 hover:text-[#E24E2E]"}`}
                  >
                    {g.name}
                    {detectedRegistrar === g.name && (
                      <span className="ml-1.5 text-[10px] font-semibold text-emerald-600">detected</span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedRegistrar("__other")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedRegistrar === "__other" ? "border-[#FF6B4A] bg-[#FF6B4A]/10 text-[#E24E2E]" : "border-slate-900/10 text-slate-900/55 hover:border-[#FF6B4A]/40 hover:text-[#E24E2E]"}`}
              >
                Other / not sure
              </button>
            </div>

            {selectedRegistrar && selectedRegistrar !== "__other" && (() => {
              const g = REGISTRAR_GUIDES.find((x) => x.name === selectedRegistrar);
              if (!g) return null;
              const steps = g.steps
                .replace(/{host}/g, records[0] ? relativeHost(records[0].host, domain.domain) : "")
                .replace(/{data}/g, records[0]?.data ?? "");
              return (
                <div className="glass-card p-4">
                  {detectedRegistrar === g.name && (
                    <p className="text-[11px] text-emerald-600 font-medium mb-1.5">
                      Looks like your domain is on {g.name}, here&apos;s exactly what to do.
                    </p>
                  )}
                  <p className="text-sm font-medium text-slate-900/80 mb-1">{g.name}</p>
                  <p className="text-xs text-slate-900/60 leading-relaxed">{steps}</p>
                </div>
              );
            })()}

            {selectedRegistrar === "__other" && (
              <div className="glass-card p-4">
                <p className="text-xs text-slate-900/60 leading-relaxed">
                  In your domain&apos;s DNS settings, add each record above as type <strong>CNAME</strong>,
                  using the short <strong>Host / Name</strong> and the <strong>Value / Points to</strong> shown.
                  If your provider only offers a &ldquo;full name&rdquo; field, use the full name shown under each record instead.
                </p>
              </div>
            )}

            {!selectedRegistrar && (
              <p className="text-xs text-slate-900/40">Pick your provider above for step-by-step instructions.</p>
            )}
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
                  className="px-3 py-2 text-xs font-medium agent-btn-color-primary rounded-lg disabled:opacity-40 transition-colors"
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl agent-btn-color-primary text-sm font-semibold disabled:opacity-40 transition-colors"
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
