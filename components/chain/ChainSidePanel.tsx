"use client";

// The Chain-tab right panel — replaces the Sale-health sidebar ONLY on the chain
// tab (ChainAwareSidebar swaps it in). A mini steps view with a seller/buyer
// toggle, then the default notes feed (typed notes, logged calls, step
// confirmations, not-required) with an inline add-a-note box. Data is fetched
// lazily so no other tab pays for it.

import { useState, useEffect, useTransition, useCallback } from "react";
import { ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import { addNoteAction } from "@/app/actions/comms";
import { getChainSidePanelData, type ChainSidePanelData, type SidePanelEntry } from "@/app/actions/chain-side-panel";

function Tick({ state }: { state: "done" | "next" | "todo" }) {
  if (state === "done") {
    return (
      <span className="csp-tk csp-tk--done" aria-hidden>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </span>
    );
  }
  return <span className={`csp-tk ${state === "next" ? "csp-tk--next" : ""}`} aria-hidden />;
}

function EntryRow({ e }: { e: SidePanelEntry }) {
  return (
    <div className="csp-entry">
      <ActorAvatar name={e.who} role={e.whoRole as ActorRole} image={e.whoImage} size={22} />
      <div className="csp-entry-body">
        <div className="csp-entry-top">
          <span className="csp-entry-who">
            {e.kind === "call" && <span className="csp-callico" aria-hidden>📞</span>}
            {e.who}
          </span>
          <span className="csp-entry-when">{e.when}</span>
        </div>
        {(e.kind === "note" || e.kind === "call") && <p className="csp-entry-text">{e.body}</p>}
        {e.kind === "step" && <p className="csp-entry-mark"><span className="csp-dot csp-dot--done" aria-hidden /> {e.body}</p>}
        {e.kind === "nr" && <p className="csp-entry-mark csp-entry-mark--muted"><span className="csp-dot csp-dot--nr" aria-hidden /> {e.body}</p>}
      </div>
    </div>
  );
}

export function ChainSidePanel({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<ChainSidePanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<"seller" | "buyer">("seller");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const load = useCallback(() => {
    getChainSidePanelData(transactionId)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [transactionId]);

  useEffect(() => { load(); }, [load]);

  function addNote() {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    startTransition(async () => {
      try {
        await addNoteAction(transactionId, text);
        setDraft("");
        load();
      } finally {
        setSaving(false);
      }
    });
  }

  const steps = (side === "seller" ? data?.seller : data?.buyer) ?? [];
  const done = steps.filter((s) => s.state === "done").length;

  return (
    <div className="agent-glass csp">
      {/* Seller / Buyer toggle — sliding primary-colour selection */}
      <div className="csp-toggle" role="tablist" aria-label="Side">
        <span className="csp-ind" data-side={side} aria-hidden />
        <button type="button" role="tab" aria-selected={side === "seller"} className={`csp-tgl${side === "seller" ? " on" : ""}`} onClick={() => setSide("seller")}>Seller</button>
        <button type="button" role="tab" aria-selected={side === "buyer"} className={`csp-tgl${side === "buyer" ? " on" : ""}`} onClick={() => setSide("buyer")}>Buyer</button>
      </div>

      {loading ? (
        <div className="csp-skel" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className="csp-skel-row" />)}
        </div>
      ) : (
        <>
          <div className="csp-meta"><span>{done} of {steps.length} done</span></div>
          <ul className="csp-steps">
            {steps.map((s) => (
              <li key={s.code} className={`csp-step csp-step--${s.state}`}>
                <Tick state={s.state} />
                <span className="csp-step-label">{s.label}</span>
                {s.state === "next" && <span className="csp-next">Next</span>}
              </li>
            ))}
            {steps.length === 0 && <li className="csp-empty">No steps yet.</li>}
          </ul>

          <div className="csp-divider" />

          <div className="csp-notes-head"><h4>Notes</h4><span className="csp-hint">On this sale</span></div>
          <div className={`csp-compose${draft ? " on" : ""}`}>
            <textarea className="csp-compose-input" placeholder="Add a note…" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="csp-compose-row">
              <button type="button" className="csp-compose-save" disabled={!draft.trim() || saving} onClick={addNote}>{saving ? "Adding…" : "Add note"}</button>
            </div>
          </div>

          <div className="csp-feed">
            {(data?.entries ?? []).map((e) => <EntryRow key={e.id} e={e} />)}
            {(data?.entries?.length ?? 0) === 0 && <p className="csp-feed-empty">No notes or confirmations yet.</p>}
          </div>
        </>
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.csp{ padding:14px; }
.csp-toggle{ position:relative; display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border-radius:11px;
  background:var(--agent-surface-sunken, rgba(0,0,0,0.04)); border:1px solid var(--agent-border-subtle); }
.csp-ind{ position:absolute; top:4px; bottom:4px; left:4px; width:calc(50% - 6px); border-radius:8px;
  background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.28);
  transition:transform 280ms cubic-bezier(0.22,1,0.36,1); z-index:0; }
.csp-ind[data-side="buyer"]{ transform:translateX(calc(100% + 4px)); }
.csp-tgl{ position:relative; z-index:1; border:1px solid transparent; cursor:pointer; padding:8px 10px; border-radius:8px; font:inherit; font-size:12.5px; font-weight:680; background:transparent; color:var(--agent-text-muted); transition:color .18s, border-color .15s; }
.csp-tgl.on{ color:#fff; }
.csp-tgl:not(.on):hover{ color:var(--agent-text-secondary); border-color:var(--agent-border-default); }
@media (prefers-reduced-motion:reduce){ .csp-ind{ transition:none; } }

.csp-meta{ margin:14px 2px 8px; font-size:11.5px; color:var(--agent-text-muted); font-weight:600; }
.csp-steps{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1px; }
.csp-step{ display:flex; align-items:center; gap:9px; font-size:12.5px; padding:4px 2px; color:var(--agent-text-secondary); }
.csp-step--done{ color:var(--agent-text-muted); }
.csp-step--todo{ color:var(--agent-text-muted); opacity:0.7; }
.csp-step--next{ color:var(--agent-text-primary); font-weight:700; }
.csp-step-label{ flex:1; min-width:0; }
.csp-empty{ list-style:none; font-size:12px; color:var(--agent-text-muted); padding:4px 2px; }
.csp-next{ font-size:10.5px; font-weight:700; color:#fff; background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep)); padding:2px 9px; border-radius:999px; }
.csp-tk{ width:16px; height:16px; border-radius:50%; flex-shrink:0; border:1.5px solid var(--agent-border-default); display:grid; place-items:center; }
.csp-tk--done{ background:rgba(var(--agent-success-rgb),0.14); border-color:rgba(var(--agent-success-rgb),0.4); color:var(--agent-success); }
.csp-tk--next{ border:2px solid var(--agent-coral-deep); }

.csp-divider{ height:1px; background:var(--agent-border-subtle); margin:14px 0; }

.csp-notes-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:10px; }
.csp-notes-head h4{ margin:0; font-size:13.5px; font-weight:740; color:var(--agent-text-primary); }
.csp-hint{ font-size:11px; color:var(--agent-text-muted); }

.csp-compose{ border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated, #fff); border-radius:12px; padding:8px 10px; margin-bottom:16px; transition:border-color .15s; }
.csp-compose:hover{ border-color:var(--agent-border-strong, var(--agent-text-muted)); }
.csp-compose.on{ border-color:var(--agent-coral-deep); }
.csp-compose-input{ width:100%; min-height:30px; height:30px; max-height:160px; border:0; background:transparent; resize:vertical; font:inherit; font-size:12.5px; color:var(--agent-text-primary); outline:none; line-height:1.5; display:block; }
.csp-compose-input::placeholder{ color:var(--agent-text-muted); }
.csp-compose-row{ display:flex; justify-content:flex-end; margin-top:6px; }
.csp-compose-save{ border:1px solid transparent; border-radius:8px; padding:6px 13px; font:inherit; font-size:12px; font-weight:700; color:#fff; background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep)); box-shadow:inset 0 1px 0 rgba(255,255,255,0.28); cursor:pointer; transition:filter .15s; }
.csp-compose-save:hover:not(:disabled){ filter:brightness(1.05); }
.csp-compose-save:disabled{ opacity:0.45; cursor:default; }

.csp-feed{ display:flex; flex-direction:column; gap:14px; }
.csp-feed-empty{ margin:0; font-size:12px; color:var(--agent-text-muted); }
.csp-entry{ display:flex; gap:10px; }
.csp-entry-body{ flex:1; min-width:0; }
.csp-entry-top{ display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:2px; }
.csp-entry-who{ font-size:12.5px; font-weight:700; color:var(--agent-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-flex; align-items:center; gap:5px; }
.csp-callico{ font-size:11px; }
.csp-entry-when{ font-size:10.5px; color:var(--agent-text-muted); flex-shrink:0; }
.csp-entry-text{ margin:0; font-size:12.5px; line-height:1.5; color:var(--agent-text-secondary); }
.csp-entry-mark{ margin:0; font-size:12.5px; font-weight:600; color:var(--agent-text-primary); display:flex; align-items:center; gap:7px; }
.csp-entry-mark--muted{ font-weight:600; color:var(--agent-text-secondary); }
.csp-dot{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.csp-dot--done{ background:var(--agent-success); }
.csp-dot--nr{ background:var(--agent-text-muted); }

.csp-skel{ display:flex; flex-direction:column; gap:10px; margin-top:16px; }
.csp-skel-row{ height:13px; border-radius:6px; background:var(--agent-border-subtle); animation:csp-pulse 1.4s ease-in-out infinite; }
.csp-skel-row:nth-child(even){ width:72%; }
@keyframes csp-pulse{ 0%,100%{ opacity:0.5; } 50%{ opacity:0.9; } }
@media (prefers-reduced-motion:reduce){ .csp-skel-row{ animation:none; } }
`;
