"use client";

// /dev/connections-sp — PROTOTYPE ONLY. How the Connections page would look for a
// SALES-PROGRESSION company (owner or team member), with the founder's framing:
//   • their own inbox is the SECONDARY thing (emails they send directly to agents:
//     invites, nudges, direct emails on a file);
//   • the PRIMARY setup is each client agency's branded white-label sending, which
//     lives per client under Clients — so the page leads with a pointer there.
//
// The capability table is the REAL <ConnectionsMatrix> (via its dev `demo` prop),
// so the grid is byte-for-byte what ships. The cards + toggles are local fakes.
// Nothing is wired to a backend.

import { useState } from "react";
import { ConnectionsMatrix } from "@/components/account/ConnectionsMatrix";
import { OutlookLogo } from "@/components/account/provider-logos";
import { EnvelopeSimple, WhatsappLogo } from "@phosphor-icons/react";

type ChannelKey = "outlook" | "email" | "whatsapp";

const CORAL_BTN: React.CSSProperties = {
  background: "linear-gradient(180deg, var(--agent-coral,#FF8A5C), var(--agent-coral-deep,#E8542F))",
  boxShadow: "0 4px 16px -4px rgba(255,107,74,0.45)",
};

const BULLETS: Record<ChannelKey, string[]> = {
  outlook: ["Send and receive emails through Outlook", "Automatically chase outstanding updates", "Save replies to the correct sale", "Keep your sale timeline up to date"],
  email: ["Send emails from your own address", "Automatically chase outstanding updates", "Save replies to the correct sale", "Keep your sale timeline up to date"],
  whatsapp: ["Connect using WhatsApp's linked devices", "Capture conversations from your property groups", "Save messages to the correct sale", "Keep group conversations on your sale timeline"],
};
const CARD_NAME: Record<ChannelKey, string> = { outlook: "Microsoft Outlook", email: "Other email providers", whatsapp: "WhatsApp" };

function ChannelLogo({ k }: { k: ChannelKey }) {
  if (k === "outlook") return <OutlookLogo size={38} />;
  if (k === "whatsapp") return <span className="flex h-[38px] w-[38px] items-center justify-center rounded-lg" style={{ background: "#25D366" }}><WhatsappLogo size={22} weight="fill" color="#fff" /></span>;
  return <span className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50"><EnvelopeSimple size={20} weight="bold" style={{ color: "var(--agent-coral,#FF6B4A)" }} /></span>;
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${disabled ? "cursor-not-allowed opacity-50" : ""} ${on ? "bg-[#FF6B4A]" : "bg-gray-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function ConnectionsSpPreview() {
  const [outlookOn, setOutlookOn] = useState(false);
  const [emailOn, setEmailOn] = useState(false);
  const [emailSends, setEmailSends] = useState(true);
  const [emailLimited, setEmailLimited] = useState(false);
  const [waOn, setWaOn] = useState(false);
  const [dns, setDns] = useState(false);

  const demo = { outlookOn, imapOn: emailOn, imapSends: emailOn && emailSends, imapReadIssue: emailOn && emailLimited, waOn };

  const status = (k: ChannelKey): { label: string; tone: "on" | "warn" | "off" } => {
    if (k === "outlook") return outlookOn ? { label: "1 connected", tone: "on" } : { label: "Not connected", tone: "off" };
    if (k === "email") return !emailOn ? { label: "Not connected", tone: "off" } : (emailLimited || !emailSends) ? { label: "Needs attention", tone: "warn" } : { label: "Connected", tone: "on" };
    return waOn ? { label: "Connected", tone: "on" } : { label: "Not connected", tone: "off" };
  };
  const connected = (k: ChannelKey) => k === "outlook" ? outlookOn : k === "email" ? emailOn : waOn;

  const toggles: { label: string; on: boolean; set: () => void; disabled?: boolean }[] = [
    { label: "Outlook linked", on: outlookOn, set: () => setOutlookOn((v) => !v) },
    { label: "Email provider connected", on: emailOn, set: () => setEmailOn((v) => !v) },
    { label: "Email sending on", on: emailSends, set: () => setEmailSends((v) => !v), disabled: !emailOn },
    { label: "Email reading limited", on: emailLimited, set: () => setEmailLimited((v) => !v), disabled: !emailOn },
    { label: "WhatsApp connected", on: waOn, set: () => setWaOn((v) => !v) },
    { label: "Business domain verified (DNS)", on: dns, set: () => setDns((v) => !v) },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(130% 90% at 80% -10%,#efe7f3 0%,#f8f5f1 42%,#efe9e2 100%)" }}>
      <div className="mx-auto max-w-[920px] px-6 py-10">
        <div className="mb-5 text-[11.5px] font-semibold text-gray-500">Preview · sales-prog Connections · fake data, nothing is wired up</div>

        <h1 className="text-[30px] font-bold tracking-tight text-gray-900">Connections</h1>
        <p className="mt-2 max-w-[650px] text-[14px] leading-relaxed text-gray-500">
          Connect your own inbox for the emails you send directly to agents, like invites and nudges. The branded
          emails your clients&rsquo; buyers and sellers receive are set up separately, per client.
        </p>

        {/* The real capability grid (byte-for-byte via demo prop), with a discreet
            footer on the client-facing stream (where buyers/sellers' emails come from). */}
        <div className="mt-6">
          <ConnectionsMatrix demo={demo} domainVerified={dns} variant="progression" footer={
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/60 px-5 py-3">
              <p className="text-[11.5px] leading-relaxed text-gray-500">2 of your 3 agencies send from their own branded address. The other 1 sends from updates@thesalesprogressor.co.uk.</p>
              <a href="/agent/clients" className="shrink-0 text-[11.5px] font-semibold" style={{ color: "#E2452A", textDecoration: "none" }}>Manage per agency &rarr;</a>
            </div>
          } />
        </div>

        {/* Your connections — the member's own inbox + WhatsApp */}
        <div className="mt-9 mb-4">
          <h2 className="text-[18px] font-bold tracking-tight text-gray-900">Your connections</h2>
          <p className="mt-1 text-[13px] text-gray-500">For the emails you send yourself. Your clients&rsquo; branded emails are set per client above.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(["outlook", "email", "whatsapp"] as ChannelKey[]).map((k) => {
            const st = status(k);
            return (
              <article key={k} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <ChannelLogo k={k} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold leading-tight text-gray-900">{CARD_NAME[k]}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                      <span className={`h-[7px] w-[7px] rounded-full ${st.tone === "on" ? "bg-emerald-500" : st.tone === "warn" ? "bg-amber-500" : "bg-gray-300"}`} />
                      <span className={st.tone === "on" ? "text-emerald-600" : st.tone === "warn" ? "text-amber-600" : ""}>{st.label}</span>
                    </span>
                  </div>
                </div>
                {connected(k) ? (
                  <div className="mt-4 flex-1 text-[12.5px] font-medium text-gray-700">
                    {k === "outlook" ? "ellis@sarahprogression.co.uk" : k === "email" ? (emailSends ? "Sending on" : "Sending off") : "+44 7508 862929"}
                  </div>
                ) : (
                  <ul className="mt-4 flex flex-1 flex-col gap-2.5">
                    {BULLETS[k].map((b) => (
                      <li key={b} className="flex items-center gap-2.5 text-[12.5px] text-gray-500">
                        <span className="h-[13px] w-[13px] shrink-0 rounded-full border border-gray-300 opacity-60" />{b}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5">
                  {connected(k) ? (
                    <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50">Manage</button>
                  ) : (
                    <button className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white" style={CORAL_BTN}>
                      {k === "outlook" ? "Connect Outlook" : k === "email" ? "Connect email provider" : "Connect WhatsApp"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Demo controls */}
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-[15px] font-bold text-gray-900">Demo controls</p>
          <p className="mt-0.5 text-[12px] text-gray-500">Toggle states and watch the grid react.</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {toggles.map((t) => (
              <div key={t.label} className={`flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-800 ${t.disabled ? "opacity-50" : ""}`}>
                <span>{t.label}</span>
                <Toggle on={t.on} onClick={t.set} disabled={t.disabled} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
            The grid uses the progression wording: &ldquo;Send from your own address&rdquo; reads &ldquo;Agents receive your emails from your own address&rdquo;. On the real page it lights from your connected inbox; the &ldquo;business domain verified&rdquo; toggle here previews wiring the business domain in later.
          </p>
        </div>
      </div>
    </div>
  );
}
