"use client";

// components/automation/AgencyChaseGrid.tsx
//
// The agency "Automated chasing" toggle grid: the 5 chases we run across a
// self-managed agency's files (Client / Solicitor / Enquiry / Weekly / Chain),
// set once in the welcome pop-up and editable here. The agency counterpart of
// BusinessAutomationForm — same grid, same copy — but it reads/writes the Agency
// flags via getAgentChasePrefs + saveAgentChasePrefsAction (which owns the 5->6
// flag mapping). Director-gated server-side by the action. (Kept as a parallel
// component so the live business form is untouched; a shared presentational grid
// is a later tidy.)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { saveAgentChasePrefsAction } from "@/app/actions/automation";
import type { ProgressorChasePrefs } from "@/lib/services/progressor-chase-prefs";

type Key = keyof ProgressorChasePrefs;

const CHASES: Array<{ key: Key; title: string; desc: string }> = [
  { key: "client",    title: "Client chases",         desc: "Remind buyers and sellers to confirm outstanding steps through their portal." },
  { key: "solicitor", title: "Solicitor chases",      desc: "Follow up with solicitors to confirm the steps they're responsible for." },
  { key: "enquiries", title: "Enquiry chases",        desc: "Chase solicitors to raise enquiries and provide replies. You'll still be alerted if enquiries stall, even with this switched off." },
  { key: "weekly",    title: "Weekly client updates", desc: "Send buyers and sellers a short weekly update on their sale's progress." },
  { key: "chain",     title: "Chain updates",         desc: "Keep connected agents informed when something changes on a linked sale." },
];

export function AgencyChaseGrid({ initial }: { initial: ProgressorChasePrefs }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [state, setState] = useState<ProgressorChasePrefs>(initial);
  const [saving, setSaving] = useState(false);

  const dirty = (Object.keys(state) as Key[]).some((k) => state[k] !== initial[k]);

  async function handleSave() {
    setSaving(true);
    const res = await saveAgentChasePrefsAction(state);
    setSaving(false);
    if (res.ok) { toast.success("Chase settings saved"); router.refresh(); }
    else { toast.error(res.error ?? "Couldn't save. Try again."); }
  }

  const Toggle = ({ k }: { k: Key }) => (
    <button
      type="button"
      role="switch"
      aria-checked={state[k]}
      onClick={() => setState((s) => ({ ...s, [k]: !s[k] }))}
      className={`acg-switch${state[k] ? " on" : ""}`}
      aria-label="Toggle"
    >
      <span className="acg-knob" />
    </button>
  );

  const saveButton = (cls: string) => (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving || !dirty}
      className={`account-btn-primary ${cls}`}
      style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: saving || !dirty ? "default" : "pointer" }}
    >
      {saving ? "Saving…" : "Save changes"}
    </button>
  );

  return (
    <AccountCard
      icon={<Gauge size={20} weight="bold" />}
      title="What we chase"
      subtitle="Choose which chases we handle for you. Switch off anything you'd rather manage yourself."
      headerAction={saveButton("acg-save-desktop")}
    >
      <div className="acg-group">
        {CHASES.map((c) => (
          <div key={c.key} className="acg-row">
            <div className="acg-tx">
              <span className="acg-t">{c.title}</span>
              <span className="acg-d">{c.desc}</span>
            </div>
            <Toggle k={c.key} />
          </div>
        ))}
      </div>

      <p className="acg-note">When a chase is switched off, no automated emails are sent for that chase. Anything needing your attention will still appear in your reminders.</p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        {saveButton("acg-save-mobile")}
      </div>

      <style>{`
        .acg-group { display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); }
        .acg-row { display: flex; gap: 14px; align-items: flex-start; padding: 15px; background: #fff; border-top: 1px solid rgba(0,0,0,0.07); }
        .acg-row:first-child { border-top: 0; }
        .acg-tx { flex: 1; min-width: 0; }
        .acg-t { display: block; font-size: 13.8px; font-weight: 700; color: #111827; letter-spacing: -0.2px; }
        .acg-d { display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: #6b7280; }
        .acg-note { margin: 12px 2px 0; font-size: 12px; line-height: 1.5; color: #9ca3af; }
        .acg-switch { position: relative; height: 24px; width: 42px; border-radius: 999px; border: 0; padding: 0; flex-shrink: 0; margin-top: 1px; background: rgba(0,0,0,0.18); cursor: pointer; transition: background 140ms ease; }
        .acg-switch.on { background: #FF6B4A; }
        .acg-knob { position: absolute; top: 2px; left: 2px; height: 20px; width: 20px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.22); transition: transform 150ms cubic-bezier(0.34,1.3,0.64,1); }
        .acg-switch.on .acg-knob { transform: translateX(18px); }
        .acg-save-mobile { display: none; }
        @media (max-width: 640px) {
          .acg-save-desktop { display: none !important; }
          .acg-save-mobile { display: inline-flex !important; }
        }
      `}</style>
    </AccountCard>
  );
}
