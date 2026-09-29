"use client";

// Founder-only "what to work on next" cockpit (critiques #12 + #29).
// Active outsourced files aged by last human contact per side; act on a side and
// the file drops to the bottom (FLIP), an ever-revolving list. Reads real data
// from getNextFiles; each action logs a human touch via logCommAction and opens
// the channel (tel / wa.me / mailto). Founder-gated by the page, not here.

import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Phone, EnvelopeSimple, WhatsappLogo } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import { logCommAction } from "@/app/actions/comms";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { CockpitFile, CockpitSide } from "@/lib/services/next-files";

const QUIET_THRESHOLD = 5; // working days with no touch = "gone quiet"
const COVERAGE_WINDOW_MS = 10 * 86400000; // 10 calendar days
const NEVER = 9999;

type Channel = "phone" | "email" | "whatsapp";

const METHOD_VERB: Record<string, string> = {
  phone: "call", email: "email", whatsapp: "WhatsApp", sms: "text",
  voicemail: "voicemail", post: "post", portal: "portal update", message: "message",
};

function splitAddr(a: string): { line: string; loc: string } {
  const i = a.indexOf(",");
  return i === -1 ? { line: a, loc: "" } : { line: a.slice(0, i), loc: a.slice(i + 1).trim() };
}

// UK number → wa.me digits (leading 0 → 44). Mirrors WhatsappGroupModal.toWaDigits.
function toWaDigits(phone: string): string {
  let d = phone.replace(/[\s\-().+]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  return d;
}

function quietText(n: number | null): string {
  if (n === null) return "not contacted yet";
  if (n === 0) return "today";
  return `${n} working day${n === 1 ? "" : "s"} ago`;
}

function fileBadge(n: number): { tone: "danger" | "warning" | "muted" | "success"; label: string } {
  if (n >= NEVER) return { tone: "danger", label: "Never contacted" };
  if (n >= QUIET_THRESHOLD) return { tone: "danger", label: `Quiet ${n} working days` };
  if (n >= 3) return { tone: "warning", label: `Quiet ${n} working days` };
  if (n <= 0) return { tone: "success", label: "Touched today" };
  return { tone: "muted", label: `Quiet ${n} working days` };
}

export function FilesCockpit({ initialFiles }: { initialFiles: CockpitFile[] }) {
  const { toast } = useAgentToast();
  const [files, setFiles] = useState<CockpitFile[]>(initialFiles);
  const listRef = useRef<HTMLDivElement>(null);

  const { total, touched, quiet } = useMemo(() => {
    const now = Date.now();
    return {
      total: files.length,
      touched: files.filter((f) => f.lastTouchAt && now - new Date(f.lastTouchAt).getTime() <= COVERAGE_WINDOW_MS).length,
      quiet: files.filter((f) => f.quietWorkingDays >= QUIET_THRESHOLD).length,
    };
  }, [files]);

  // Move a just-touched file to the bottom with a FLIP animation. flushSync so
  // the DOM reorders before we measure the "after" positions.
  function reorderTouched(fileId: string) {
    const el = listRef.current;
    if (!el) {
      setFiles((prev) => bumpToBottom(prev, fileId));
      return;
    }
    const before = new Map([...el.children].map((c) => [(c as HTMLElement).dataset.id, c.getBoundingClientRect().top]));
    flushSync(() => setFiles((prev) => bumpToBottom(prev, fileId)));
    const kids = [...el.children] as HTMLElement[];
    kids.forEach((c) => {
      const b = before.get(c.dataset.id);
      const dy = b == null ? 0 : b - c.getBoundingClientRect().top;
      if (dy) { c.style.transition = "none"; c.style.transform = `translateY(${dy}px)`; }
    });
    requestAnimationFrame(() => kids.forEach((c) => {
      c.style.transition = "transform .55s cubic-bezier(.22,1,.36,1)";
      c.style.transform = "";
    }));
  }

  async function act(file: CockpitFile, side: CockpitSide, channel: Channel) {
    // 1) open the channel where we have the detail
    if (channel === "phone" && side.phone) window.location.href = `tel:${side.phone.replace(/\s/g, "")}`;
    else if (channel === "whatsapp" && side.phone) window.open(`https://wa.me/${toWaDigits(side.phone)}`, "_blank", "noopener");
    else if (channel === "email" && side.email) window.location.href = `mailto:${side.email}`;

    // 2) optimistic: reset this file's quiet, move to bottom
    reorderTouched(file.id);

    // 3) log the human touch so it stays down after refresh
    try {
      await logCommAction({
        transactionId: file.id,
        type: "outbound",
        method: channel,
        contactIds: [side.contactId],
        content: `${METHOD_VERB[channel] === "call" ? "Called" : channel === "email" ? "Emailed" : "WhatsApp to"} ${side.name} — logged from your focus list`,
        visibleToClient: false,
      });
    } catch {
      toast.error("Logged the touch here, but couldn't save it to the file. Try again.");
    }
  }

  return (
    <div className="ck-wrap">
      <style>{`
        .ck-wrap { max-width: 760px; margin: 0 auto; padding: 8px 0 60px; }
        .ck-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--agent-coral-deep); display:inline-flex; align-items:center; gap:7px; }
        .ck-eyebrow::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--agent-coral-deep); box-shadow:0 0 0 3px rgba(var(--agent-coral-rgb),0.18); }
        .ck-h1 { font-size: 25px; font-weight: 800; letter-spacing:-0.02em; margin: 8px 0 4px; color: var(--agent-text-primary); }
        .ck-sub { margin:0; font-size:14px; color: var(--agent-text-secondary); max-width: 58ch; }

        .ck-cov { margin: 18px 0 20px; display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:16px 18px; border-radius:16px;
          background: var(--agent-surface-elevated); border:1px solid var(--agent-border-default); box-shadow: var(--agent-shadow-sm, 0 2px 10px rgba(0,0,0,0.05)); }
        .ck-cov-num { font-size:30px; font-weight:800; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; line-height:1; color: var(--agent-text-primary); }
        .ck-cov-num small { font-size:15px; font-weight:600; color: var(--agent-text-muted); }
        .ck-cov-lab { font-size:12px; color: var(--agent-text-muted); margin-top:3px; }
        .ck-track { flex:1; min-width:150px; height:8px; border-radius:99px; background: var(--agent-surface-subtle); overflow:hidden; }
        .ck-fill { height:100%; border-radius:99px; background: linear-gradient(90deg, var(--agent-coral), var(--agent-coral-deep)); transition: width .5s cubic-bezier(.22,1,.36,1); }

        .ck-list { display:flex; flex-direction:column; gap:10px; }
        .ck-card { will-change:transform; padding:14px 16px; border-radius:16px; background: var(--agent-surface-elevated); border:1px solid var(--agent-border-default); box-shadow: var(--agent-shadow-sm, 0 2px 10px rgba(0,0,0,0.05)); }
        .ck-head { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
        .ck-thumb { flex-shrink:0; display:block; border-radius:11px; overflow:hidden; transition: opacity .16s ease; }
        .ck-thumb:hover { opacity:0.86; }
        .ck-addr { min-width:0; flex:1; text-decoration:none; display:block; }
        .ck-addr-l1 { display:block; font-size:15px; font-weight:700; letter-spacing:-0.01em; color: var(--agent-text-primary); transition: color .15s ease; }
        .ck-addr-loc { display:block; font-size:12px; color: var(--agent-text-muted); margin-top:1px; }
        .ck-thumb:hover ~ .ck-addr .ck-addr-l1, .ck-addr:hover .ck-addr-l1 { color: var(--agent-coral-deep); }

        .ck-side { display:flex; align-items:center; gap:10px; padding:8px 0; flex-wrap:wrap; }
        .ck-side + .ck-side { border-top:1px solid var(--agent-border-default); }
        .ck-who { min-width:0; flex:1; }
        .ck-who .n { display:block; font-size:13.5px; font-weight:600; color: var(--agent-text-primary); }
        .ck-who .last { display:block; font-size:11.5px; color: var(--agent-text-muted); }
        .ck-acts { display:inline-flex; gap:6px; flex-shrink:0; }
        .ck-act { width:32px; height:32px; border-radius:9px; border:1px solid var(--agent-border-default); background: var(--agent-surface-glass);
          color: var(--agent-text-secondary); display:grid; place-items:center; cursor:pointer; transition: background .14s, color .14s, transform .14s, box-shadow .14s, border-color .14s; }
        .ck-act:hover:not(:disabled) { color:#fff; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.16); }
        .ck-act:disabled { opacity:0.4; cursor:not-allowed; }
        .ck-act.call:hover:not(:disabled) { background: var(--agent-coral-deep); border-color: var(--agent-coral-deep); }
        .ck-act.email:hover:not(:disabled) { background:#3b6ef0; border-color:#3b6ef0; }
        .ck-act.wa:hover:not(:disabled) { background:#25a75a; border-color:#25a75a; }

        .ck-empty { text-align:center; padding:48px 20px; }
        .ck-empty .big { font-size:17px; font-weight:700; color: var(--agent-text-primary); }
        .ck-empty .small { font-size:13px; color: var(--agent-text-muted); margin-top:4px; }

        .ck-counts { margin-top:30px; padding:18px 20px 6px; border-radius:16px; background: var(--agent-surface-elevated); border:1px solid var(--agent-border-default); }
        .ck-counts h2 { font-size:14px; font-weight:800; margin:0 0 3px; color: var(--agent-text-primary); }
        .ck-counts p { font-size:13px; color: var(--agent-text-secondary); margin:0 0 14px; max-width:60ch; }
        .ck-cgrid { display:grid; grid-template-columns:1fr; gap:0; }
        @media (min-width:560px){ .ck-cgrid { grid-template-columns:1fr 1fr; gap:22px; } }
        .ck-col h3 { font-size:12px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; margin:0 0 8px; }
        .ck-col.yes h3 { color: var(--agent-success); }
        .ck-col.no h3 { color: var(--agent-danger); }
        .ck-col ul { list-style:none; margin:0 0 16px; padding:0; display:flex; flex-direction:column; gap:7px; }
        .ck-col li { font-size:13px; color: var(--agent-text-primary); display:flex; gap:8px; line-height:1.4; }
        .ck-col li .mk { flex-shrink:0; font-weight:800; margin-top:1px; }
        .ck-col.yes li .mk { color: var(--agent-success); }
        .ck-col.no li .mk { color: var(--agent-danger); }
        .ck-col li small { display:block; color: var(--agent-text-muted); font-size:11.5px; }
        .ck-foot { margin-top:18px; font-size:12.5px; color: var(--agent-text-muted); text-align:center; }
        @media (prefers-reduced-motion: reduce) { .ck-card { transition:none !important; } }
      `}</style>

      <div className="ck-eyebrow">Just for you</div>
      <h1 className="ck-h1">What to work on next</h1>
      <p className="ck-sub">Your active outsourced files, the most neglected on top. Call, email or WhatsApp a side and the file drops to the bottom. Nothing here is shared.</p>

      <div className="ck-cov">
        <div>
          <div className="ck-cov-num">{touched}<small> / {total}</small></div>
          <div className="ck-cov-lab">files touched · last 10 days</div>
        </div>
        <div className="ck-track"><div className="ck-fill" style={{ width: total ? `${(touched / total) * 100}%` : "0%" }} /></div>
        <Pill glass tone={quiet > 0 ? "danger" : "success"} size="md">{quiet > 0 ? `${quiet} gone quiet` : "all caught up"}</Pill>
      </div>

      {files.length === 0 ? (
        <div className="ck-empty">
          <div className="big">Nothing's gone quiet</div>
          <div className="small">Every active file has had a human touch. Nice.</div>
        </div>
      ) : (
        <div className="ck-list" ref={listRef}>
          {files.map((f) => {
            const badge = fileBadge(f.quietWorkingDays);
            const { line, loc } = splitAddr(f.address);
            const href = `/agent/transactions/${f.id}`;
            return (
              <article className="ck-card" key={f.id} data-id={f.id}>
                <div className="ck-head">
                  <Link href={href} className="ck-thumb" aria-label={`Open ${f.address}`}>
                    <PropertyThumb photoUrl={f.photoUrl} size={44} />
                  </Link>
                  <Link href={href} className="ck-addr">
                    <span className="ck-addr-l1">{line}</span>
                    {loc && <span className="ck-addr-loc">{loc}</span>}
                    {f.agencyName && <span className="ck-addr-loc">{f.agencyName}</span>}
                  </Link>
                  <Pill glass tone={badge.tone} size="sm">{badge.label}</Pill>
                </div>
                <SideRow file={f} side={f.seller} onAct={act} />
                <SideRow file={f} side={f.buyer} onAct={act} />
              </article>
            );
          })}
        </div>
      )}

      <section className="ck-counts">
        <h2>What counts as a touch</h2>
        <p>The clock only resets on a real, human contact. A chase you send counts (even if we drafted it). The automated step-chaser and system emails don&rsquo;t.</p>
        <div className="ck-cgrid">
          <div className="ck-col yes">
            <h3>Counts — resets the clock</h3>
            <ul>
              <li><span className="mk">✓</span><span>Logged phone call<small>Made or taken, logged on the file</small></span></li>
              <li><span className="mk">✓</span><span>Email you sent<small>A personal email to a client</small></span></li>
              <li><span className="mk">✓</span><span>WhatsApp message<small>Sent from the file&rsquo;s chat</small></span></li>
              <li><span className="mk">✓</span><span>Portal update to a client<small>&ldquo;Draft for everyone&rdquo; or a direct portal message</small></span></li>
              <li><span className="mk">✓</span><span>A chase you generated &amp; sent<small>You triggered it — drafted by us is fine</small></span></li>
            </ul>
          </div>
          <div className="ck-col no">
            <h3>Doesn&rsquo;t count</h3>
            <ul>
              <li><span className="mk">✕</span><span>The automated step-chaser<small>The scheduled auto-chaser firing on its own</small></span></li>
              <li><span className="mk">✕</span><span>Automated milestone emails<small>&ldquo;Step confirmed&rdquo; client emails</small></span></li>
              <li><span className="mk">✕</span><span>Reminders &amp; system notifications<small>Anything the platform sends without you</small></span></li>
              <li><span className="mk">✕</span><span>A client confirming in their portal<small>That&rsquo;s them reaching in, not you reaching out</small></span></li>
            </ul>
          </div>
        </div>
      </section>

      <p className="ck-foot">Only your account sees this. It reads what&rsquo;s already logged — nothing new is captured.</p>
    </div>
  );
}

function SideRow({ file, side, onAct }: { file: CockpitFile; side: CockpitSide | null; onAct: (f: CockpitFile, s: CockpitSide, ch: Channel) => void }) {
  if (!side) return null;
  const last = side.lastTouchAt
    ? `Last ${METHOD_VERB[side.lastMethod ?? "message"] ?? "contact"} ${quietText(side.quietWorkingDays)}`
    : "Not contacted yet";
  return (
    <div className="ck-side">
      <ContactAvatar contact={{ name: side.name, roleType: side.roleType }} image={side.image} size={30} />
      <span className="ck-who">
        <span className="n">{side.name}</span>
        <span className="last">{last}</span>
      </span>
      <span className="ck-acts">
        <button className="ck-act call" title={`Call ${side.name}`} disabled={!side.phone} onClick={() => onAct(file, side, "phone")}><Phone size={16} /></button>
        <button className="ck-act email" title={`Email ${side.name}`} disabled={!side.email} onClick={() => onAct(file, side, "email")}><EnvelopeSimple size={16} /></button>
        <button className="ck-act wa" title={`WhatsApp ${side.name}`} disabled={!side.phone} onClick={() => onAct(file, side, "whatsapp")}><WhatsappLogo size={16} /></button>
      </span>
    </div>
  );
}

// Reset a file's quiet + last-touch to now, then re-sort most-neglected-first so
// it lands at the bottom.
function bumpToBottom(files: CockpitFile[], fileId: string): CockpitFile[] {
  const nowIso = new Date().toISOString();
  const next = files.map((f) => {
    if (f.id !== fileId) return f;
    const touch = (s: CockpitSide | null): CockpitSide | null => s && { ...s, lastTouchAt: nowIso, quietWorkingDays: 0, lastMethod: s.lastMethod };
    return { ...f, quietWorkingDays: 0, lastTouchAt: nowIso, seller: touch(f.seller), buyer: touch(f.buyer) };
  });
  next.sort((a, b) => {
    if (b.quietWorkingDays !== a.quietWorkingDays) return b.quietWorkingDays - a.quietWorkingDays;
    const aT = a.lastTouchAt ? new Date(a.lastTouchAt).getTime() : 0;
    const bT = b.lastTouchAt ? new Date(b.lastTouchAt).getTime() : 0;
    return aT - bT;
  });
  return next;
}
