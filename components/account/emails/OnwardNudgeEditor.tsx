"use client";

// components/account/emails/OnwardNudgeEditor.tsx
//
// Tier-2 editor for the onward / related nudge (h3xwf6). One family, four
// variants: {onward, related} × {set up, update}. A director edits the subject,
// opening line, body and button label; the greeting, the woven-in property
// address and the reply footer are ours. Full prose control, their version or
// ours. Mirrors ExchangeDayClientEditor's load / save / reset / preview shape.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch } from "@/components/icons/ph";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";

type Direction = "onward" | "related";
type Mode = "setup" | "update";
type Content = { subject: string; lead: string; body: string; cta: string };
type Resolved = { source: "agency" | "default"; effective: Content; base: Content };

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "var(--agent-text-primary)";
const MUTED = "var(--agent-text-muted)";
const FAINT = "var(--agent-text-tertiary)";
const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: "onward", label: "Onward purchase" },
  { id: "related", label: "Related sale" },
];
const MODES: { id: Mode; label: string }[] = [
  { id: "setup", label: "Set up" },
  { id: "update", label: "Update" },
];

const emDash = String.fromCharCode(0x2014);
function warnOf(label: string, val: string): string[] {
  const w: string[] = [];
  if (val.includes(emDash)) w.push(`${label}: try a comma or full stop instead of a long dash.`);
  if (val.includes("!")) w.push(`${label}: client emails tend to read better without exclamation marks.`);
  return w;
}

export function OnwardNudgeEditor({ base = "/api/agent/email-templates" }: { base?: string } = {}) {
  const [direction, setDirection] = useState<Direction>("onward");
  const [mode, setMode] = useState<Mode>("setup");
  const variant = `${direction}_${mode}`;
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
      const res = await fetch(`${base}/resolve?templateKey=onward_nudge&variant=${variant}`);
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, [variant, base]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!resolved) return;
    setDraft({ ...resolved.effective });
    setEditing(true);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`${base}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: "onward_nudge", variant, content: draft }),
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
        body: JSON.stringify({ templateKey: "onward_nudge", variant }),
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

  const warnings: string[] = [];
  if (draft) {
    warnings.push(...warnOf("Subject", draft.subject));
    warnings.push(...warnOf("Opening line", draft.lead));
    warnings.push(...warnOf("Body", draft.body));
    warnings.push(...warnOf("Button label", draft.cta));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>Onward / related nudge</p>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
            {direction === "onward"
              ? "Sent when you ask a seller to set up or update the onward property they're buying, in their portal."
              : "Sent when you ask a buyer to set up or update the sale of the property they're moving from, in their portal."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SegmentedSwitch options={DIRECTIONS} value={direction} onChange={setDirection} ariaLabel="Onward purchase or related sale" size="sm" />
          <SegmentedSwitch options={MODES} value={mode} onChange={setMode} ariaLabel="Set up or update" size="sm" />
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: MUTED, padding: "8px 2px" }}>
          <CircleNotch size={16} className="agent-spin" /> Loading…
        </div>
      ) : !resolved ? null : editing && draft ? (
        <Editor draft={draft} setDraft={setDraft} warnings={warnings} saving={saving} onSave={save} onCancel={() => setEditing(false)} />
      ) : (
        <Preview resolved={resolved} onEdit={startEdit} onReset={reset} resetting={resetting} />
      )}
    </div>
  );
}

function Preview({ resolved, onEdit, onReset, resetting }: { resolved: Resolved; onEdit: () => void; onReset: () => void; resetting: boolean }) {
  const e = resolved.effective;
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
            <Pencil size={14} /> Edit
          </Button>
        </div>
      </div>

      <div style={{ overflow: "hidden", borderRadius: 11, border: HAIRLINE, background: "#fcfcfd" }}>
        <div style={{ borderBottom: HAIRLINE, padding: "11px 16px" }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Subject</p>
          <p style={{ margin: "3px 0 0", fontSize: 14, color: TEXT }}>{e.subject}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: TEXT }}>Hi Sam,</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>{e.lead}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>{e.body}</p>
          <span style={{ display: "inline-block", width: "fit-content", borderRadius: 8, background: "var(--agent-coral, #FF6B4A)", padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {e.cta}
          </span>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview shows an example greeting. The property address is woven into the opening line when we have it, and we&apos;ll add a &ldquo;reply to update&rdquo; footer.
      </p>
    </div>
  );
}

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

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 5,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: FAINT,
};

function Editor({ draft, setDraft, warnings, saving, onSave, onCancel }: {
  draft: Content;
  setDraft: (c: Content) => void;
  warnings: string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
      <LabelInput field="Subject" label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} fullWidth accent="#FF6B4A" />

      <label style={{ display: "block" }}>
        <span style={labelStyle}>Opening line</span>
        <textarea value={draft.lead} onChange={(e) => setDraft({ ...draft, lead: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </label>

      <label style={{ display: "block" }}>
        <span style={labelStyle}>Body</span>
        <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </label>

      <LabelInput field="Button label" label="Button label" value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} fullWidth accent="#FF6B4A" />

      <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
        The greeting, the property address and the reply footer are added for you. Leave a field blank to keep the Sales Progressor default for it.
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
