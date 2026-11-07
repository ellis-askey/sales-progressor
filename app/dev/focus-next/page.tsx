"use client";
// Focus Next — isolated prototype (/dev only). Master–detail triage workspace.
// All state is local; no DB, no server actions, no live sends. Built on the
// forward Liquid-Glass UI kit (components/liquid/ui).

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import {
  GLASS_CSS, ThemeCtx, type Theme, Surface, Segmented, Button, Dialog, Drawer,
  ToastProvider, useToast, Input, Textarea, Field,
} from "@/components/liquid/ui";
import "@/app/styles/liquid-glass.css";
import {
  EnvelopeSimple, WhatsappLogo, Phone, Warning, MagnifyingGlass, ChatCircleDots,
  CheckCircle, ArrowUpRight, Clock, MoonStars, Sun, PaperPlaneTilt, Moon, Sparkle,
  Check, FolderOpen, PhoneCall, ClipboardText,
} from "@/components/icons/ph";
import { extractFirstName } from "@/lib/contacts/displayName";
import { FOCUS_CSS } from "./styles";
import {
  SALES, type Sale, type Side, type SideKind, type Comm, type CommState,
  rel, price, sideSignal, sideCovered, reasons, attentionScore, type Tone,
} from "./mock";

type Lens = "attention" | "awaiting" | "coverage";

// ── channel / state visual maps ──────────────────────────────────────────────
const CH_ICON: Record<Comm["channel"], typeof EnvelopeSimple> = { email: EnvelopeSimple, whatsapp: WhatsappLogo, call: Phone };
function pipTone(state: CommState): Tone | "neutral" {
  if (state === "replied" || state === "opened") return "ok";
  if (state === "bounced" || state === "failed") return "danger";
  if (state === "logged") return "warn";
  return "neutral";
}
const STATE_LABEL: Record<CommState, string> = {
  replied: "Replied", opened: "Opened", delivered: "Delivered", sent: "Sent",
  messaged: "Sent", called: "Call", logged: "Logged", bounced: "Bounced", failed: "Failed",
};
function dirWord(m: Comm): string {
  if (m.dir === "in") return "They";
  return m.automated ? "Auto" : "You";
}

// ── per-side status descriptor ───────────────────────────────────────────────
function sideStatus(s: Side): { cls: string; icon: typeof CheckCircle | null; text: string } {
  if (s.parked) return { cls: "fx-ss-neutral", icon: Moon, text: "Parked this week" };
  if (s.touchedThisWeek) return { cls: "fx-ss-ok", icon: CheckCircle, text: "Contacted this week" };
  const sig = sideSignal(s);
  if (sig.bounced) return { cls: "fx-ss-danger", icon: Warning, text: "Last message bounced" };
  if (sig.lastHumanDays == null) return { cls: "fx-ss-danger", icon: Warning, text: "Never contacted" };
  if (sig.quiet) return { cls: sig.quietDays! >= 21 ? "fx-ss-danger" : "fx-ss-warn", icon: Clock, text: `Quiet ${sig.quietDays}d` };
  if (sig.awaitingReply) return { cls: "fx-ss-info", icon: Clock, text: `Awaiting reply · ${sig.awaitingDays}d` };
  return { cls: "fx-ss-ok", icon: null, text: `In touch ${rel(sig.lastHumanDays)}` };
}

// mini side marker tone for the list
function miniTone(s: Side): string {
  if (s.parked) return "covered";
  if (s.touchedThisWeek) return "ok";
  const sig = sideSignal(s);
  if (sig.bounced || sig.lastHumanDays == null) return "danger";
  if (sig.quiet) return sig.quietDays! >= 21 ? "danger" : "warn";
  if (sig.awaitingReply) return "info";
  return "ok";
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

  useEffect(() => { const t = setTimeout(() => setLoading(false), 480); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1080px)");
    const on = () => setNarrow(mq.matches); on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // ── grouped + filtered list ────────────────────────────────────────────────
  const matchSide = useCallback((s: Side | null) => !!s && (sideF === "all" || s.kind === sideF), [sideF]);
  const inQuery = useCallback((sale: Sale) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (`${sale.line1} ${sale.town} ${sale.vendor?.names ?? ""} ${sale.purchaser?.names ?? ""}`).toLowerCase().includes(q);
  }, [query]);

  const groups = useMemo(() => {
    const pool = sales.filter(inQuery).filter((s) => matchSide(s.vendor) || matchSide(s.purchaser));
    const allCovered = (s: Sale) => [s.vendor, s.purchaser].filter(Boolean).every((p) => sideCovered(p!));
    const anyAwaiting = (s: Sale) => [s.vendor, s.purchaser].some((p) => matchSide(p) && sideSignal(p).awaitingReply && !sideCovered(p!));
    const byScore = (a: Sale, b: Sale) => attentionScore(b) - attentionScore(a);

    if (lens === "awaiting") {
      const list = pool.filter(anyAwaiting).sort(byScore);
      return [{ key: "await", label: "Awaiting a reply", sales: list }].filter((g) => g.sales.length);
    }
    if (lens === "coverage") {
      const todo = pool.filter((s) => !allCovered(s)).sort((a, b) => (Number(allCovered(b)) - Number(allCovered(a))) || byScore(a, b));
      const done = pool.filter(allCovered).sort(byScore);
      return [
        { key: "todo", label: "Still to contact this week", sales: todo },
        { key: "done", label: "Covered", sales: done },
      ].filter((g) => g.sales.length);
    }
    // attention
    const hot = pool.filter((s) => attentionScore(s) > 0).sort(byScore);
    const calm = pool.filter((s) => attentionScore(s) === 0).sort(byScore);
    return [
      { key: "hot", label: "Needs attention", sales: hot },
      { key: "calm", label: "On track", sales: calm },
    ].filter((g) => g.sales.length);
  }, [sales, lens, inQuery, matchSide]);

  const flat = useMemo(() => groups.flatMap((g) => g.sales), [groups]);
  const totalVisible = flat.length;

  // keep a valid selection
  useEffect(() => {
    if (narrow) return;
    if (!selId || !flat.some((s) => s.id === selId)) setSelId(flat[0]?.id ?? null);
  }, [flat, selId, narrow]);
  const selected = useMemo(() => sales.find((s) => s.id === selId) ?? null, [sales, selId]);

  // ── coverage ───────────────────────────────────────────────────────────────
  const coverage = useMemo(() => {
    let total = 0, done = 0;
    for (const s of sales) for (const p of [s.vendor, s.purchaser]) { if (!p) continue; total++; if (sideCovered(p)) done++; }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, left: total - done };
  }, [sales]);

  // ── keyboard nav ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (narrow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (compose || callLog) return;
      const i = flat.findIndex((s) => s.id === selId);
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setSelId(flat[Math.min(flat.length - 1, i + 1)]?.id ?? selId); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setSelId(flat[Math.max(0, i - 1)]?.id ?? selId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, selId, narrow, compose, callLog]);

  // ── mutations (optimistic + undo) ────────────────────────────────────────────
  const mutateSide = useCallback((saleId: string, kind: SideKind, fn: (s: Side) => Side, undoLabel: string, toastTitle: string) => {
    let prev: Side | null = null;
    setSales((cur) => cur.map((s) => {
      if (s.id !== saleId) return s;
      const key = kind === "vendor" ? "vendor" : "purchaser";
      const curSide = s[key];
      if (!curSide) return s;
      prev = JSON.parse(JSON.stringify(curSide));
      return { ...s, [key]: fn(JSON.parse(JSON.stringify(curSide))) };
    }));
    toast({
      title: toastTitle, tone: "ok",
      action: { label: "Undo", onClick: () => setSales((cur) => cur.map((s) => s.id === saleId && prev ? { ...s, [kind === "vendor" ? "vendor" : "purchaser"]: prev } : s)) },
    });
  }, [toast]);

  const addComm = (comm: Comm) => (s: Side): Side => ({ ...s, touchedThisWeek: true, parked: false, comms: [comm, ...s.comms] });
  const who = (s: Side) => (s.kind === "vendor" ? "Seller" : "Buyer");

  const doEmailSent = (saleId: string, side: Side, subject: string) =>
    mutateSide(saleId, side.kind, addComm({ channel: "email", dir: "out", state: "sent", daysAgo: 0, subject: subject || "Update on your sale" }), "Undo", `${who(side)} · email sent`);
  const doAlreadyEmailed = (saleId: string, side: Side) =>
    mutateSide(saleId, side.kind, addComm({ channel: "email", dir: "out", state: "logged", daysAgo: 0, subject: "Emailed (logged)" }), "Undo", `${who(side)} · logged as emailed`);
  const doCallLogged = (saleId: string, side: Side, note: string) =>
    mutateSide(saleId, side.kind, addComm({ channel: "call", dir: "out", state: "called", daysAgo: 0, preview: note || "Spoke with them" }), "Undo", `${who(side)} · call logged`);
  const doNotRequired = (saleId: string, side: Side) =>
    mutateSide(saleId, side.kind, (s) => ({ ...s, parked: true }), "Undo", `${who(side)} · parked till Monday`);
  const doUnpark = (saleId: string, side: Side) =>
    mutateSide(saleId, side.kind, (s) => ({ ...s, parked: false, touchedThisWeek: false }), "Undo", `${who(side)} · back on your list`);

  const openDetail = (id: string) => { setSelId(id); if (narrow) setDrawerOpen(true); };

  const detailProps = {
    sale: selected,
    onOpenFile: () => toast({ text: "Prototype — would open the file", tone: "info" }),
    onCompose: (side: Side) => setCompose({ sale: selected!, side }),
    onCall: (side: Side) => setCallLog({ sale: selected!, side }),
    onAlready: (side: Side) => doAlreadyEmailed(selected!.id, side),
    onNotRequired: (side: Side) => doNotRequired(selected!.id, side),
    onUnpark: (side: Side) => doUnpark(selected!.id, side),
  };

  return (
    <div className="fx-shell">
      {/* Top bar */}
      <header className="fx-top">
        <div className="fx-top-id">
          <h1 className="fx-title">Focus{coverage.left > 0 ? <> · <b>{coverage.left}</b> still to contact</> : <> · all caught up</>}</h1>
          <span className="fx-sub">Good morning, Ellis — {totalVisible} {totalVisible === 1 ? "sale" : "sales"} in view</span>
        </div>
        <div className="fx-top-sp" />
        <Surface material="frost" radius={999} className="fx-cov">
          <span className="fx-cov-ring" style={{ "--p": coverage.pct } as CSSProperties}><span className="fx-num">{coverage.pct}</span></span>
          <span className="fx-cov-txt"><b className="fx-num">{coverage.done} / {coverage.total}</b><small>sides this week</small></span>
        </Surface>
        <span className="fx-asof"><Clock weight="regular" /> As of 09:12</span>
        <button className={`fx-theme${theme === "light" ? " on" : ""}`} aria-label="Toggle light and dark" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <span className="fx-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
        </button>
      </header>

      <div className="fx-body">
        {/* List pane */}
        <section className="fx-pane">
          <div className="fx-controls">
            <Segmented
              value={lens}
              onChange={(v) => setLens(v)}
              ariaLabel="View"
              options={[{ value: "attention", label: "Attention" }, { value: "awaiting", label: "Awaiting" }, { value: "coverage", label: "Coverage" }]}
            />
            <Segmented
              size="sm"
              value={sideF}
              onChange={(v) => setSideF(v)}
              ariaLabel="Client side"
              options={[{ value: "all", label: "All" }, { value: "vendor", label: "Sellers" }, { value: "purchaser", label: "Buyers" }]}
            />
          </div>
          <div className="fx-controls">
            <Input leading={<MagnifyingGlass weight="regular" />} clearable placeholder="Search address or client…" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
          </div>

          {loading ? (
            <div className="fx-list">{Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="fx-skelrow"><span className="fx-skelbar" style={{ width: 40, height: 40, borderRadius: 12 }} /><div style={{ display: "grid", gap: 7 }}><span className="fx-skelbar" style={{ width: `${70 - i * 4}%` }} /><span className="fx-skelbar" style={{ width: `${48 - i * 3}%`, height: 8 }} /></div></div>
            ))}</div>
          ) : flat.length === 0 ? (
            <CaughtUp lens={lens} />
          ) : (
            <div className="fx-list" role="listbox" aria-label="Sales">
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="fx-group-h">{g.label}<span className="fx-group-n fx-num">{g.sales.length}</span><hr /></div>
                  {g.sales.map((sale) => (
                    <Row key={sale.id} sale={sale} selected={sale.id === selId && !narrow} sideF={sideF} onClick={() => openDetail(sale.id)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Detail pane (inline on wide) */}
        {!narrow && (
          <Surface material="solid" radius={20} className="fx-pane fx-detail-inline">
            {selected ? <DetailContent {...detailProps} /> : (
              <div className="fx-detail-empty">
                <FolderOpen weight="regular" />
                <p>Select a sale to see both sides, their history and the next move.</p>
                <p><span className="fx-kbd">↑</span> <span className="fx-kbd">↓</span> to move through the list</p>
              </div>
            )}
          </Surface>
        )}
      </div>

      {/* Detail drawer (narrow) */}
      {narrow && (
        <Drawer open={drawerOpen && !!selected} onClose={() => setDrawerOpen(false)} title={selected?.line1 ?? "Sale"} eyebrow={selected ? `${selected.town} · ${selected.stage}` : undefined}>
          {selected && <DetailContent {...detailProps} inDrawer />}
        </Drawer>
      )}

      {/* Mock composer */}
      <Dialog
        open={!!compose}
        onClose={() => setCompose(null)}
        title="New email"
        eyebrow={compose ? `${compose.sale.line1} · ${who(compose.side)}` : undefined}
        footer={compose && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setCompose(null)}>Cancel</Button>
            <ComposeSend compose={compose} onSend={(subject) => { doEmailSent(compose.sale.id, compose.side, subject); setCompose(null); }} />
          </>
        )}
      >
        {compose && <ComposeBody compose={compose} />}
      </Dialog>

      {/* Mock call log */}
      <Dialog
        open={!!callLog}
        onClose={() => setCallLog(null)}
        title="Log a call"
        eyebrow={callLog ? `${callLog.sale.line1} · ${who(callLog.side)}` : undefined}
        footer={callLog && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setCallLog(null)}>Cancel</Button>
            <CallSave onSave={(note) => { doCallLogged(callLog.sale.id, callLog.side, note); setCallLog(null); }} />
          </>
        )}
      >
        {callLog && <CallBody side={callLog.side} who={who(callLog.side)} />}
      </Dialog>
    </div>
  );
}

// ── list row ──────────────────────────────────────────────────────────────────
function Row({ sale, selected, sideF, onClick }: { sale: Sale; selected: boolean; sideF: string; onClick: () => void }) {
  const r = reasons(sale)[0] ?? null;
  const tone: Tone | "ok" = r?.tone ?? "ok";
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s && (sideF === "all" || s.kind === sideF));
  return (
    <button className="fx-row" data-sel={selected || undefined} onClick={onClick} role="option" aria-selected={selected}>
      <span className="fx-row-rail" data-tone={tone} />
      <PropertyThumbMini sale={sale} />
      <span className="fx-row-main">
        <span className="fx-row-addr">{sale.line1} <small>· {sale.town}</small></span>
        {r ? (
          <span className="fx-row-why" data-tone={r.tone}>{reasonIcon(r.tone)}{r.text}{reasons(sale).length > 1 && <span style={{ color: "var(--lg-ink-3)" }}>+{reasons(sale).length - 1}</span>}</span>
        ) : (
          <span className="fx-row-why" data-tone="ok">On track · {sale.stage}</span>
        )}
      </span>
      <span className="fx-row-sides">
        {sides.map((s) => <MiniSide key={s.kind} side={s} />)}
      </span>
    </button>
  );
}
function MiniSide({ side }: { side: Side }) {
  const covered = sideCovered(side);
  const sig = sideSignal(side);
  return (
    <span className={`fx-mini${covered ? " fx-mini-covered" : ""}`}>
      <span className="fx-mini-k" data-k={side.kind}>{side.kind === "vendor" ? "S" : "B"}</span>
      {covered ? <Check weight="bold" className="fx-mini-check" /> : (
        <>
          <span className={`fx-mini-dot fx-dot-${miniTone(side)}`} />
          <span>{sig.lastHumanDays == null ? "—" : rel(sig.lastHumanDays)}</span>
        </>
      )}
    </span>
  );
}
function PropertyThumbMini({ sale }: { sale: Sale }) {
  // deterministic soft tint from the id so thumbs read as distinct without photos
  const hue = (sale.id.charCodeAt(1) * 47) % 360;
  return <span style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", background: `hsl(${hue} 40% 50% / 0.16)`, color: `hsl(${hue} 55% 62%)`, flexShrink: 0, fontWeight: 700, fontSize: 13 }}>{sale.line1.replace(/^\D*/, "").slice(0, 2) || sale.line1.slice(0, 1)}</span>;
}
function reasonIcon(tone: Tone) {
  if (tone === "danger") return <Warning weight="fill" />;
  if (tone === "warn") return <Clock weight="fill" />;
  if (tone === "info") return <ChatCircleDots weight="fill" />;
  return <CheckCircle weight="regular" />;
}

// ── detail content ────────────────────────────────────────────────────────────
type DetailProps = {
  sale: Sale | null; inDrawer?: boolean;
  onOpenFile: () => void; onCompose: (s: Side) => void; onCall: (s: Side) => void;
  onAlready: (s: Side) => void; onNotRequired: (s: Side) => void; onUnpark: (s: Side) => void;
};
function DetailContent({ sale, inDrawer, onOpenFile, onCompose, onCall, onAlready, onNotRequired, onUnpark }: DetailProps) {
  if (!sale) return null;
  const sides = [sale.vendor, sale.purchaser].filter((s): s is Side => !!s);
  return (
    <div className="fx-detail">
      {!inDrawer && (
        <div className="fx-dh">
          <div className="fx-dh-main">
            <h2 className="fx-dh-addr">{sale.line1}</h2>
            <div className="fx-dh-meta"><span>{sale.town} {sale.postcode}</span><i /><span className="fx-dh-price fx-num">{price(sale.pricePence)}</span><i /><span>{sale.stage}</span></div>
          </div>
          <button className="fx-openfile" onClick={onOpenFile}>Open file <ArrowUpRight weight="bold" /></button>
        </div>
      )}

      {sale.concerns.length > 0 && (
        <div className="fx-concerns">
          {sale.concerns.map((con, i) => (
            <div key={i} className="fx-concern" data-tone={con.tone}>
              <span className="fx-concern-ic">{con.kind === "enquiry" ? <ChatCircleDots weight="fill" /> : <MagnifyingGlass weight="bold" />}</span>
              <div className="fx-concern-b"><strong>{con.title}</strong><span>{con.detail}</span></div>
              <div className="fx-concern-act"><Button variant="subtle" size="sm" onClick={onOpenFile}>Open</Button></div>
            </div>
          ))}
        </div>
      )}

      <div className="fx-sides" data-single={sides.length === 1 || undefined}>
        {sides.map((s) => (
          <SideBlock key={s.kind} side={s} onCompose={() => onCompose(s)} onCall={() => onCall(s)} onAlready={() => onAlready(s)} onNotRequired={() => onNotRequired(s)} onUnpark={() => onUnpark(s)} />
        ))}
      </div>
    </div>
  );
}

function SideBlock({ side, onCompose, onCall, onAlready, onNotRequired, onUnpark }: {
  side: Side; onCompose: () => void; onCall: () => void; onAlready: () => void; onNotRequired: () => void; onUnpark: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const st = sideStatus(side);
  const covered = sideCovered(side);
  const comms = [...side.comms].sort((a, b) => a.daysAgo - b.daysAgo);
  const shown = showAll ? comms : comms.slice(0, 3);
  return (
    <div className="fx-side" data-dim={side.parked || undefined}>
      <div className="fx-side-h">
        <span className="fx-side-k" data-k={side.kind}>{side.kind === "vendor" ? "Seller" : "Buyer"}</span>
        <span className="fx-side-name">{side.names}</span>
      </div>
      <span className={`fx-side-status ${st.cls}`}>{st.icon ? (() => { const Ic = st.icon; return <Ic weight="fill" />; })() : null}{st.text}</span>

      <div className="fx-hist">
        {comms.length === 0 ? <p className="fx-hist-empty">No contact on record yet.</p> : shown.map((m, i) => <HistoryLine key={i} m={m} />)}
        {comms.length > 3 && <button className="fx-hist-more" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show less" : `${comms.length - 3} earlier`}</button>}
      </div>

      {covered ? (
        <div className="fx-sacts">
          <span className="fx-covered"><CheckCircle weight="fill" />{side.parked ? "Parked this week" : "Done this week"}<button onClick={onUnpark}>undo</button></span>
        </div>
      ) : (
        <div className="fx-sacts">
          <button className="fx-act fx-act--primary" onClick={onCompose}><PaperPlaneTilt weight="fill" />Email</button>
          <button className="fx-act" onClick={onCall}><PhoneCall weight="fill" />Log call</button>
          <button className="fx-act fx-act--muted" onClick={onAlready}><ClipboardText weight="regular" />Already emailed</button>
          <button className="fx-act fx-act--muted" onClick={onNotRequired}><Moon weight="regular" />Not needed</button>
        </div>
      )}
    </div>
  );
}

function HistoryLine({ m }: { m: Comm }) {
  const Icon = CH_ICON[m.channel];
  const tone = pipTone(m.state);
  return (
    <div className="fx-hline">
      <span className="fx-hline-ic" data-ch={m.channel}><Icon weight="fill" /><span className={`fx-hline-pip fx-dot-${tone}`} /></span>
      <span className="fx-hline-b">
        <span className="fx-hline-t">{m.subject ?? m.preview ?? STATE_LABEL[m.state]}</span>
        <span className="fx-hline-s">{dirWord(m)} · {STATE_LABEL[m.state]}{m.automated && <span className="fx-hline-auto">auto</span>}</span>
      </span>
      <span className="fx-hline-when fx-num">{rel(m.daysAgo)}</span>
    </div>
  );
}

// ── caught-up / empty ───────────────────────────────────────────────────────
function CaughtUp({ lens }: { lens: Lens }) {
  const copy = lens === "awaiting"
    ? { t: "Nobody's left hanging", b: "Every message you've sent has had a reply." }
    : lens === "coverage"
    ? { t: "Every side covered", b: "You've reached both clients on every active sale this week." }
    : { t: "You're all caught up", b: "Nothing urgent across your book right now. Nicely done." };
  return (
    <div className="fx-caught">
      <span className="fx-caught-ic">{lens === "awaiting" ? <ChatCircleDots weight="fill" /> : <Sparkle weight="fill" />}</span>
      <h3>{copy.t}</h3><p>{copy.b}</p>
    </div>
  );
}

// ── mock composer / call bodies + send buttons ──────────────────────────────
function ComposeBody({ compose }: { compose: { sale: Sale; side: Side } }) {
  return (
    <div className="fx-form">
      <div className="fx-form-to">To <b>{compose.side.names}</b><span style={{ color: "var(--lg-ink-3)" }}>· {compose.side.kind === "vendor" ? "Seller" : "Buyer"}, {compose.sale.line1}</span></div>
      <Field label="Subject"><Input defaultValue="Update on your sale" id="fx-subj" /></Field>
      <Field label="Message"><Textarea rows={5} defaultValue={`Hi ${extractFirstName(compose.side.names)},\n\nA quick update on ${compose.sale.line1} — `} /></Field>
    </div>
  );
}
function ComposeSend({ onSend }: { compose: { sale: Sale; side: Side }; onSend: (subject: string) => void }) {
  return <Button variant="primary" size="sm" onClick={() => { const el = document.getElementById("fx-subj") as HTMLInputElement | null; onSend(el?.value ?? ""); }}><PaperPlaneTilt weight="fill" /> Send</Button>;
}
function CallBody({ side, who }: { side: Side; who: string }) {
  return (
    <div className="fx-form">
      <div className="fx-form-to">Call with <b>{side.names}</b><span style={{ color: "var(--lg-ink-3)" }}>· {who}</span></div>
      <Field label="What was said?" hint="Internal note only — the client never sees this."><Textarea id="fx-note" rows={4} placeholder="e.g. Reassured them on the search delay; chasing the local authority." /></Field>
    </div>
  );
}
function CallSave({ onSave }: { onSave: (note: string) => void }) {
  return <Button variant="primary" size="sm" onClick={() => { const el = document.getElementById("fx-note") as HTMLTextAreaElement | null; onSave(el?.value ?? ""); }}><Check weight="bold" /> Save call</Button>;
}
