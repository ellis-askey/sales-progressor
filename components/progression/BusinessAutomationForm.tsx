"use client";

// components/progression/BusinessAutomationForm.tsx
//
// The "Automation" tab of the owner's settings area (critiques #22, #23). Change the
// chases that run for the whole business (set once in the welcome pop-up, editable
// here) plus the auto-send-chain-invites toggle. Owner-gated server-side by
// saveBusinessAutomationAction. Enforced future-only by the chase engines.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { saveBusinessAutomationAction } from "@/app/actions/progression-clients";
import type { ProgressorAutomation } from "@/lib/services/progressor-chase-prefs";

type Key = keyof ProgressorAutomation;

const CHASES: Array<{ key: Key; title: string; desc: string }> = [
  { key: "client",    title: "Client chases",         desc: "Nudge buyers and sellers to confirm each step in their portal." },
  { key: "solicitor", title: "Solicitor chases",      desc: "Ask solicitors to confirm the steps that are waiting on them." },
  { key: "enquiries", title: "Enquiry chases",        desc: "Chase solicitors to raise and reply to the legal enquiries. (You're still alerted if enquiries stall, even with this off.)" },
  { key: "weekly",    title: "Weekly client updates", desc: "A short weekly note reassuring each client their sale's on track." },
  { key: "chain",     title: "Chain updates",         desc: "Tell connected agents when a step moves on a linked sale." },
];

const INVITES: { key: Key; title: string; desc: string } = {
  key: "autoChainInvites",
  title: "Auto-send chain invites",
  desc: "When you add a sale with onward or related links, invite those connected agents automatically. With this off, you send each invite yourself from the chain.",
};

export function BusinessAutomationForm({ initial }: { initial: ProgressorAutomation }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [state, setState] = useState<ProgressorAutomation>(initial);
  const [saving, setSaving] = useState(false);

  const dirty = (Object.keys(state) as Key[]).some((k) => state[k] !== initial[k]);

  async function handleSave() {
    setSaving(true);
    const res = await saveBusinessAutomationAction(state);
    setSaving(false);
    if (res.ok) { toast.success("Automation settings saved"); router.refresh(); }
    else { toast.error(res.error); }
  }

  const Toggle = ({ k }: { k: Key }) => (
    <button
      type="button"
      role="switch"
      aria-checked={state[k]}
      onClick={() => setState((s) => ({ ...s, [k]: !s[k] }))}
      className={`baf-switch${state[k] ? " on" : ""}`}
      aria-label="Toggle"
    >
      <span className="baf-knob" />
    </button>
  );

  const Row = ({ title, desc, k }: { title: string; desc: string; k: Key }) => (
    <div className="baf-row">
      <div className="baf-tx">
        <span className="baf-t">{title}</span>
        <span className="baf-d">{desc}</span>
      </div>
      <Toggle k={k} />
    </div>
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
      title="Chases & automation"
      subtitle="Choose which chases we run across your whole book. They're on by default — switch off any you'd rather handle yourself."
      headerAction={saveButton("baf-save-desktop")}
    >
      <div className="baf-group">
        {CHASES.map((c) => <Row key={c.key} title={c.title} desc={c.desc} k={c.key} />)}
      </div>

      <p className="baf-section">Chain invites</p>
      <div className="baf-group">
        <Row title={INVITES.title} desc={INVITES.desc} k={INVITES.key} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        {saveButton("baf-save-mobile")}
      </div>

      <style>{`
        .baf-group { display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); }
        .baf-row { display: flex; gap: 14px; align-items: flex-start; padding: 15px; background: #fff; border-top: 1px solid rgba(0,0,0,0.07); }
        .baf-row:first-child { border-top: 0; }
        .baf-tx { flex: 1; min-width: 0; }
        .baf-t { display: block; font-size: 13.8px; font-weight: 700; color: #111827; letter-spacing: -0.2px; }
        .baf-d { display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: #6b7280; }
        .baf-section { margin: 22px 2px 10px; font-size: 10px; font-weight: 600; letter-spacing: 0.7px; text-transform: uppercase; color: #9ca3af; }
        .baf-switch { position: relative; height: 24px; width: 42px; border-radius: 999px; border: 0; padding: 0; flex-shrink: 0; margin-top: 1px; background: rgba(0,0,0,0.18); cursor: pointer; transition: background 140ms ease; }
        .baf-switch.on { background: #FF6B4A; }
        .baf-knob { position: absolute; top: 2px; left: 2px; height: 20px; width: 20px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.22); transition: transform 150ms cubic-bezier(0.34,1.3,0.64,1); }
        .baf-switch.on .baf-knob { transform: translateX(18px); }
        .baf-save-mobile { display: none; }
        @media (max-width: 640px) {
          .baf-save-desktop { display: none !important; }
          .baf-save-mobile { display: inline-flex !important; }
        }
      `}</style>
    </AccountCard>
  );
}
