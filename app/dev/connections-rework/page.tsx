"use client";

// /dev/connections-rework — PROTOTYPE ONLY (not wired to any backend).
//
// Consolidated Connections page (founder direction 2026-11-13: "it should all be
// in one place"):
//   1. Capability matrix on top — lights up as channels connect; amber "needs
//      attention" tick when a channel is connected but carries a caveat.
//   2. A full-width "Send from your own address" section carrying BOTH real
//      methods: single sender (verify one address, no DNS) and domain/DNS auth.
//   3. The 3-card connection row (Outlook / Email provider / WhatsApp). Connected
//      cards stay compact; per-inbox detail (dual reading/sending status, check,
//      send test, disconnect, multiple inboxes) sits behind "Manage".
//   + "View as" switch to preview the external progression-member variant.
//
// Everything is fake: flows accept dummy data and flip local state. No network.
// Copy is lifted from the live cards/SenderDomainSection so it reads true.
// Calendar sync is intentionally absent — it is not a real capability.

import { useRef, useState, type ReactNode } from "react";
import {
  OutlookLogo, GmailLogo, YahooLogo, ICloudLogo, ZohoLogo, ExpLogo, GenericMailLogo,
} from "@/components/account/provider-logos";
import { PaperPlaneTilt, IdentificationBadge, ArrowsClockwise, ChatCircleText, ListChecks } from "@phosphor-icons/react";

type ChannelKey = "outlook" | "email" | "whatsapp";
type TileKey = "gmail" | "yahoo" | "icloud" | "zoho" | "exp" | "other";
type ViewAs = "director" | "member";

type OutlookInbox = { id: string; email: string };
type EmailInbox = { id: string; email: string; provider: TileKey; reading: "on" | "limited" | "unchecked"; sending: "on" | "off" };
type Wa = { status: "off" | "connected"; phone?: string };
type CellState = "na" | "off" | "partial" | "on";

const CAPS: { key: string; title: string; sub: string; Icon: typeof PaperPlaneTilt }[] = [
  { key: "send", title: "Send and receive emails", sub: "Manage all your sale emails in one place.", Icon: PaperPlaneTilt },
  { key: "sendown", title: "Send from your own address", sub: "Clients receive emails from your address, not ours.", Icon: IdentificationBadge },
  { key: "chase", title: "Automatic email chasing", sub: "Save time with automated follow-ups.", Icon: ArrowsClockwise },
  { key: "capture", title: "Capture client conversations", sub: "Keep client emails organised against the right sale.", Icon: ChatCircleText },
  { key: "timeline", title: "Complete sale timeline", sub: "Every email, message and note in one place.", Icon: ListChecks },
];
const CHANNELS: { key: ChannelKey; name: string; sub: string }[] = [
  { key: "outlook", name: "Outlook", sub: "Email" },
  { key: "email", name: "Email provider", sub: "Send from your address" },
  { key: "whatsapp", name: "WhatsApp", sub: "Client conversations" },
];
const DISCONNECTED_BULLETS: Record<ChannelKey, string[]> = {
  outlook: ["Send and receive emails through Outlook", "Automatically chase outstanding updates", "Save replies to the correct sale", "Keep your sale timeline up to date"],
  email: ["Send emails from your own address", "Automatically chase outstanding updates", "Save replies to the correct sale", "Keep your sale timeline up to date"],
  whatsapp: ["Connect using WhatsApp's linked devices", "Capture conversations from your property groups", "Save messages to the correct sale", "Keep group conversations on your sale timeline"],
};
const TILES: { key: TileKey; label: string; logo: (s: number) => ReactNode }[] = [
  { key: "gmail", label: "Gmail", logo: (s) => <GmailLogo size={s} /> },
  { key: "yahoo", label: "Yahoo", logo: (s) => <YahooLogo size={s} /> },
  { key: "icloud", label: "iCloud", logo: (s) => <ICloudLogo size={s} /> },
  { key: "zoho", label: "Zoho Mail", logo: (s) => <ZohoLogo size={s} /> },
  { key: "exp", label: "eXp UK", logo: (s) => <ExpLogo size={s} /> },
  { key: "other", label: "Other", logo: (s) => <GenericMailLogo size={s} /> },
];
const PROVIDER_LABEL: Record<TileKey, string> = { gmail: "Gmail", yahoo: "Yahoo", icloud: "iCloud", zoho: "Zoho Mail", exp: "eXp UK", other: "Email" };
function provLogo(p: TileKey, size = 28): ReactNode { const t = TILES.find((x) => x.key === p); return t ? t.logo(size) : <GenericMailLogo size={size} />; }

function WhatsAppMark({ size = 34 }: { size?: number }) {
  const s = Math.round(size * 0.64);
  return (
    <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), background: "#25D366", display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.6 14c-.24.67-1.4 1.3-1.93 1.35-.5.05-1.12.07-1.8-.11a9.6 9.6 0 0 1-1.63-.6 8.3 8.3 0 0 1-3.2-2.83c-.24-.32-.9-1.2-.9-2.3 0-1.1.57-1.63.78-1.86a.82.82 0 0 1 .6-.28h.43c.14 0 .33-.05.5.4l.72 1.74c.06.13.1.28.01.45l-.27.42c-.12.17-.26.3-.11.56.14.26.63 1.04 1.36 1.68.93.83 1.72 1.08 1.97 1.2.25.13.4.1.54-.06l.76-.9c.17-.2.32-.15.54-.08l1.56.78c.22.1.37.16.42.25.06.13.06.63-.18 1.3Z" /></svg>
    </span>
  );
}
function ChannelLogo({ k, size = 34 }: { k: ChannelKey; size?: number }) {
  if (k === "outlook") return <OutlookLogo size={size} />;
  if (k === "whatsapp") return <WhatsAppMark size={size} />;
  return <GenericMailLogo size={size} />;
}
function Tick({ state }: { state: CellState }) {
  if (state === "na") return <span className="cxr-dash" aria-label="Not applicable">–</span>;
  return (
    <span className={`cxr-tick ${state}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      {state === "partial" && <span className="cxr-tick-dot" />}
    </span>
  );
}

export default function ConnectionsReworkPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewAs, setViewAs] = useState<ViewAs>("director");
  const [outlook, setOutlook] = useState<OutlookInbox[]>([]);
  const [email, setEmail] = useState<EmailInbox[]>([]);
  const [wa, setWa] = useState<Wa>({ status: "off" });
  const [autoTodos, setAutoTodos] = useState(false);
  const [dnsVerified, setDnsVerified] = useState(false);
  const [flow, setFlow] = useState<ChannelKey | null>(null);
  const [manage, setManage] = useState<ChannelKey | null>(null);
  const [toast, setToast] = useState<{ key: string; text: string } | null>(null);
  const idRef = useRef(0);
  const nid = () => `c${++idRef.current}`;

  function flash(key: string, text: string) { setToast({ key, text }); setTimeout(() => setToast((t) => (t?.key === key && t.text === text ? null : t)), 3000); }

  const emailHealth: "off" | "on" | "partial" = email.length === 0 ? "off" : email.some((e) => e.sending === "off" || e.reading === "limited") ? "partial" : "on";
  const emailSends = email.some((e) => e.sending === "on");

  function cell(cap: string, ch: ChannelKey): CellState {
    if (cap === "send") { if (ch === "whatsapp") return "na"; if (ch === "outlook") return outlook.length ? "on" : "off"; return email.length ? (emailHealth === "on" ? "on" : "partial") : "off"; }
    if (cap === "sendown") { if (ch === "whatsapp") return "na"; if (ch === "outlook") return outlook.length ? "on" : "off"; if (dnsVerified) return "on"; return email.length ? (emailSends ? "on" : "partial") : "off"; }
    if (cap === "chase") { if (ch === "whatsapp") return "na"; if (ch === "outlook") return outlook.length ? "on" : "off"; return email.length ? (emailSends ? "on" : "partial") : "off"; }
    if (cap === "capture") { if (ch !== "whatsapp") return "na"; return wa.status === "connected" ? "on" : "off"; }
    if (ch === "outlook") return outlook.length ? "on" : "off";
    if (ch === "email") return email.length ? "on" : "off";
    return wa.status === "connected" ? "on" : "off";
  }
  const headStatus = (ch: ChannelKey): { label: string; tone: "on" | "warn" | "off" } => {
    if (ch === "outlook") return outlook.length ? { label: `${outlook.length} connected`, tone: "on" } : { label: "Not connected", tone: "off" };
    if (ch === "email") return emailHealth === "off" ? { label: "Not connected", tone: "off" } : emailHealth === "partial" ? { label: "Needs attention", tone: "warn" } : { label: "Connected", tone: "on" };
    return wa.status === "connected" ? { label: "Connected", tone: "on" } : { label: "Not connected", tone: "off" };
  };
  const rowAchieved = (cap: string) => CHANNELS.some((c) => cell(cap, c.key) === "on");
  const anyConnected = outlook.length > 0 || email.length > 0 || wa.status === "connected";

  function onFlowDone(ch: ChannelKey, p: { email?: string; provider?: TileKey; sending?: boolean }) {
    if (ch === "outlook") setOutlook((prev) => [...prev, { id: nid(), email: p.email || "you@outlook.com" }]);
    if (ch === "email") setEmail((prev) => [...prev, { id: nid(), email: p.email || "you@youragency.co.uk", provider: p.provider || "other", reading: "on", sending: p.sending ? "on" : "off" }]);
    if (ch === "whatsapp") setWa({ status: "connected", phone: "+44 7508 862929" });
    setFlow(null);
  }

  return (
    <div className={`cxr-root ${theme}`} data-theme={theme}>
      <style>{CSS}</style>

      <div className="cxr-toolbar">
        <span className="cxr-badge">Prototype · fake data, nothing is wired up</span>
        <div className="cxr-tools">
          <div className="cxr-seg">
            <button className={viewAs === "director" ? "on" : ""} onClick={() => setViewAs("director")}>Agency director</button>
            <button className={viewAs === "member" ? "on" : ""} onClick={() => setViewAs("member")}>External member</button>
          </div>
          <button className="cxr-tool" onClick={() => { setOutlook([{ id: nid(), email: "ellis@kingsagency.co.uk" }]); setEmail([{ id: nid(), email: "ellis@kingsagency.co.uk", provider: "zoho", reading: "on", sending: "on" }]); setWa({ status: "connected", phone: "+44 7508 862929" }); setAutoTodos(true); }}>Connect all</button>
          <button className="cxr-tool" onClick={() => { setOutlook([]); setEmail([]); setWa({ status: "off" }); setAutoTodos(false); }}>Reset</button>
          <button className="cxr-tool" onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}>{theme === "light" ? "Dark" : "Light"}</button>
        </div>
      </div>

      <div className="cxr-page">
        <header className="cxr-head">
          <h1>Connections</h1>
          <p>{viewAs === "member" ? "Set how your emails send, and connect your inbox and WhatsApp so everything about the sales you progress lands on the right file." : "Set how your emails send, and connect the tools you already use. Everything about sending and receiving lives here."}</p>
        </header>

        {/* ── Capability matrix ─────────────────────────────────────────────── */}
        <section className="cxr-matrix">
          <div className="cxr-mrow cxr-mhead">
            <div className="cxr-mlabel"><span className="cxr-meyebrow">What you&rsquo;ll unlock</span><span className="cxr-meyebrow-sub">Connect an email provider below to enable these features.</span></div>
            {CHANNELS.map((c) => {
              const st = headStatus(c.key);
              return (
                <div key={c.key} className="cxr-mcol">
                  <ChannelLogo k={c.key} size={32} />
                  <span className="cxr-mcol-txt"><span className="cxr-mcol-name">{c.name}</span><span className="cxr-mcol-sub">{c.sub}</span></span>
                  <span className={`cxr-cdot ${st.tone}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
          {CAPS.map((cap) => (
            <div key={cap.key} className={`cxr-mrow ${rowAchieved(cap.key) ? "achieved" : ""}`}>
              <div className="cxr-mlabel cxr-mlabel-ico"><span className="cxr-capicon"><cap.Icon size={15} weight="bold" /></span><div><span className="cxr-cap-title">{cap.title}</span><span className="cxr-cap-sub">{cap.sub}</span></div></div>
              {CHANNELS.map((c) => <div key={c.key} className="cxr-mcell"><Tick state={cell(cap.key, c.key)} /></div>)}
            </div>
          ))}
        </section>
        {emailHealth === "partial" && <p className="cxr-attn">An amber tick means a connection is working but needs a look. Open its card and choose Manage to see what.</p>}

        <div className="cxr-sub"><h2>Your connections</h2><p>{anyConnected ? "Manage how you send and what's connected below." : "Set how you send, then connect your tools below."}</p></div>

        {/* ── Send from your own address (full width) ───────────────────────── */}
        <SendingAddress viewAs={viewAs} />

        {/* ── 3-card connection row ─────────────────────────────────────────── */}
        <section className="cxr-cards">
          {/* Outlook */}
          <ConnCard channel="outlook" name="Microsoft Outlook" status={headStatus("outlook")}>
            {outlook.length > 0 ? (
              <>
                <div className="cxr-sumline"><OutlookLogo size={20} /><span>{outlook.length === 1 ? outlook[0].email : `${outlook.length} inboxes connected`}</span></div>
                <div className="cxr-card-foot"><button className="cxr-btn ghost" onClick={() => setManage("outlook")}>Manage</button></div>
              </>
            ) : <Bullets channel="outlook" onConnect={() => setFlow("outlook")} />}
          </ConnCard>

          {/* Email */}
          <ConnCard channel="email" name="Every other provider" status={headStatus("email")}>
            {email.length > 0 ? (
              <>
                <div className="cxr-sumpills">
                  <span className={`cxr-pill ${emailSends ? "on" : "off"}`}>{emailSends ? "Sending on" : "Sending off"}</span>
                  <span className={`cxr-pill ${emailHealth === "partial" ? "warn" : "on"}`}>{email.length} inbox{email.length === 1 ? "" : "es"}</span>
                </div>
                <div className="cxr-card-foot"><button className="cxr-btn ghost" onClick={() => setManage("email")}>Manage</button></div>
              </>
            ) : (
              <>
                <Bullets channel="email" onConnect={() => setFlow("email")} />
              </>
            )}
          </ConnCard>

          {/* WhatsApp */}
          <ConnCard channel="whatsapp" name="WhatsApp" status={headStatus("whatsapp")}>
            {wa.status === "connected" ? (
              <>
                <div className="cxr-sumline"><WhatsAppMark size={20} /><span>{wa.phone}</span></div>
                <div className="cxr-card-foot"><button className="cxr-btn ghost" onClick={() => setManage("whatsapp")}>Manage</button></div>
              </>
            ) : <Bullets channel="whatsapp" onConnect={() => setFlow("whatsapp")} />}
          </ConnCard>
        </section>

        {/* ── Demo controls (prototype only) ───────────────────────────────── */}
        <section className="cxr-demo">
          <div className="cxr-demo-head">
            <span className="cxr-demo-t">Demo controls</span>
            <span className="cxr-demo-sub">Toggle states and watch the matrix above react</span>
          </div>
          <div className="cxr-demo-grid">
            {[
              { label: "Outlook linked", on: outlook.length > 0, toggle: () => setOutlook((o) => o.length ? [] : [{ id: nid(), email: "ellis@kingsagency.co.uk" }]) },
              { label: "Email provider connected", on: email.length > 0, toggle: () => setEmail((e) => e.length ? [] : [{ id: nid(), email: "ellis@kingsagency.co.uk", provider: "zoho" as TileKey, reading: "on" as const, sending: "on" as const }]) },
              { label: "Email sending on", on: emailSends, disabled: email.length === 0, toggle: () => setEmail((e) => e.map((x) => ({ ...x, sending: x.sending === "on" ? "off" : "on" }))) },
              { label: "Email reading limited", on: email.some((e) => e.reading === "limited"), disabled: email.length === 0, toggle: () => setEmail((e) => e.map((x) => ({ ...x, reading: x.reading === "limited" ? "on" : "limited" }))) },
              { label: "WhatsApp connected", on: wa.status === "connected", toggle: () => setWa((w) => w.status === "connected" ? { status: "off" } : { status: "connected", phone: "+44 7508 862929" }) },
              { label: "Domain verified (DNS)", on: dnsVerified, toggle: () => setDnsVerified((v) => !v) },
            ].map((t) => (
              <div key={t.label} className={`cxr-demo-row ${t.disabled ? "dim" : ""}`}>
                <span>{t.label}</span>
                <button role="switch" aria-checked={t.on} className={`cxr-switch ${t.on ? "on" : ""}`} disabled={t.disabled} onClick={t.toggle}><span /></button>
              </div>
            ))}
          </div>
          <p className="cxr-demo-note">Domain verified lights &ldquo;Send from your own address&rdquo; on its own, since a verified domain lets you send from your branded address without connecting an inbox. Turning email sending off (while connected) drops the email ticks to amber.</p>
        </section>
      </div>

      {flow && <ConnectFlow channel={flow} onClose={() => setFlow(null)} onDone={(p) => onFlowDone(flow, p)} />}

      {/* ── Manage modals ─────────────────────────────────────────────────── */}
      {manage === "outlook" && (
        <ManageModal title="Manage Outlook" onClose={() => setManage(null)}>
          <ul className="cxr-inboxes">
            {outlook.map((i) => (
              <li key={i.id}>
                <div className="cxr-ibx-id"><OutlookLogo size={26} /><span className="cxr-ibx-email">{i.email}</span></div>
                <div className="cxr-ibx-acts">
                  <button className="cxr-mini" onClick={() => flash(i.id, "Inbox checked.")}>Check now</button>
                  <button className="cxr-mini danger" onClick={() => setOutlook((p) => p.filter((x) => x.id !== i.id))}>Disconnect</button>
                </div>
                {toast?.key === i.id && <p className="cxr-ibx-note">{toast.text}</p>}
              </li>
            ))}
          </ul>
          <button className="cxr-link" onClick={() => { setManage(null); setFlow("outlook"); }}>+ Connect another inbox</button>
        </ManageModal>
      )}

      {manage === "email" && (
        <ManageModal title="Manage email inboxes" onClose={() => setManage(null)}>
          <ul className="cxr-inboxes">
            {email.map((i) => (
              <li key={i.id}>
                <div className="cxr-ibx-id">
                  {provLogo(i.provider, 26)}
                  <div style={{ minWidth: 0 }}>
                    <div className="cxr-ibx-email">{i.email} <span className="cxr-ibx-tag">{PROVIDER_LABEL[i.provider]}</span></div>
                    <div className="cxr-pills">
                      <span className={`cxr-pill ${i.sending === "on" ? "on" : "off"}`}>{i.sending === "on" ? "Sending on" : "Sending off"}</span>
                      <span className={`cxr-pill ${i.reading === "limited" ? "warn" : i.reading === "on" ? "on" : "off"}`}>{i.reading === "limited" ? "Reading limited" : i.reading === "on" ? "Reading on" : "Reading not checked"}</span>
                    </div>
                    {i.reading === "limited" && <p className="cxr-ibx-note warn">Your provider limited reading just now, common with eXp and Zoho. We&rsquo;ll keep trying. Your sending isn&rsquo;t affected.</p>}
                    {toast?.key === i.id && <p className="cxr-ibx-note">{toast.text}</p>}
                  </div>
                </div>
                <div className="cxr-ibx-acts">
                  <button className="cxr-mini" onClick={() => setEmail((p) => p.map((x) => x.id === i.id ? { ...x, sending: x.sending === "on" ? "off" : "on" } : x))}>{i.sending === "on" ? "Turn off sending" : "Turn on sending"}</button>
                  {i.sending === "on" && <button className="cxr-mini" onClick={() => flash(i.id, "Test sent. Check this inbox.")}>Send test</button>}
                  <button className="cxr-mini" onClick={() => flash(i.id, "Checked. No new matching emails.")}>Check reading</button>
                  <button className="cxr-mini danger" onClick={() => setEmail((p) => p.filter((x) => x.id !== i.id))}>Disconnect</button>
                </div>
              </li>
            ))}
          </ul>
          <button className="cxr-link" onClick={() => { setManage(null); setFlow("email"); }}>+ Connect another inbox</button>
        </ManageModal>
      )}

      {manage === "whatsapp" && (
        <ManageModal title="Manage WhatsApp" onClose={() => setManage(null)}>
          <ul className="cxr-inboxes">
            <li>
              <div className="cxr-ibx-id"><WhatsAppMark size={26} /><span className="cxr-ibx-email">{wa.phone}</span></div>
              <div className="cxr-ibx-acts"><button className="cxr-mini danger" onClick={() => { setWa({ status: "off" }); setAutoTodos(false); setManage(null); }}>Disconnect</button></div>
            </li>
          </ul>
          {viewAs === "director" ? (
            <div className="cxr-todos">
              <div><span className="cxr-todos-t">Turn WhatsApp updates into to-dos</span><span className="cxr-todos-s">When someone promises something in a property chat, we&rsquo;ll add a to-do to that sale.</span></div>
              <button role="switch" aria-checked={autoTodos} className={`cxr-switch ${autoTodos ? "on" : ""}`} onClick={() => setAutoTodos((v) => !v)}><span /></button>
            </div>
          ) : <p className="cxr-sendnote" style={{ margin: 0 }}>Your director controls whether WhatsApp updates become to-dos.</p>}
        </ManageModal>
      )}
    </div>
  );
}

// ── Send-from-your-own-address section (single sender + domain/DNS) ──────────
function SendingAddress({ viewAs }: { viewAs: ViewAs }) {
  type View = "rest" | "method" | "single" | "single-sent" | "domain" | "verified";
  const [view, setView] = useState<View>("rest");
  const [method, setMethod] = useState<"single" | "domain" | null>(null);
  const [addr, setAddr] = useState("");
  const [verified, setVerified] = useState<string | null>(null);
  const PLATFORM = "updates@thesalesprogressor.co.uk";

  const records = [
    { host: "em1234.youragency.co.uk", type: "CNAME", data: "u1234.wl.sendgrid.net" },
    { host: "s1._domainkey.youragency.co.uk", type: "CNAME", data: "s1.domainkey.u1234.wl.sendgrid.net" },
    { host: "s2._domainkey.youragency.co.uk", type: "CNAME", data: "s2.domainkey.u1234.wl.sendgrid.net" },
  ];

  return (
    <section className="cxr-sender">
      <div className="cxr-sender-head">
        <div><h3>Send from your own address</h3><p>Clients see emails come from you, with replies landing straight in your inbox. {viewAs === "member" ? "This is your default sender for any client without its own address." : ""}</p></div>
        {verified ? <span className="cxr-status on"><span className="cxr-status-dot" />Verified</span> : <span className="cxr-status"><span className="cxr-status-dot" />Using default address</span>}
      </div>

      {view === "rest" && (
        <div className="cxr-sender-body">
          <div className="cxr-fromcard">
            <span className="cxr-from-ava">{verified ? "✓" : "✉"}</span>
            <div><span className="cxr-from-lab">From</span><span className="cxr-from-addr">{verified ?? PLATFORM}</span></div>
            <span className={`cxr-pill ${verified ? "on" : "off"}`}>{verified ? "Verified" : "Default"}</span>
          </div>
          <div className="cxr-card-foot" style={{ marginTop: 14 }}>
            <button className="cxr-btn primary" onClick={() => { setMethod(null); setView("method"); }}>{verified ? "Change sending address" : "Set up your address"}</button>
          </div>
          {!verified && <p className="cxr-dns-hint">Two ways to do this: verify one address with a link we email you (no DNS), or verify your whole domain. Connecting an inbox below also sends from your own address.</p>}
        </div>
      )}

      {view === "method" && (
        <div className="cxr-sender-body">
          <button className={`cxr-method ${method === "single" ? "on" : ""}`} onClick={() => setMethod("single")}>
            <span className="cxr-method-top"><b>Single sender</b><span className="cxr-rec">Easiest</span></span>
            <span className="cxr-method-sub">Verify one address with a link we email you. No DNS. Around 2 minutes. Replies go straight to that inbox.</span>
          </button>
          <button className={`cxr-method ${method === "domain" ? "on" : ""}`} onClick={() => setMethod("domain")}>
            <span className="cxr-method-top"><b>Verify your domain</b></span>
            <span className="cxr-method-sub">Add a few records to your domain settings once, then send from any address on it. Around 10 minutes.</span>
          </button>
          <div className="cxr-card-foot" style={{ marginTop: 6 }}>
            <button className="cxr-btn ghost" onClick={() => setView("rest")}>Back</button>
            <button className="cxr-btn primary" disabled={!method} onClick={() => setView(method === "single" ? "single" : "domain")}>Continue</button>
          </div>
        </div>
      )}

      {view === "single" && (
        <div className="cxr-sender-body">
          <label className="cxr-field">Email address<input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="you@youragency.co.uk" /></label>
          <p className="cxr-dns-hint" style={{ marginTop: 8 }}>Use an address you can open. We&rsquo;ll email it a verification link.</p>
          <div className="cxr-card-foot" style={{ marginTop: 14 }}>
            <button className="cxr-btn ghost" onClick={() => setView("method")}>Back</button>
            <button className="cxr-btn primary" disabled={!addr.includes("@")} onClick={() => setView("single-sent")}>Send verification email</button>
          </div>
        </div>
      )}

      {view === "single-sent" && (
        <div className="cxr-sender-body">
          <p className="cxr-lead" style={{ marginBottom: 10 }}>We&rsquo;ve emailed a verification link to <b>{addr}</b>. Rather than clicking the button inside, copy its link and paste it below.</p>
          <label className="cxr-field">Verification link<input placeholder="Paste your verification link here" /></label>
          <div className="cxr-card-foot" style={{ marginTop: 14 }}>
            <button className="cxr-btn ghost" onClick={() => setView("single")}>Back</button>
            <button className="cxr-btn primary" onClick={() => { setVerified(addr); setView("verified"); }}>Verify email address</button>
          </div>
        </div>
      )}

      {view === "domain" && (
        <div className="cxr-sender-body">
          <label className="cxr-field">Sending email address<input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="you@youragency.co.uk" /></label>
          <p className="cxr-dns-hint" style={{ marginTop: 8 }}>Replies from buyers and sellers will go directly to this inbox.</p>
          <div className="cxr-card-foot" style={{ marginTop: 14 }}>
            <button className="cxr-btn ghost" onClick={() => setView("method")}>Back</button>
            <button className="cxr-btn primary" disabled={!addr.includes("@")} onClick={() => setView("domain")}>Get setup instructions</button>
          </div>
          <div className="cxr-records">
            <p className="cxr-field" style={{ marginTop: 16 }}>Add these records to your domain, then verify</p>
            <div className="cxr-rec-table">
              <div className="cxr-rec-h"><span>Type</span><span>Host</span><span>Value</span></div>
              {records.map((r) => <div key={r.host} className="cxr-rec-r"><span>{r.type}</span><span className="mono">{r.host}</span><span className="mono">{r.data}</span></div>)}
            </div>
            <div className="cxr-card-foot" style={{ marginTop: 12 }}>
              <button className="cxr-btn primary" onClick={() => { setVerified(addr || "you@youragency.co.uk"); setView("verified"); }}>Verify domain</button>
            </div>
          </div>
        </div>
      )}

      {view === "verified" && (
        <div className="cxr-sender-body">
          <div className="cxr-ok"><span className="cxr-ok-ck">✓</span><span><b>You&rsquo;re all set.</b> Emails now send from {verified}, with replies coming straight back to it.</span></div>
          <div className="cxr-fromcard" style={{ marginTop: 12 }}>
            <span className="cxr-from-ava">✓</span>
            <div><span className="cxr-from-lab">From</span><span className="cxr-from-addr">{verified}</span></div>
            <span className="cxr-pill on">Verified</span>
          </div>
          <div className="cxr-card-foot" style={{ marginTop: 14 }}><button className="cxr-btn ghost" onClick={() => { setMethod(null); setView("method"); }}>Change sending address</button></div>
        </div>
      )}
    </section>
  );
}

function Bullets({ channel, onConnect }: { channel: ChannelKey; onConnect: () => void }) {
  return (
    <>
      <ul className="cxr-bullets">{DISCONNECTED_BULLETS[channel].map((b) => <li key={b}><span className="cxr-bul-ring" />{b}</li>)}</ul>
      <div className="cxr-card-foot"><button className="cxr-btn primary" onClick={onConnect}>{channel === "outlook" ? "Connect Outlook" : channel === "email" ? "Connect email provider" : "Connect WhatsApp"}</button></div>
    </>
  );
}

function ConnCard({ channel, name, status, children }: { channel: ChannelKey; name: string; status: { label: string; tone: "on" | "warn" | "off" }; children: ReactNode }) {
  return (
    <article className={`cxr-card ${status.tone === "on" ? "on" : status.tone === "warn" ? "warn" : ""}`}>
      <div className="cxr-card-top">
        <ChannelLogo k={channel} size={38} />
        <div className="cxr-card-id">
          <span className="cxr-card-name">{name}</span>
          <span className={`cxr-status ${status.tone}`}><span className="cxr-status-dot" />{status.label}</span>
        </div>
      </div>
      {children}
    </article>
  );
}

function ManageModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="cxr-overlay" onClick={onClose}>
      <div className="cxr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cxr-modal-head"><h3>{title}</h3><button className="cxr-x" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="cxr-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ConnectFlow({ channel, onClose, onDone }: { channel: ChannelKey; onClose: () => void; onDone: (p: { email?: string; provider?: TileKey; sending?: boolean }) => void }) {
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState(false);
  const [provider, setProvider] = useState<TileKey | null>(null);
  const [addr, setAddr] = useState("");
  const [sending, setSending] = useState(true);
  const [busy, setBusy] = useState(false);
  function finish(p: { email?: string; provider?: TileKey; sending?: boolean }) { setBusy(true); setTimeout(() => onDone(p), 850); }
  const title = channel === "outlook" ? "Connect Microsoft Outlook" : channel === "email" ? "Connect your email provider" : "Link your WhatsApp";
  return (
    <div className="cxr-overlay" onClick={onClose}>
      <div className="cxr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cxr-modal-head"><ChannelLogo k={channel} size={30} /><h3>{title}</h3><button className="cxr-x" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="cxr-modal-body">
          {channel === "outlook" && (<><p className="cxr-lead">Connect your work inbox so replies save to the right sale. Emails you send come from your Outlook account and show in Sent Items.</p><label className="cxr-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I agree that Sales Progressor can read emails relating to my sales and send on my behalf. I can disconnect at any time.</span></label></>)}
          {channel === "email" && step === 0 && (<><p className="cxr-lead">Choose your provider and connect with an app password. We&rsquo;ll show the exact steps and finish with a test email.</p><div className="cxr-provgrid">{TILES.map((t) => <button key={t.key} className={`cxr-prov ${provider === t.key ? "sel" : ""}`} onClick={() => setProvider(t.key)}>{t.logo(30)}<span>{t.label}</span></button>)}</div></>)}
          {channel === "email" && step === 1 && (<><p className="cxr-lead">Enter your address and an app password (not your normal password).</p><div className="cxr-fields"><label>Email address<input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="you@youragency.co.uk" /></label><label>App password<input placeholder="app password (not your normal password)" /></label></div><label className="cxr-check cxr-send"><input type="checkbox" checked={sending} onChange={(e) => setSending(e.target.checked)} /><span><b>Send my emails from this address too.</b> Emails go through your mailbox, appear in your Sent folder, and replies come back to you.</span></label><label className="cxr-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I agree that Sales Progressor can access emails relating to my sales. I can disconnect at any time.</span></label></>)}
          {channel === "whatsapp" && step === 0 && (<><p className="cxr-lead">Link your WhatsApp so your property group chats appear on the right sale, with nothing to copy across.</p><ul className="cxr-facts"><li><b>What appears on your files:</b> only messages from groups named &ldquo;Sale of [address]&rdquo; or &ldquo;Purchase of [address]&rdquo; that match one of your live sales.</li><li><b>What we never see:</b> your one-to-one chats or groups that aren&rsquo;t linked to a property.</li></ul><label className="cxr-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I understand and want to link my WhatsApp.</span></label></>)}
          {channel === "whatsapp" && step === 1 && (<div className="cxr-qr-wrap"><div className="cxr-qr" aria-hidden><svg width="140" height="140" viewBox="0 0 140 140"><rect width="140" height="140" rx="10" fill="#fff" />{Array.from({ length: 196 }).map((_, i) => { const x = (i % 14) * 10, y = Math.floor(i / 14) * 10; return (i * 7) % 3 === 0 ? <rect key={i} x={x} y={y} width="10" height="10" fill="#111" /> : null; })}<rect x="0" y="0" width="30" height="30" fill="#fff" stroke="#111" strokeWidth="6" /><rect x="110" y="0" width="30" height="30" fill="#fff" stroke="#111" strokeWidth="6" /><rect x="0" y="110" width="30" height="30" fill="#fff" stroke="#111" strokeWidth="6" /></svg></div><p className="cxr-lead" style={{ textAlign: "center" }}>On your phone: WhatsApp → Linked devices → Link a device, then scan.</p></div>)}
          {busy && <div className="cxr-busy"><span className="cxr-spin" /> {channel === "email" ? "Sending a test email…" : "Connecting…"}</div>}
        </div>
        <div className="cxr-modal-foot">
          {channel === "outlook" && <button className="cxr-btn primary" disabled={!agree || busy} onClick={() => finish({})}>Connect my inbox</button>}
          {channel === "email" && step === 0 && <button className="cxr-btn primary" disabled={!provider} onClick={() => setStep(1)}>Continue</button>}
          {channel === "email" && step === 1 && <button className="cxr-btn primary" disabled={!agree || busy} onClick={() => finish({ email: addr.trim() || undefined, provider: provider || "other", sending })}>Connect my inbox</button>}
          {channel === "whatsapp" && step === 0 && <button className="cxr-btn primary" disabled={!agree} onClick={() => setStep(1)}>Show my QR code</button>}
          {channel === "whatsapp" && step === 1 && <button className="cxr-btn primary" disabled={busy} onClick={() => finish({})}>I&rsquo;ve scanned it</button>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.cxr-root{--coral:#FF6B4A;--coral-deep:#E8542F;min-height:100vh;font-family:-apple-system,"Segoe UI",system-ui,sans-serif;transition:background .3s ease,color .3s ease}
.cxr-root.light{--bg1:#f8f5f1;--bg2:#efe9e2;--card:#ffffff;--card2:#fbf9f7;--text:#1b1512;--muted:#78706a;--faint:#a9a19b;--line:rgba(27,21,18,.09);--line2:rgba(27,21,18,.06);--green:#1f9d57;--green-bg:rgba(31,157,87,.12);--amber:#c9821b;--amber-bg:rgba(201,130,27,.14);--red:#cf4a44;background:radial-gradient(130% 90% at 80% -10%,#efe7f3 0%,var(--bg1) 42%,var(--bg2) 100%);color:var(--text)}
.cxr-root.dark{--bg1:#0f1218;--bg2:#0a0c11;--card:#171b23;--card2:#13161d;--text:#f0eeec;--muted:#9aa0ab;--faint:#5c6472;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.05);--green:#36d27f;--green-bg:rgba(54,210,127,.14);--amber:#e0a23c;--amber-bg:rgba(224,162,60,.16);--red:#f0736c;background:radial-gradient(130% 90% at 80% -10%,#1b1726 0%,var(--bg1) 45%,var(--bg2) 100%);color:var(--text)}

.cxr-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;backdrop-filter:blur(10px);background:color-mix(in srgb,var(--bg1) 72%,transparent);border-bottom:1px solid var(--line2);flex-wrap:wrap}
.cxr-badge{font-size:11.5px;font-weight:600;color:var(--muted)}
.cxr-tools{display:flex;gap:7px;align-items:center}
.cxr-tool{font-family:inherit;font-size:12px;font-weight:600;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:9px;padding:6px 12px;cursor:pointer;transition:all .15s}
.cxr-tool:hover{border-color:var(--coral);color:var(--coral-deep)}
.cxr-seg{display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:2px}
.cxr-seg button{font-family:inherit;font-size:12px;font-weight:600;color:var(--muted);background:none;border:none;border-radius:7px;padding:5px 11px;cursor:pointer}
.cxr-seg button.on{background:var(--coral);color:#fff}

.cxr-page{max-width:980px;margin:0 auto;padding:36px 24px 90px}
.cxr-head h1{margin:0;font-size:30px;font-weight:720;letter-spacing:-.02em}
.cxr-head p{margin:8px 0 0;font-size:14px;color:var(--muted);max-width:640px}

.cxr-matrix{margin-top:28px;background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.03),0 20px 50px -30px rgba(0,0,0,.25)}
.cxr-mrow{display:grid;grid-template-columns:minmax(0,1fr) 150px 150px 150px;align-items:center}
.cxr-mhead{border-bottom:1px solid var(--line);background:var(--card2)}
.cxr-mlabel{padding:18px 22px;min-width:0}
.cxr-meyebrow{font-size:14px;font-weight:700;letter-spacing:-.01em}
.cxr-mcol{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;text-align:center;border-left:1px solid var(--line2)}
.cxr-mcol-txt{display:flex;flex-direction:column;line-height:1.2}
.cxr-mcol-name{font-size:13px;font-weight:680}
.cxr-mcol-sub{font-size:10.5px;color:var(--muted)}
.cxr-cdot{font-size:9.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--faint);padding:2px 8px;border-radius:999px;border:1px solid var(--line);transition:all .3s;white-space:nowrap}
.cxr-cdot.on{color:var(--green);border-color:color-mix(in srgb,var(--green) 40%,transparent);background:var(--green-bg)}
.cxr-cdot.warn{color:var(--amber);border-color:color-mix(in srgb,var(--amber) 42%,transparent);background:var(--amber-bg)}
.cxr-matrix .cxr-mrow:not(.cxr-mhead){border-top:1px solid var(--line2);transition:background .3s}
.cxr-mrow.achieved{background:linear-gradient(90deg,color-mix(in srgb,var(--green) 7%,transparent),transparent 60%)}
.cxr-cap-title{display:block;font-size:13.5px;font-weight:620}
.cxr-cap-sub{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
.cxr-mcell{display:grid;place-items:center;padding:16px 10px;border-left:1px solid var(--line2);align-self:stretch}
.cxr-dash{color:var(--faint);font-size:17px;opacity:.5}
.cxr-tick{position:relative;display:grid;place-items:center;width:26px;height:26px;border-radius:999px;transition:all .35s cubic-bezier(.34,1.56,.64,1)}
.cxr-tick.off{color:var(--faint);background:transparent;border:1.5px dashed color-mix(in srgb,var(--faint) 55%,transparent);opacity:.65}
.cxr-tick.on{color:#fff;background:var(--green);border:1.5px solid var(--green);box-shadow:0 4px 12px -2px color-mix(in srgb,var(--green) 55%,transparent);transform:scale(1.04)}
.cxr-tick.partial{color:#fff;background:var(--amber);border:1.5px solid var(--amber);box-shadow:0 4px 12px -2px color-mix(in srgb,var(--amber) 55%,transparent)}
.cxr-tick-dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--amber);border:1.5px solid var(--card)}
.cxr-attn{margin:12px 2px 0;font-size:12px;color:var(--amber)}

.cxr-sub{margin:36px 2px 14px}
.cxr-sub h2{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em}
.cxr-sub p{margin:5px 0 0;font-size:13px;color:var(--muted)}

/* Sending-address section (full width) */
.cxr-sender{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;margin-bottom:16px}
.cxr-sender-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.cxr-sender-head h3{margin:0;font-size:16px;font-weight:700;letter-spacing:-.01em}
.cxr-sender-head p{margin:5px 0 0;font-size:13px;color:var(--muted);max-width:560px;line-height:1.5}
.cxr-sender-body{margin-top:16px}
.cxr-fromcard{display:flex;align-items:center;gap:12px;padding:13px 15px;border:1px solid var(--line);border-radius:13px;background:var(--card2)}
.cxr-from-ava{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(145deg,var(--coral),var(--coral-deep))}
.cxr-from-lab{display:block;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.cxr-from-addr{display:block;font-size:13.5px;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:2px}
.cxr-fromcard .cxr-pill{margin-left:auto}
.cxr-method{display:block;width:100%;text-align:left;border:1.5px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--card2);cursor:pointer;margin-bottom:10px;transition:all .15s;color:inherit;font-family:inherit}
.cxr-method:hover{border-color:color-mix(in srgb,var(--coral) 55%,transparent)}
.cxr-method.on{border-color:var(--coral);box-shadow:0 0 0 2px color-mix(in srgb,var(--coral) 24%,transparent)}
.cxr-method-top{display:flex;align-items:center;gap:10px;font-size:14px}
.cxr-method-top b{font-weight:700}
.cxr-rec{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--coral-deep);border:1px solid color-mix(in srgb,var(--coral) 32%,transparent);border-radius:6px;padding:2px 7px}
.cxr-method-sub{display:block;margin-top:6px;font-size:12.5px;color:var(--muted);line-height:1.5}
.cxr-records{margin-top:4px}
.cxr-rec-table{border:1px solid var(--line);border-radius:11px;overflow:hidden;margin-top:8px;font-size:11.5px}
.cxr-rec-h,.cxr-rec-r{display:grid;grid-template-columns:70px 1fr 1fr;gap:10px;padding:9px 12px}
.cxr-rec-h{background:var(--card2);font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;font-size:10px}
.cxr-rec-r{border-top:1px solid var(--line2)}
.cxr-rec-r .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.cxr-field{display:block;font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px}
.cxr-field input{width:100%;margin-top:6px;font-family:inherit;font-size:13px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card2);color:var(--text)}
.cxr-field input:focus{outline:none;border-color:var(--coral)}
.cxr-ok{display:flex;align-items:center;gap:11px;background:var(--green-bg);border:1px solid color-mix(in srgb,var(--green) 28%,transparent);border-radius:12px;padding:12px 14px;font-size:13px}
.cxr-ok b{font-weight:700}
.cxr-ok-ck{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;color:#fff;font-weight:800;background:var(--green)}

.cxr-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.cxr-card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;transition:border-color .3s}
.cxr-card.on{border-color:color-mix(in srgb,var(--green) 30%,var(--line))}
.cxr-card.warn{border-color:color-mix(in srgb,var(--amber) 34%,var(--line))}
.cxr-card-top{display:flex;align-items:flex-start;gap:11px;margin-bottom:14px}
.cxr-card-id{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.cxr-card-name{font-size:14px;font-weight:680;letter-spacing:-.01em}
.cxr-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:650;color:var(--muted);white-space:nowrap}
.cxr-status-dot{width:7px;height:7px;border-radius:50%;background:var(--faint)}
.cxr-status.on{color:var(--green)}.cxr-status.on .cxr-status-dot{background:var(--green);box-shadow:0 0 0 3px var(--green-bg)}
.cxr-status.warn{color:var(--amber)}.cxr-status.warn .cxr-status-dot{background:var(--amber);box-shadow:0 0 0 3px var(--amber-bg)}
.cxr-sumline{display:flex;align-items:center;gap:9px;font-size:12.5px;font-weight:600;margin-bottom:14px;overflow-wrap:anywhere}
.cxr-sumpills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.cxr-bullets{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:9px;flex:1}
.cxr-bullets li{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--muted)}
.cxr-bul-ring{width:13px;height:13px;border-radius:50%;border:1.5px solid var(--faint);opacity:.6;flex-shrink:0}
.cxr-card-foot{display:flex;gap:8px;margin-top:auto}
.cxr-btn{font-family:inherit;font-size:13px;font-weight:650;border-radius:11px;padding:10px 16px;cursor:pointer;border:1px solid transparent;transition:all .16s}
.cxr-btn.primary{color:#fff;background:linear-gradient(180deg,var(--coral),var(--coral-deep));box-shadow:0 6px 16px -6px var(--coral-deep)}
.cxr-btn.primary:hover{filter:brightness(1.05)}
.cxr-btn.primary:disabled{opacity:.5;cursor:default;filter:none}
.cxr-btn.ghost{background:var(--card2);border-color:var(--line);color:var(--text)}
.cxr-btn.ghost:hover{border-color:var(--coral);color:var(--coral-deep)}
.cxr-pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.cxr-pill.on{color:var(--green);border-color:color-mix(in srgb,var(--green) 40%,transparent);background:var(--green-bg)}
.cxr-pill.warn{color:var(--amber);border-color:color-mix(in srgb,var(--amber) 42%,transparent);background:var(--amber-bg)}
.cxr-dns-hint{margin:12px 0 0;font-size:11.5px;color:var(--muted);line-height:1.5}.cxr-dns-hint b{color:var(--text)}

/* manage modal inbox rows */
.cxr-inboxes{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-direction:column;gap:9px}
.cxr-inboxes li{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--line);border-radius:13px;background:var(--card2);flex-wrap:wrap}
.cxr-ibx-id{display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1}
.cxr-ibx-email{font-size:13px;font-weight:600;overflow-wrap:anywhere}
.cxr-ibx-tag{font-size:10px;font-weight:600;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:1px 6px;margin-left:4px}
.cxr-pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.cxr-ibx-note{margin:7px 0 0;font-size:11.5px;line-height:1.45;color:var(--muted);width:100%}
.cxr-ibx-note.warn{color:var(--amber)}
.cxr-ibx-acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.cxr-mini{font-family:inherit;font-size:11.5px;font-weight:600;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer;transition:all .14s}
.cxr-mini:hover{border-color:var(--coral);color:var(--coral-deep)}
.cxr-mini.danger{color:var(--muted)}.cxr-mini.danger:hover{border-color:var(--red);color:var(--red)}
.cxr-link{align-self:flex-start;font-family:inherit;font-size:12.5px;font-weight:650;color:var(--coral-deep);background:none;border:none;cursor:pointer;padding:4px 0}
.cxr-sendnote{font-size:12px;line-height:1.5;color:var(--muted);border-left:2px solid var(--coral);padding-left:10px}
.cxr-todos{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:13px;background:var(--card2)}
.cxr-todos-t{display:block;font-size:13px;font-weight:650}
.cxr-todos-s{display:block;font-size:11.5px;color:var(--muted);margin-top:2px;line-height:1.45}
.cxr-switch{flex-shrink:0;width:42px;height:24px;border-radius:999px;border:none;background:var(--faint);cursor:pointer;position:relative;transition:background .2s}
.cxr-switch.on{background:var(--coral)}
.cxr-switch span{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s}
.cxr-switch.on span{transform:translateX(18px)}

.cxr-overlay{position:fixed;inset:0;z-index:40;background:rgba(10,8,6,.42);backdrop-filter:blur(4px);display:grid;place-items:center;padding:20px;animation:cxrFade .18s ease}
.cxr-modal{width:min(520px,100%);max-height:88vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 30px 80px -20px rgba(0,0,0,.55);animation:cxrPop .26s cubic-bezier(.34,1.56,.64,1)}
.cxr-modal-head{display:flex;align-items:center;gap:11px;padding:16px 18px;border-bottom:1px solid var(--line2)}
.cxr-modal-head h3{flex:1;margin:0;font-size:15px;font-weight:700}
.cxr-x{border:none;background:none;color:var(--muted);font-size:15px;cursor:pointer;width:26px;height:26px;border-radius:7px}
.cxr-x:hover{background:var(--line2);color:var(--text)}
.cxr-modal-body{padding:18px}
.cxr-lead{margin:0 0 14px;font-size:13px;line-height:1.55;color:var(--muted)}.cxr-lead b{color:var(--text)}
.cxr-check{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.5;cursor:pointer}
.cxr-check input{margin-top:2px}.cxr-check b{font-weight:650}
.cxr-send{margin-bottom:12px}
.cxr-provgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.cxr-prov{display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 8px;border:1px solid var(--line);border-radius:12px;background:var(--card2);cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;color:var(--text);transition:all .15s}
.cxr-prov:hover{border-color:var(--coral)}
.cxr-prov.sel{border-color:var(--coral);box-shadow:0 0 0 2px color-mix(in srgb,var(--coral) 30%,transparent)}
.cxr-fields{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}
.cxr-fields label{display:flex;flex-direction:column;gap:5px;font-size:11.5px;font-weight:650;color:var(--muted)}
.cxr-fields input{font-family:inherit;font-size:13px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card2);color:var(--text)}
.cxr-fields input:focus{outline:none;border-color:var(--coral)}
.cxr-facts{margin:0 0 14px;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px;font-size:12.5px;line-height:1.5;color:var(--muted)}
.cxr-facts b{color:var(--text)}
.cxr-qr-wrap{display:flex;flex-direction:column;align-items:center;gap:14px;padding:6px 0}
.cxr-qr{padding:10px;background:#fff;border-radius:14px;box-shadow:0 10px 30px -10px rgba(0,0,0,.4)}
.cxr-busy{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:12.5px;font-weight:600;color:var(--muted)}
.cxr-spin{width:15px;height:15px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--coral);animation:cxrSpin .7s linear infinite}
.cxr-modal-foot{display:flex;padding:14px 18px;border-top:1px solid var(--line2)}
.cxr-modal-foot .cxr-btn.primary{flex:1}

@keyframes cxrFade{from{opacity:0}to{opacity:1}}
@keyframes cxrPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@keyframes cxrSpin{to{transform:rotate(360deg)}}

@media (max-width:820px){.cxr-cards{grid-template-columns:1fr}}
@media (max-width:720px){.cxr-mrow{grid-template-columns:minmax(0,1fr) 72px 72px 72px}.cxr-mcol-sub,.cxr-cdot{display:none}.cxr-rec-h,.cxr-rec-r{grid-template-columns:56px 1fr}.cxr-rec-h span:last-child,.cxr-rec-r span:last-child{display:none}}

/* matrix: header sub + per-row icon chips */
.cxr-meyebrow-sub{display:block;margin-top:4px;font-size:11.5px;font-weight:500;color:var(--muted)}
.cxr-mlabel-ico{display:flex;align-items:flex-start;gap:12px}
.cxr-capicon{flex-shrink:0;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--card2);color:var(--muted);border:1px solid var(--line2);margin-top:1px}

/* demo controls (prototype only) */
.cxr-demo{margin-top:22px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}
.cxr-demo-head{display:flex;flex-direction:column;margin-bottom:14px}
.cxr-demo-t{font-size:15px;font-weight:700}
.cxr-demo-sub{font-size:12px;color:var(--muted);margin-top:2px}
.cxr-demo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.cxr-demo-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card2);font-size:13px;font-weight:600}
.cxr-demo-row.dim{opacity:.5}
.cxr-demo-row .cxr-switch:disabled{cursor:not-allowed}
.cxr-demo-note{margin:12px 0 0;font-size:11.5px;color:var(--muted);line-height:1.5}
@media (max-width:620px){.cxr-demo-grid{grid-template-columns:1fr}}
`;
