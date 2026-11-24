"use client";

// components/account/emails/CompletionPackEditor.tsx
//
// Tier-2 editor for the completion pack ("Contracts exchanged: what happens
// next"). A director edits the subject, opening line and the completion-day
// checklist, per side (buyer/seller). Full prose control — their version, or
// ours. Same light Account register as the milestone editor.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch, Plus, X } from "@/components/icons/ph";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";

type Content = { subject: string; opening: string; bullets: string[] };
type Resolved = { exists: true; source: "agency" | "default"; effective: Content; base: Content };
type Side = "purchaser" | "vendor";

const SIDE_OPTIONS: { id: Side; label: string }[] = [
  { id: "purchaser", label: "Buyer" },
  { id: "vendor", label: "Seller" },
];

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "var(--agent-text-primary)";
const MUTED = "var(--agent-text-muted)";
const FAINT = "var(--agent-text-tertiary)";
const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

// Example fills so the preview reads like a real email.
const EX_ADDRESS = "12 Example Road, Harlow, CM17 9PH";
const EX_TEAMREF = "Emily or a member of our team";
function fill(t: string): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => (k === "address" ? EX_ADDRESS : k === "teamRef" ? EX_TEAMREF : `{${k}}`));
}

function voiceWarnings(c: Content): string[] {
  const w: string[] = [];
  const emDash = String.fromCharCode(0x2014);
  const check = (label: string, val: string) => {
    if (val.includes(emDash)) w.push(`${label}: try a comma or full stop instead of a long dash.`);
    if (val.includes("!")) w.push(`${label}: client emails tend to read better without exclamation marks.`);
  };
  check("Opening", c.opening);
  c.bullets.forEach((b, i) => check(`Point ${i + 1}`, b));
  return w;
}

export function CompletionPackEditor({
  templateKey = "completion_pack",
  title = "Contracts exchanged: what happens next",
  subtitle = "Sent to your client once contracts exchange, setting out what to expect on completion day.",
  base = "/api/agent/email-templates",
}: {
  templateKey?: string;
  title?: string;
  subtitle?: string;
  base?: string;
} = {}) {
  const [side, setSide] = useState<Side>("purchaser");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Content | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useAgentToast();

  const load = useCallback(async () => {
    setLoading(true);
    setEditing(false);
    try {
      const res = await fetch(`${base}/resolve?templateKey=${templateKey}&variant=${side}`);
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, [side, base, templateKey]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!resolved) return;
    setDraft({ ...resolved.effective, bullets: [...resolved.effective.bullets] });
    setEditing(true);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`${base}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, variant: side, content: draft }),
      });
      if (res.ok) {
        setEditing(false);
        await load();
        toast.success("Saved. Clients see your version from the next send.");
      } else {
        toast.error("Couldn't save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!resolved || resolved.source !== "agency") return;
    setResetting(true);
    try {
      const res = await fetch(`${base}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, variant: side }),
      });
      if (res.ok) {
        await load();
        toast.success("Reset to the Sales Progressor version.");
      } else {
        toast.error("Couldn't reset. Try again.");
      }
    } finally {
      setResetting(false);
    }
  }

  const warnings = draft ? voiceWarnings(draft) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{title}</p>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        <SegmentedSwitch options={SIDE_OPTIONS} value={side} onChange={setSide} ariaLabel="Buyer or seller" size="sm" />
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: MUTED, padding: "8px 2px" }}>
          <CircleNotch size={16} className="agent-spin" /> Loading…
        </div>
      ) : !resolved ? null : editing && draft ? (
        <Editor
          draft={draft}
          setDraft={setDraft}
          warnings={warnings}
          saving={saving}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Preview resolved={resolved} onEdit={startEdit} onReset={reset} resetting={resetting} />
      )}

      <style>{`
        .agent-spin { animation: account-emails-spin 0.7s linear infinite; }
        @keyframes account-emails-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Preview({
  resolved,
  onEdit,
  onReset,
  resetting,
}: {
  resolved: Resolved;
  onEdit: () => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const c = resolved.effective;
  return (
    <div style={{ border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        {resolved.source === "agency" ? (
          <Badge tone="accent">Your version</Badge>
        ) : (
          <Badge tone="neutral">Sales Progressor default</Badge>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {resolved.source === "agency" && (
            <Button variant="secondary" size="sm" onClick={onReset} disabled={resetting}>
              <ArrowCounterClockwise size={14} />
              {resetting ? "Resetting…" : "Reset to Sales Progressor"}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onEdit} style={coralVars}>
            <Pencil size={14} />
            Edit
          </Button>
        </div>
      </div>

      <div style={{ overflow: "hidden", borderRadius: 11, border: HAIRLINE, background: "#fcfcfd" }}>
        <div style={{ borderBottom: HAIRLINE, padding: "11px 16px" }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Subject</p>
          <p style={{ margin: "3px 0 0", fontSize: 14, color: TEXT }}>{c.subject}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: TEXT }}>{fill(c.opening)}</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>What to expect on completion day:</p>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 7 }}>
            {c.bullets.map((b, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>{fill(b)}</li>
            ))}
          </ul>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview uses example details for things like the address and your team. We&apos;ll add the completion date
        once it&apos;s known.
      </p>
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  warnings,
  saving,
  onSave,
  onCancel,
}: {
  draft: Content;
  setDraft: (c: Content) => void;
  warnings: string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const setBullet = (i: number, v: string) => {
    const bullets = [...draft.bullets];
    bullets[i] = v;
    setDraft({ ...draft, bullets });
  };
  const removeBullet = (i: number) => setDraft({ ...draft, bullets: draft.bullets.filter((_, j) => j !== i) });
  const addBullet = () => setDraft({ ...draft, bullets: [...draft.bullets, ""] });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.14)",
    borderRadius: 9,
    background: "#fff",
    padding: "9px 11px",
    fontSize: 14,
    color: TEXT,
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
      <LabelInput field="Subject" label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} fullWidth accent="#FF6B4A" />

      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Opening</span>
        <textarea value={draft.opening} onChange={(e) => setDraft({ ...draft, opening: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </label>

      <div>
        <span style={{ display: "block", marginBottom: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
          What to expect on completion day
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {draft.bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <textarea value={b} onChange={(e) => setBullet(i, e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              <div style={{ flexShrink: 0, marginTop: 4 }}>
                <Button type="button" variant="danger" size="sm" icon onClick={() => removeBullet(i)} aria-label={`Remove point ${i + 1}`}>
                  <X size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Button type="button" variant="secondary" size="sm" onClick={addBullet}>
            <Plus size={14} /> Add a point
          </Button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
        Details like {"{address}"} and {"{teamRef}"} are filled in for each sale when the email sends. Leave them in place.
      </p>

      {warnings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {warnings.map((w, i) => (
            <InlineAlert key={i} kind="warning">{w}</InlineAlert>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="primary" onClick={onSave} disabled={saving} style={coralVars}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
