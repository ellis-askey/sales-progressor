"use client";

// Command Centre → Email senders: per-agency domain-authentication cell + modal.
// Superadmin sets up an agency's SendGrid domain auth, copies the CNAMEs to send
// them, and checks status — all on the agency's behalf. Command visual system
// (dark, hairline borders, blue accent). Writes the same VerifiedDomain rows the
// agency's own self-serve screen reads.

import { useState } from "react";
import { setupAgencyDomainAction, checkAgencyDomainAction, type SerializedDomain } from "@/app/command/(protected)/email-senders/actions";
import { REGISTRAR_GUIDES } from "@/lib/verified-emails/registrar-hints";

type Agency = { id: string; name: string; quoteSenderEmail: string | null };

function domainFromEmail(email: string | null): string {
  return email?.split("@")[1]?.toLowerCase() ?? "";
}

function StatusPill({ record }: { record: SerializedDomain | null }) {
  if (!record) {
    return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-neutral-800 text-neutral-400 border-neutral-700">Not set</span>;
  }
  if (record.status === "verified") {
    return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]">Verified</span>;
  }
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#3a2a12] text-[#fbbf24] border-[#5a4426]">Pending</span>;
}

export function AgencyDomainAuth({ agency, initial }: { agency: Agency; initial: SerializedDomain | null }) {
  const [record, setRecord] = useState<SerializedDomain | null>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  const senderDomain = domainFromEmail(agency.quoteSenderEmail);
  const [domainInput, setDomainInput] = useState(senderDomain || record?.domain || "");
  const lockedDomain = !!senderDomain; // when a sender email is set, the domain must match it

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800);
  }

  async function generate() {
    const domain = (lockedDomain ? senderDomain : domainInput).trim().toLowerCase();
    if (!domain) { setError("Enter the agency's domain."); return; }
    setBusy(true); setError(null); setCheckMsg(null);
    const res = await setupAgencyDomainAction({ agencyId: agency.id, domain });
    setBusy(false);
    if (res.ok) setRecord(res.domain);
    else setError(res.error);
  }

  async function check() {
    if (!record) return;
    setBusy(true); setError(null); setCheckMsg(null);
    const res = await checkAgencyDomainAction(record.id);
    setBusy(false);
    if (res.ok) {
      setRecord(res.domain);
      setCheckMsg(res.valid ? "Verified. DKIM and SPF both pass." : "Not detected yet. DNS can take up to 48 hours to propagate.");
    } else {
      setError(res.error);
    }
  }

  const records = record?.cnameRecords ?? [];
  const agencyMessage = records.length
    ? `Hi,\n\nTo send email from ${record?.domain} we need these ${records.length} DNS records added (all type CNAME):\n\n` +
      records.map((r, i) => `${i + 1}. Host / Name: ${r.host}\n   Value / Points to: ${r.data}`).join("\n\n") +
      `\n\nThese go in your domain's DNS (at your registrar, e.g. Cloudflare or GoDaddy) and usually take about 30 minutes to take effect. Let us know once they're in and we'll verify.\n\nThanks`
    : "";

  return (
    <>
      <div className="flex items-center gap-2">
        <StatusPill record={record} />
        <button
          onClick={() => { setOpen(true); setError(null); setCheckMsg(null); }}
          className="text-[11px] font-medium px-2 py-0.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          {record ? "Manage" : "Set up"}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { if (!busy) setOpen(false); }}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg my-12 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <div>
                <p className="text-sm font-semibold text-neutral-100">{agency.name}</p>
                <p className="text-[11px] text-neutral-500">Domain authentication</p>
              </div>
              <button onClick={() => { if (!busy) setOpen(false); }} className="text-neutral-500 hover:text-neutral-300 text-lg leading-none px-2" aria-label="Close">×</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Domain */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Domain</label>
                {lockedDomain ? (
                  <p className="font-mono text-[13px] text-neutral-200">{senderDomain} <span className="text-neutral-600 text-[11px]">(from sender {agency.quoteSenderEmail})</span></p>
                ) : (
                  <input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="oplah.co.uk"
                    disabled={!!record || busy}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 font-mono text-[13px] text-neutral-200 disabled:opacity-60"
                  />
                )}
                {!record && (
                  <p className="text-[11px] text-neutral-600 mt-1">No sender email set for this agency yet, so type the domain they&apos;ll send from.</p>
                )}
              </div>

              {error && <p className="text-[12px] text-red-400">{error}</p>}

              {!record ? (
                <button
                  onClick={generate}
                  disabled={busy || (!lockedDomain && !domainInput.trim())}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors"
                >
                  {busy ? "Generating…" : "Generate DNS records"}
                </button>
              ) : (
                <>
                  {/* Verification state */}
                  <div className="flex items-center gap-3 text-[12px]">
                    <StatusPill record={record} />
                    <span className="text-neutral-400">DKIM {record.dkimValid ? "✓" : "·"}</span>
                    <span className="text-neutral-400">SPF {record.spfValid ? "✓" : "·"}</span>
                  </div>

                  {/* CNAME records */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">CNAME records to add ({records.length})</p>
                      <button onClick={() => copy(agencyMessage, "all")} className="text-[11px] text-blue-400 hover:text-blue-300">
                        {copied === "all" ? "Copied ✓" : "Copy message for the agency"}
                      </button>
                    </div>
                    {records.map((r, i) => (
                      <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] uppercase tracking-wide text-neutral-600 mb-0.5">Host / Name</p>
                            <code className="block text-[11px] font-mono text-neutral-300 truncate">{r.host}</code>
                          </div>
                          <button onClick={() => copy(r.host, `h${i}`)} className="text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:bg-neutral-800">{copied === `h${i}` ? "✓" : "Copy"}</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] uppercase tracking-wide text-neutral-600 mb-0.5">Value / Points to</p>
                            <code className="block text-[11px] font-mono text-neutral-300 truncate">{r.data}</code>
                          </div>
                          <button onClick={() => copy(r.data, `d${i}`)} className="text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:bg-neutral-800">{copied === `d${i}` ? "✓" : "Copy"}</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Registrar hints */}
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">Where to add these</p>
                    {REGISTRAR_GUIDES.map((g) => (
                      <div key={g.name} className="border border-neutral-800 rounded-lg overflow-hidden">
                        <button onClick={() => setOpenGuide(openGuide === g.name ? null : g.name)} className="w-full flex items-center justify-between px-3 py-2 text-left text-[12px] text-neutral-300">
                          <span>{g.name}</span><span className="text-neutral-600">{openGuide === g.name ? "▲" : "▼"}</span>
                        </button>
                        {openGuide === g.name && (
                          <p className="px-3 pb-2 text-[11px] text-neutral-500 leading-relaxed">
                            {g.steps.replace(/{host}/g, records[0]?.host ?? "").replace(/{data}/g, records[0]?.data ?? "")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {checkMsg && (
                    <p className={`text-[12px] ${record.status === "verified" ? "text-emerald-400" : "text-amber-400"}`}>{checkMsg}</p>
                  )}
                  <button
                    onClick={check}
                    disabled={busy}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold disabled:opacity-40 transition-colors"
                  >
                    {busy ? "Checking…" : "Check status"}
                  </button>
                  {record.lastCheckedAt && (
                    <p className="text-[10px] text-neutral-600 text-center">Last checked {new Date(record.lastCheckedAt).toLocaleString("en-GB")}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
