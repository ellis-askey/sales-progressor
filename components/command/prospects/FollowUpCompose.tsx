"use client";

import { useState, useTransition } from "react";
import { draftFollowUpAction, sendProspectEmailAction } from "@/app/actions/prospects";
import { TEMPLATE_OPTIONS } from "@/lib/prospects/templates";

const inputCls = "w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb]";

export function FollowUpCompose({ prospectId, defaultTo, disabled, disabledReason, onSent }: {
  prospectId: string; defaultTo: string | null; disabled: boolean; disabledReason?: string; onSent: () => void;
}) {
  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [genPending, setGenPending] = useState(false);
  const [sendPending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function generate(templateKey?: string) {
    setGenPending(true); setError(null);
    try {
      const r = await draftFollowUpAction(prospectId, templateKey);
      if (!to && r.to) setTo(r.to);
      setSubject(r.subject); setBody(r.body); setAiGenerated(r.aiGenerated);
    } catch {
      setError("Couldn't generate a draft. Write one, or try again.");
    } finally {
      setGenPending(false);
    }
  }

  function send() {
    setError(null);
    startSend(async () => {
      const res = await sendProspectEmailAction(prospectId, { to, subject, body, aiGenerated });
      if (res.ok) onSent();
      else setError(res.error);
    });
  }

  if (disabled) {
    return <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-xs text-amber-500/90">Can&rsquo;t email this prospect: {disabledReason}.</div>;
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => generate()} disabled={genPending} className="text-xs px-2.5 py-1 rounded-md bg-violet-950 text-violet-300 border border-violet-900 hover:bg-violet-900 transition-colors disabled:opacity-40">
          {genPending ? "Thinking…" : "Generate follow-up (AI)"}
        </button>
        <select
          defaultValue=""
          onChange={(e) => { if (e.target.value) generate(e.target.value); e.currentTarget.value = ""; }}
          disabled={genPending}
          className={`${inputCls} w-auto`}
        >
          <option value="" className="bg-neutral-900">Or pick a template…</option>
          {TEMPLATE_OPTIONS.map((t) => <option key={t.key} value={t.key} className="bg-neutral-900">{t.label}</option>)}
        </select>
        {aiGenerated && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-900">AI draft</span>}
      </div>

      <label className="grid gap-1"><span className="text-[11px] text-neutral-500">To</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@agency.co.uk" className={inputCls} /></label>
      <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} /></label>
      <label className="grid gap-1"><span className="text-[11px] text-neutral-500">Body</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={inputCls} /></label>

      <p className="text-[11px] text-neutral-600">Sent from ellis@thesalesprogressor.co.uk with your signature added automatically. Nothing sends until you press Send.</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={send} disabled={sendPending || !to.trim() || !subject.trim() || !body.trim()} className="text-xs px-3 py-1.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 transition-colors disabled:opacity-40">
        {sendPending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
