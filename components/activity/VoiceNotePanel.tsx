"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Record (browser speech, with a typed fallback so it works everywhere) → extract
// → editable review → apply. All applying goes through applyVoiceUpdateAction,
// which reuses the same actions the agent uses by hand. See docs/active/log-an-update/SPEC.md.

import { useEffect, useRef, useState } from "react";
import { applyVoiceUpdateAction } from "@/app/actions/voice-update";
import type { VoicePlan, PlanMilestone } from "@/lib/voice-update/plan";
import { ContactAvatar } from "@/components/ui/Avatar";
import { extractFirstName } from "@/lib/contacts/displayName";

type ClientContact = { id: string; name: string; roleType: string };
type Phase = "record" | "working" | "review";

function fmtTime(s: number) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${r < 10 ? "0" : ""}${r}`; }
function CheckSvg() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>; }

export function VoiceNotePanel({
  transactionId,
  contacts,
  onDone,
}: {
  transactionId: string;
  contacts: ClientContact[];
  onDone: (summary: { milestones: number; todos: number; sends: number; enquiry: boolean }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("record");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [supported, setSupported] = useState(true);
  const [plan, setPlan] = useState<VoicePlan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const recRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseRef = useRef("");

  // Review edit state
  const [msOn, setMsOn] = useState<Record<string, boolean>>({});
  const [msDate, setMsDate] = useState<Record<string, string>>({});
  const [msDesktop, setMsDesktop] = useState<Record<string, boolean>>({});
  const [enqOn, setEnqOn] = useState(true);
  const [enqSide, setEnqSide] = useState<"seller_solicitor" | "buyer_solicitor">("seller_solicitor");
  const [todoOn, setTodoOn] = useState<boolean[]>([]);
  const [todoTitle, setTodoTitle] = useState<string[]>([]);
  const [todoDate, setTodoDate] = useState<string[]>([]);
  const [sellerOn, setSellerOn] = useState(true);
  const [buyerOn, setBuyerOn] = useState(true);
  const [noteOn, setNoteOn] = useState(true);
  const [sellerText, setSellerText] = useState("");
  const [buyerText, setBuyerText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [sellerRecips, setSellerRecips] = useState<string[]>([]);
  const [buyerRecips, setBuyerRecips] = useState<string[]>([]);

  const sellers = contacts.filter((c) => c.roleType === "vendor");
  const buyers = contacts.filter((c) => c.roleType === "purchaser");

  useEffect(() => {
    const SR = (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-GB";
    rec.onresult = (e: any) => {
      let interim = "";
      let finalAdd = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalAdd += t; else interim += t;
      }
      if (finalAdd) baseRef.current = (baseRef.current + " " + finalAdd).trim();
      setTranscript((baseRef.current + " " + interim).trim());
    };
    rec.onend = () => { setRecording(false); };
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* noop */ } };
  }, []);

  useEffect(() => {
    if (recording) { timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000); }
    else if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recording]);

  function startRec() {
    if (!recRef.current) return;
    baseRef.current = transcript;
    setSecs(0); setRecording(true);
    try { recRef.current.start(); } catch { /* already started */ }
  }
  function stopRec() { try { recRef.current?.stop(); } catch { /* noop */ } setRecording(false); }

  async function analyse() {
    const text = transcript.trim();
    if (!text) { setErr("Add a few words first."); return; }
    stopRec();
    setErr(null); setPhase("working");
    try {
      const res = await fetch("/api/ai/extract-update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId, transcript: text }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Couldn't read that."); }
      const { plan: p } = (await res.json()) as { plan: VoicePlan };
      initReview(p);
      setPlan(p);
      setPhase("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("record");
    }
  }

  function initReview(p: VoicePlan) {
    const on: Record<string, boolean> = {}; const dt: Record<string, string> = {}; const dk: Record<string, boolean> = {};
    for (const m of p.milestones) { on[m.code] = true; dt[m.code] = ""; dk[m.code] = false; }
    setMsOn(on); setMsDate(dt); setMsDesktop(dk);
    setEnqOn(!!p.enquiry); if (p.enquiry) setEnqSide(p.enquiry.flipsCourtTo);
    setTodoOn(p.todos.map(() => true)); setTodoTitle(p.todos.map((t) => t.title)); setTodoDate(p.todos.map((t) => t.dueDate ?? ""));
    setSellerText(p.drafts.sellerMessage); setBuyerText(p.drafts.buyerMessage); setNoteText(p.drafts.internalNote);
    setSellerOn(!!p.drafts.sellerMessage && sellers.length > 0); setBuyerOn(!!p.drafts.buyerMessage && buyers.length > 0); setNoteOn(!!p.drafts.internalNote);
    setSellerRecips(sellers.map((c) => c.id)); setBuyerRecips(buyers.map((c) => c.id));
  }

  const sendCount = (sellerOn && sellerRecips.length && sellerText.trim() ? 1 : 0) + (buyerOn && buyerRecips.length && buyerText.trim() ? 1 : 0);
  const fileChanges = (plan?.milestones.filter((m) => msOn[m.code]).length ?? 0) + (enqOn && plan?.enquiry ? 1 : 0) + todoOn.filter(Boolean).length;

  async function approve() {
    if (!plan) return;
    setApplying(true); setErr(null);
    const sends: { contactIds: string[]; content: string; generatedText?: string }[] = [];
    if (sellerOn && sellerRecips.length && sellerText.trim()) sends.push({ contactIds: sellerRecips, content: sellerText.trim(), generatedText: plan.drafts.sellerMessage });
    if (buyerOn && buyerRecips.length && buyerText.trim()) sends.push({ contactIds: buyerRecips, content: buyerText.trim(), generatedText: plan.drafts.buyerMessage });
    try {
      const res = await applyVoiceUpdateAction({
        transactionId,
        milestones: plan.milestones.filter((m) => msOn[m.code]).map((m) => ({ code: m.code, eventDate: m.needsEventDate ? (msDesktop[m.code] ? null : (msDate[m.code] || null)) : null })),
        enquiry: enqOn && plan.enquiry ? { flipsCourtTo: enqSide } : null,
        todos: plan.todos.map((_, i) => ({ title: todoTitle[i], dueDate: todoDate[i] || null })).filter((_, i) => todoOn[i] && todoTitle[i]?.trim()),
        sends,
        note: noteOn && noteText.trim() ? noteText.trim() : null,
        transcript: plan.transcript,
      });
      if (!res.ok) throw new Error(res.error);
      onDone(res.summary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't apply that.");
      setApplying(false);
    }
  }

  // ---- render ----
  if (phase === "working") {
    return (
      <div className="lum-fade" style={{ textAlign: "center", padding: "40px 10px" }}>
        <div className="lum-shimmer" />
        <p style={{ marginTop: 16, fontSize: 14, color: "var(--agent-text-secondary,#5A3A28)" }}>Reading your note…</p>
      </div>
    );
  }

  if (phase === "record") {
    return (
      <div className="lum-fade lum-rec">
        {supported ? (
          <>
            <div className="lum-listen" data-on={recording ? "1" : undefined}><span className="lum-blip" /> {recording ? "Listening" : "Ready"}</div>
            <div className="lum-rectime">{fmtTime(secs)}</div>
            <div className={"lum-wave" + (recording ? " on" : "")}>{Array.from({ length: 28 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.045}s` }} />)}</div>
          </>
        ) : (
          <p className="lum-help" style={{ textAlign: "center", marginTop: 0 }}>Your browser can&rsquo;t record voice, so type the note instead. We&rsquo;ll still pull out the updates.</p>
        )}
        <textarea className="lum-ta" style={{ marginTop: 14, minHeight: 110 }} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder={supported ? "Your words appear here as you talk. You can tidy them before analysing." : "e.g. Spoke to the buyer's solicitor, searches are back and clear, they've raised enquiries to the seller's side, offer expected Friday."} />
        {err && <p className="lum-err">{err}</p>}
        <div className="lum-recbtns">
          {supported && (
            <button type="button" className="lum-btn lum-recbtn" onClick={recording ? stopRec : startRec}>
              <span dangerouslySetInnerHTML={{ __html: recording
                ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>'
                : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>' }} />
              {recording ? "Stop" : transcript.trim() ? "Resume" : "Start recording"}
            </button>
          )}
          <button type="button" className="lum-btn lum-primary" disabled={!transcript.trim()} onClick={analyse}>Analyse this</button>
        </div>
      </div>
    );
  }

  // review
  return (
    <div className="lum-fade">
      <p className="lum-help" style={{ margin: "2px 0 0" }}>Here&rsquo;s what we picked up. Edit anything, nothing happens until you approve.</p>

      {(plan!.milestones.length > 0 || plan!.enquiry || plan!.todos.length > 0) && <p className="lum-eyebrow" style={{ marginTop: 18 }}>Update the file</p>}

      {plan!.milestones.map((m: PlanMilestone) => (
        <div key={m.code} className="lum-checkrow" aria-pressed={msOn[m.code]} onClick={() => setMsOn((p) => ({ ...p, [m.code]: !p[m.code] }))}>
          <span className="lum-cbx"><CheckSvg /></span>
          <div style={{ flex: 1 }}>
            <div className="lum-cr-t">Mark &ldquo;{m.name}&rdquo;</div>
            {m.isPrereq && <div className="lum-cr-s">Requires previous step</div>}
            {msOn[m.code] && m.needsEventDate && (
              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input type="date" className="lum-ta" style={{ width: "auto", marginTop: 0, padding: "7px 10px" }} value={msDate[m.code]} disabled={msDesktop[m.code]} onChange={(e) => setMsDate((p) => ({ ...p, [m.code]: e.target.value }))} />
                {m.code === "PM6" && (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--agent-text-secondary,#5A3A28)", cursor: "pointer" }}>
                    <input type="checkbox" checked={msDesktop[m.code]} onChange={(e) => setMsDesktop((p) => ({ ...p, [m.code]: e.target.checked }))} /> Desktop, no visit
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {plan!.enquiry && (
        <div className="lum-checkrow" aria-pressed={enqOn} onClick={() => setEnqOn((v) => !v)}>
          <span className="lum-cbx"><CheckSvg /></span>
          <div style={{ flex: 1 }}>
            <div className="lum-cr-t">Move the enquiries</div>
            <div onClick={(e) => e.stopPropagation()} className="lum-seg" style={{ marginTop: 8 }}>
              <button aria-pressed={enqSide === "seller_solicitor"} onClick={() => setEnqSide("seller_solicitor")}>To the seller&rsquo;s solicitor</button>
              <button aria-pressed={enqSide === "buyer_solicitor"} onClick={() => setEnqSide("buyer_solicitor")}>To the buyer&rsquo;s solicitor</button>
            </div>
          </div>
        </div>
      )}

      {plan!.todos.map((_t, i) => (
        <div key={i} className="lum-checkrow" aria-pressed={todoOn[i]} onClick={() => setTodoOn((p) => p.map((v, j) => (j === i ? !v : v)))}>
          <span className="lum-cbx"><CheckSvg /></span>
          <div style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
            <input type="text" className="lum-ta" style={{ marginTop: 0, padding: "8px 11px", fontWeight: 600 }} value={todoTitle[i]} onChange={(e) => setTodoTitle((p) => p.map((v, j) => (j === i ? e.target.value : v)))} />
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--agent-text-muted,rgba(45,24,16,.55))", display: "flex", gap: 8, alignItems: "center" }}>
              Due <input type="date" className="lum-ta" style={{ width: "auto", marginTop: 0, padding: "6px 10px" }} value={todoDate[i]} onChange={(e) => setTodoDate((p) => p.map((v, j) => (j === i ? e.target.value : v)))} />
            </div>
          </div>
        </div>
      ))}

      {(sellers.length > 0 && plan!.drafts.sellerMessage) || (buyers.length > 0 && plan!.drafts.buyerMessage) || plan!.drafts.internalNote ? <p className="lum-eyebrow" style={{ marginTop: 18 }}>Portal updates</p> : null}

      {sellers.length > 0 && plan!.drafts.sellerMessage && (
        <SideCard eye="Seller update" eyeClass="seller" on={sellerOn} setOn={setSellerOn} text={sellerText} setText={setSellerText} people={sellers} recips={sellerRecips} setRecips={setSellerRecips} />
      )}
      {buyers.length > 0 && plan!.drafts.buyerMessage && (
        <SideCard eye="Buyer update" eyeClass="buyer" on={buyerOn} setOn={setBuyerOn} text={buyerText} setText={setBuyerText} people={buyers} recips={buyerRecips} setRecips={setBuyerRecips} />
      )}
      {plan!.drafts.internalNote && (
        <div className={"lum-sidecard" + (noteOn ? "" : " off")}>
          <div className="lum-sc-head"><span className="lum-sc-eye note">File note · internal only</span><span style={{ flex: 1 }} /><button className="lum-sw" aria-pressed={noteOn} onClick={() => setNoteOn((v) => !v)} /></div>
          <textarea className="lum-ta" style={{ minHeight: 60 }} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        </div>
      )}

      {err && <p className="lum-err">{err}</p>}
      <div className="lum-sendbar">
        <button className="lum-btn lum-primary lum-wide" disabled={applying || (sendCount === 0 && fileChanges === 0)} onClick={approve}>
          {applying ? "Applying…" : sendCount > 0 ? `Approve and send ${sendCount} update${sendCount === 1 ? "" : "s"}` : `Apply ${fileChanges} change${fileChanges === 1 ? "" : "s"}`}
        </button>
        {sendCount > 0 && fileChanges > 0 && <p className="lum-sub">and {fileChanges} change{fileChanges === 1 ? "" : "s"} to the file</p>}
      </div>
    </div>
  );
}

function SideCard({ eye, eyeClass, on, setOn, text, setText, people, recips, setRecips }: {
  eye: string; eyeClass: string; on: boolean; setOn: (f: (v: boolean) => boolean) => void;
  text: string; setText: (v: string) => void; people: ClientContact[]; recips: string[]; setRecips: (f: (v: string[]) => string[]) => void;
}) {
  return (
    <div className={"lum-sidecard" + (on ? "" : " off")}>
      <div className="lum-sc-head"><span className={"lum-sc-eye " + eyeClass}>{eye}</span><span style={{ flex: 1 }} /><button className="lum-sw" aria-pressed={on} onClick={() => setOn((v) => !v)} /></div>
      <textarea className="lum-ta" style={{ minHeight: 78 }} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="lum-pills" style={{ marginTop: 10 }}>
        <span className="lum-grouplab" style={{ width: "100%", marginBottom: 2 }}>To</span>
        {people.map((c) => {
          const sel = recips.includes(c.id);
          return (
            <button key={c.id} className="lum-pill" aria-pressed={sel} onClick={() => setRecips((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}>
              <span className="lum-av"><ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={22} /><span className="lum-chk"><CheckSvg /></span></span>
              {extractFirstName(c.name)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
