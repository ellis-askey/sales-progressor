"use client";
// Focus Next — isolated prototype (/dev only). A reading-pane workspace: a source
// list of sales, a detail pane where the client conversation is the substance,
// seller/buyer side-by-side under one header. All state local; no DB, no sends.

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import {
  GLASS_CSS, ThemeCtx, type Theme, Segmented, Dialog, Drawer, DropdownMenu,
  ToastProvider, useToast, Input, Textarea, Field, Button,
} from "@/components/liquid/ui";
import "@/app/styles/liquid-glass.css";
import {
  EnvelopeSimple, WhatsappLogo, Phone, MagnifyingGlass, Clock, MoonStars, Sun,
  PaperPlaneTilt, Check, ArrowUpRight, Warning, ChatCircleDots, DotsThree,
  PhoneCall, FolderOpen, Sparkle, Moon, ClipboardText,
} from "@/components/icons/ph";
import { extractFirstName } from "@/lib/contacts/displayName";
import { FOCUS_CSS } from "./styles";
import {
  SALES, type Sale, type Side, type SideKind, type Comm, type CommState,
  rel, price, sideSignal, sideCovered, reasons, attentionScore, type Tone,
} from "./mock";

type Lens = "attention" | "awaiting" | "coverage";
const CH: Record<Comm["channel"], typeof EnvelopeSimple> = { email: EnvelopeSimple, whatsapp: WhatsappLogo, call: Phone };
const STATE_LABEL: Record<CommState, string> = {
  replied: "Replied", opened: "Opened", delivered: "Delivered", sent: "Sent",
  messaged: "Message sent", called: "Call", logged: "Logged", bounced: "Bounced", failed: "Failed to send",
};
const who = (s: Side) => (s.kind === "vendor" ? "Seller" : "Buyer");
const dirWord = (m: Comm) => (m.dir === "in" ? "They" : m.automated ? "Automatic" : "You");
const isBad = (st: CommState) => st === "bounced" || st === "failed";

// one-line status per side (the single quiet line above the thread)
function sideStatus(s: Side): { t: Tone | "ok"; text: string } {
  if (s.parked) return { t: "ok", text: "Set aside this week" };
  if (s.touchedThisWeek) return { t: "ok", text: "Contacted this week" };
  const sig = sideSignal(s);
  if (sig.bounced) return { t: "danger", text: "Last message didn't get through" };
  if (sig.lastHumanDays == null) return { t: "danger", text: "Not yet contacted" };
  if (sig.quiet) return { t: sig.quietDays! >= 21 ? "danger" : "warn", text: `Quiet for ${sig.quietDays} days` };
  if (sig.awaitingReply) return { t: "warn", text: `Waiting on a reply · ${sig.awaitingDays}d` };
  return { t: "ok", text: `In touch · last spoke ${rel(sig.lastHumanDays)} ago` };
}
// compact brief for the source-list summary
function sideBrief(s: Side): string {
  const r = who(s);
  if (s.parked) return `${r} set aside`;
  if (s.touchedThisWeek) return `${r} done`;
  const sig = sideSignal(s);
  if (sig.bounced) return `${r} bounced`;
  if (sig.lastHumanDays == null) return `${r} not contacted`;
  if (sig.quiet) return `${r} quiet ${sig.quietDays}d`;
  if (sig.awaitingReply) return `${r} awaiting reply`;
  return `${r} in touch ${rel(sig.lastHumanDays)}`;
}

export default function FocusNextPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  return (
    <ThemeCtx.Provider value={theme}>
      <ToastProvider>
        <div className="lg-ds fx-root" data-theme={theme}>
          <style dangerouslySetInnerHTML={{ __html: GLASS_CSS + FOCUS_CSS }} />
          <div className="fx-scene" aria-hidden />
          <Workspace theme={theme} setTheme={setTheme} />
        </div>
      </ToastProvider>
    </ThemeCtx.Provider>
  );
}

function Workspace({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const toast = useToast();
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(JSON.stringify(SALES)));
  const [lens, setLens] = useState<Lens>("attention");
  const [sideF, setSideF] = useState<"all" | "vendor" | "purchaser">("all");
  const [query, setQuery] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compose, setCompose] = useState<{ sale: Sale; side: Side } | null>(null);
  const [callLog, setCallLog] = useState<{ sale: Sale; side: Side } | null>(null);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 460); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1000px)");
    const on = () => setNarrow(mq.matches); on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const matchSide = useCallback((s: Side | null) => !!s && (sideF === "all" || s.kind === sideF), [sideF]);
  const inQuery = useCallback((sale: Sale) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return `${sale.line1} ${sale.town} ${sale.vendor?.names ?? ""} ${sale.purchaser?.names ?? ""}`.toLowerCase().includes(q);
  }, [query]);

  const groups = useMemo(() => {
    const pool = sales.filter(inQuery).filter((s) => matchSide(s.vendor) || matchSide(s.purchaser));
    const allCovered = (s: Sale) => [s.vendor, s.purchaser].filter(Boolean).every((p) => sideCovered(p!));
    const anyAwaiting = (s: Sale) => [s.vendor, s.purchaser].some((p) => matchSide(p) && sideSignal(p).awaitingReply && !sideCovered(p!));
    const byScore = (a: Sale, b: Sale) => attentionScore(b) - attentionScore(a);
    if (lens === "awaiting") {
      return [{ key: "await", label: "Awaiting a reply", sales: pool.filter(anyAwaiting).sort(byScore) }].filter((g) => g.sales.length);
    }
    if (lens === "coverage") {
      return [
        { key: "todo", label: "Still to contact", sales: pool.filter((s) => !allCovered(s)).sort(byScore) },
        { key: "done", label: "Covered this week", sales: pool.filter(allCovered).sort(byScore) },
      ].filter((g) => g.sales.length);
    }
    return [
      { key: "hot", label: "Needs attention", sales: pool.filter((s) => attentionScore(s) > 0).sort(byScore) },
      { key: "calm", label: "On track", sales: pool.filter((s) => attentionScore(s) === 0).sort(byScore) },
    ].filter((g) => g.sales.length);
  }, [sales, lens, inQuery, matchSide]);

  const flat = useMemo(() => groups.flatMap((g) => g.sales), [groups]);
  useEffect(() => {
    if (narrow) return;
    if (!selId || !flat.some((s) => s.id === selId)) setSelId(flat[0]?.id ?? null);
  }, [flat, selId, narrow]);
  const selected = useMemo(() => sales.find((s) => s.id === selId) ?? null, [sales, selId]);

  const coverage = useMemo(() => {
    let total = 0, done = 0;
    for (const s of sales) for (const p of [s.vendor, s.purchaser]) { if (!p) continue; total++; if (sideCovered(p)) done++; }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [sales]);

  useEffect(() => {
    if (narrow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || compose || callLog) return;
      const i = flat.findIndex((s) => s.id === selId);
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setSelId(flat[Math.min(flat.length - 1, i + 1)]?.id ?? selId); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setSelId(flat[Math.max(0, i - 1)]?.id ?? selId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, selId, narrow, compose, callLog]);

  // mutations (optimistic + undo)
  const mutateSide = useCallback((saleId: string, kind: SideKind, fn: (s: Side) => Side, title: string) => {
    let prev: Side | null = null;
    setSales((cur) => cur.map((s) => {
      if (s.id !== saleId) return s;
      const key = kind === "vendor" ? "vendor" : "purchaser";
      if (!s[key]) return s;
      prev = JSON.parse(JSON.stringify(s[key]));
      return { ...s, [key]: fn(JSON.parse(JSON.stringify(s[key]))) };
    }));
    toast({ title, tone: "ok", action: { label: "Undo", onClick: () => setSales((cur) => cur.map((s) => s.id === saleId && prev ? { ...s, [kind === "vendor" ? "vendor" : "purchaser"]: prev } : s)) } });
  }, [toast]);

  const addComm = (comm: Comm) => (s: Side): Side => ({ ...s, touchedThisWeek: true, parked: false, comms: [comm, ...s.comms] });
  const doEmailSent = (id: string, side: Side, subject: string) => mutateSide(id, side.kind, addComm({ channel: "email", dir: "out", state: "sent", daysAgo: 0, subject: subject || "Update on your sale" }), `${who(side)} · email sent`);
  const doMarkEmailed = (id: string, side: Side) => mutateSide(id, side.kind, addComm({ channel: "email", dir: "out", state: "logged", daysAgo: 0, subject: "Emailed (logged)" }), `${who(side)} · marked contacted`);
  const doCallLogged = (id: string, side: Side, note: string) => mutateSide(id, side.kind, addComm({ channel: "call", dir: "out", state: "called", daysAgo: 0, preview: note || "Spoke with them" }), `${who(side)} · call logged`);
  const doContacted = (id: string, side: Side) => mutateSide(id, side.kind, (s) => ({ ...s, touchedThisWeek: true, parked: false }), `${who(side)} · marked contacted`);
  const doPark = (id: string, side: Side) => mutateSide(id, side.kind, (s) => ({ ...s, parked: true }), `${who(side)} · set aside this week`);
  const doReopen = (id: string, side: Side) => mutateSide(id, side.kind, (s) => ({ ...s, parked: false, touchedThisWeek: false }), `${who(side)} · back on your list`);

  const openDetail = (id: string) => { setSelId(id); if (narrow) setDrawerOpen(true); };

  const detail = selected && (
    <DetailPane
      key={selected.id}
      sale={selected}
      onOpenFile={() => toast({ text: "Prototype — would open the file", tone: "info" })}
      onCompose={(s) => setCompose({ sale: selected, side: s })}
      onCall={(s) => setCallLog({ sale: selected, side: s })}
      onMarkEmailed={(s) => doMarkEmailed(selected.id, s)}
      onContacted={(s) => doContacted(selected.id, s)}
      onPark={(s) => doPark(selected.id, s)}
      onReopen={(s) => doReopen(selected.id, s)}
    />
  );

  return (
    <div className="fx-window">
      <header className="fx-tb">
        <div className="fx-tb-id">
          <div className="fx-tb-title"><b>Focus</b><span className="fx-num">{coverage.done} of {coverage.total}<span className="fx-tb-cap"> contacted this week</span></span></div>
          <div className="fx-tb-cov" role="progressbar" aria-valuenow={coverage.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${coverage.pct}%` }} /></div>
        </div>
        <div className="fx-tb-sp" />
        <Input className="fx-tb-search" leading={<MagnifyingGlass weight="regular" />} clearable placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
        <button className="fx-theme" aria-label="Toggle light and dark" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</button>
      </header>

      <div className="fx-main">
        <section className="fx-listcol">
          <div className="fx-lhead">
            <Segmented value={lens} onChange={(v) => setLens(v)} ariaLabel="View" size="sm"
              options={[{ value: "attention", label: "Attention" }, { value: "awaiting", label: "Awaiting" }, { value: "coverage", label: "Coverage" }]} />
            <div className="fx-scope" role="group" aria-label="Client side">
              {(["all", "vendor", "purchaser"] as const).map((k) => (
                <button key={k} data-on={sideF === k || undefined} onClick={() => setSideF(k)}>{k === "all" ? "Everyone" : k === "vendor" ? "Sellers" : "Buyers"}</button>
              ))}
            </div>
          </div>

          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <div key={i} className="fx-skel"><span className="fx-skelbar" style={{ width: `${68 - i * 4}%` }} /><span className="fx-skelbar" style={{ width: `${46 - i * 3}%`, height: 9 }} /></div>)
          ) : flat.length === 0 ? (
            <CaughtUp lens={lens} />
          ) : (
            groups.map((g) => (
              <div key={g.key} role="listbox" aria-label={g.label}>
                <div className="fx-sec"><b>{g.label}</b><span className="fx-num">{g.sales.length}</span></div>
                {g.sales.map((sale) => <Row key={sale.id} sale={sale} selected={sale.id === selId && !narrow} sideF={sideF} onClick={() => openDetail(sale.id)} />)}
              </div>
            ))
          )}
        </section>

        {!narrow && (
          <section className="fx-detailcol fx-detail-inline">
            {detail ?? (
              <div className="fx-nodetail"><FolderOpen weight="regular" /><p>Select a sale to work through its two sides.</p><p><span className="fx-kbd">↑</span> <span className="fx-kbd">↓</span> to move</p></div>
            )}
          </section>
        )}
      </div>

      {narrow && (
        <Drawer open={drawerOpen && !!selected} onClose={() => setDrawerOpen(false)} title={selected?.line1 ?? "Sale"} eyebrow={selected ? `${selected.town} · ${selected.stage}` : undefined}>
          {detail}
        </Drawer>
      )}

      <Dialog open={!!compose} onClose={() => setCompose(null)} title="New email" eyebrow={compose ? `${who(compose.side)} · ${compose.sale.line1}` : undefined}
        footer={compose && (<><Button variant="ghost" size="sm" onClick={() => setCompose(null)}>Cancel</Button><Button variant="primary" size="sm" onClick={() => { const el = document.getElementById("fx-subj") as HTMLInputElement | null; doEmailSent(compose.sale.id, compose.side, el?.value ?? ""); setCompose(null); }}><PaperPlaneTilt weight="fill" /> Send</Button></>)}>
        {compose && (
          <div className="fx-form">
            <div className="fx-form-to">To <b>{compose.side.names}</b></div>
            <Field label="Subject"><Input id="fx-subj" defaultValue="Update on your sale" /></Field>
            <Field label="Message"><Textarea rows={5} defaultValue={`Hi ${extractFirstName(compose.side.names)},\n\nA quick update on ${compose.sale.line1} — `} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={!!callLog} onClose={() => setCallLog(null)} title="Log a call" eyebrow={callLog ? `${who(callLog.side)} · ${callLog.sale.line1}` : undefined}
        footer={callLog && (<><Button variant="ghost" size="sm" onClick={() => setCallLog(null)}>Cancel</Button><Button variant="primary" size="sm" onClick={() => { const el = document.getElementById("fx-note") as HTMLTextAreaElement | null; doCallLogged(callLog.sale.id, callLog.side, el?.value ?? ""); setCallLog(null); }}><Check weight="bold" /> Save call</Button></>)}>
        {callLog && (
          <div className="fx-form">
            <div className="fx-form-to">Call with <b>{callLog.side.names}</b></div>
            <Field label="What was said?" hint="Internal note only — the client never sees this."><Textarea id="fx-note" rows={4} placeholder="e.g. Reassured them on the search delay; chasing the local authority." /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── source-list row ──────────────────────────────────────────────────────────
function Row({ sale, selected, sideF, onClick }: { sale: Sale; selected: boolean; sideF: string; onClick: () => void }) {
  const rs = reasons(sale);
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s && (sideF === "all" || s.kind === sideF));
  const dotU = rs[0]?.tone === "danger" ? "danger" : rs[0]?.tone === "warn" ? "warn" : rs[0]?.tone === "info" ? "info" : "none";
  const lead = rs[0] ?? null;
  const rest = rs.length ? rs.slice(1, 3).map((r) => r.text).join(" · ") : sides.map(sideBrief).join(" · ");
  const worst = sides.map((s) => sideSignal(s).lastHumanDays).filter((d): d is number => d != null);
  const when = sides.some((s) => sideSignal(s).lastHumanDays == null) && rs.length ? "" : worst.length ? rel(Math.max(...worst)) : "";
  return (
    <button className="fx-row" data-sel={selected || undefined} onClick={onClick} role="option" aria-selected={selected}>
      <span className="fx-row-dot" data-u={dotU} />
      <span className="fx-row-m">
        <span className="fx-row-addr">{sale.line1} <span>{sale.town}</span></span>
        <span className="fx-row-sum">{lead ? <><em>{lead.text}</em>{rest && <> · {rest}</>}</> : rest}</span>
      </span>
      {when && <span className="fx-row-when fx-num">{when}</span>}
    </button>
  );
}

// ── detail (reading pane) ─────────────────────────────────────────────────────
function DetailPane({ sale, onOpenFile, onCompose, onCall, onMarkEmailed, onContacted, onPark, onReopen }: {
  sale: Sale; onOpenFile: () => void;
  onCompose: (s: Side) => void; onCall: (s: Side) => void; onMarkEmailed: (s: Side) => void;
  onContacted: (s: Side) => void; onPark: (s: Side) => void; onReopen: (s: Side) => void;
}) {
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s);
  return (
    <div className="fx-detail">
      <div className="fx-dhead">
        <div style={{ minWidth: 0 }}>
          <h2 className="fx-daddr">{sale.line1}</h2>
          <div className="fx-dmeta"><span>{sale.town} {sale.postcode}</span><i /><b className="fx-num">{price(sale.pricePence)}</b><i /><span>{sale.stage}</span></div>
        </div>
        <button className="fx-openfile" onClick={onOpenFile}>Open file <ArrowUpRight weight="bold" /></button>
      </div>

      {sale.concerns.map((con, i) => (
        <div key={i} className="fx-concern" data-t={con.tone === "warn" ? "warn" : undefined}>
          {con.kind === "enquiry" ? <ChatCircleDots weight="fill" /> : <MagnifyingGlass weight="bold" />}
          <b>{con.title}</b><span>— {con.detail}</span>
          <button className="fx-concern-open" onClick={onOpenFile}>Open</button>
        </div>
      ))}
      {attentionScore(sale) === 0 && <div className="fx-allclear"><Check weight="bold" />Nothing needs you here — both sides are in good shape.</div>}

      <div className="fx-cols" data-single={sides.length === 1 || undefined}>
        {sides.map((s) => (
          <SideColumn key={s.kind} side={s}
            onCompose={() => onCompose(s)} onCall={() => onCall(s)} onMarkEmailed={() => onMarkEmailed(s)}
            onContacted={() => onContacted(s)} onPark={() => onPark(s)} onReopen={() => onReopen(s)} />
        ))}
      </div>
    </div>
  );
}

function SideColumn({ side, onCompose, onCall, onMarkEmailed, onContacted, onPark, onReopen }: {
  side: Side; onCompose: () => void; onCall: () => void; onMarkEmailed: () => void; onContacted: () => void; onPark: () => void; onReopen: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const st = sideStatus(side);
  const covered = sideCovered(side);
  const circleState = side.parked ? "parked" : side.touchedThisWeek ? "done" : "todo";
  const comms = [...side.comms].sort((a, b) => a.daysAgo - b.daysAgo);
  const shown = showAll ? comms : comms.slice(0, 3);
  return (
    <div className="fx-col">
      <div className="fx-ch">
        <button className="fx-circle" data-s={circleState}
          aria-label={covered ? `Mark ${who(side)} as not contacted` : `Mark ${who(side)} contacted this week`}
          onClick={() => (covered ? onReopen() : onContacted())}>
          {side.parked ? <Moon weight="fill" /> : <Check weight="bold" />}
        </button>
        <div className="fx-ch-id">
          <div className="fx-ch-role">{who(side)}</div>
          <div className="fx-ch-name">{side.names}</div>
        </div>
      </div>
      <p className="fx-status" data-t={st.t === "ok" ? undefined : st.t}>
        {st.t === "danger" ? <Warning weight="fill" /> : st.t === "warn" ? <Clock weight="fill" /> : null}{st.text}
      </p>

      <div className="fx-thread">
        {comms.length === 0 ? <p className="fx-te-empty">No contact on record yet.</p> : shown.map((m, i) => {
          const Icon = CH[m.channel];
          return (
            <div key={i} className="fx-te" data-recent={i === 0 || undefined}>
              <span className="fx-te-g"><Icon weight="regular" /></span>
              <div className="fx-te-b">
                <div className="fx-te-t">{m.subject ?? m.preview ?? STATE_LABEL[m.state]}</div>
                <div className="fx-te-s" data-bad={isBad(m.state) || undefined}>{m.automated ? <span className="fx-te-auto">Sent automatically · doesn&rsquo;t count</span> : <>{dirWord(m)} · {STATE_LABEL[m.state]}</>}</div>
              </div>
              <span className="fx-te-w fx-num">{rel(m.daysAgo)}</span>
            </div>
          );
        })}
        {comms.length > 3 && <button className="fx-more" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show less" : `Show ${comms.length - 3} earlier`}</button>}
      </div>

      {covered ? (
        <div className="fx-done-line"><Check weight="bold" />{side.parked ? "Set aside this week" : "Contacted this week"}<button onClick={onReopen}>Reopen</button></div>
      ) : (
        <div className="fx-acts">
          <button className="fx-prim" onClick={onCompose}><PaperPlaneTilt weight="fill" />Email {extractFirstName(side.names)}</button>
          <button className="fx-sec-act" onClick={onCall}><PhoneCall weight="regular" />Log call</button>
          <span className="fx-kebabwrap">
            <DropdownMenu align="end" label={<DotsThree weight="bold" />} items={[
              { label: "Mark as emailed", icon: <ClipboardText weight="regular" />, onSelect: onMarkEmailed },
              { label: "Set aside this week", icon: <Moon weight="regular" />, onSelect: onPark },
            ]} />
          </span>
        </div>
      )}
    </div>
  );
}

function CaughtUp({ lens }: { lens: Lens }) {
  const c = lens === "awaiting" ? { t: "Nobody's left hanging", b: "Every message you've sent has had a reply." }
    : lens === "coverage" ? { t: "Every side covered", b: "You've reached both clients on every active sale this week." }
    : { t: "All caught up", b: "Nothing urgent across your book right now." };
  return <div className="fx-caught">{lens === "awaiting" ? <ChatCircleDots weight="fill" /> : <Sparkle weight="fill" />}<h3>{c.t}</h3><p>{c.b}</p></div>;
}
