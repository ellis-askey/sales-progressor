"use client";

// components/account/emails/OnwardNudgeEditor.tsx
//
// Tier-2 editor for the onward / related nudge (h3xwf6). One family, four
// variants: {onward, related} × {set up, update}. A director edits the subject,
// opening line, body and button label; the greeting, the woven-in property
// address and the reply footer are ours. Full prose control, their version or
// ours. Mirrors ExchangeDayClientEditor's load / save / reset / preview shape.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch, Warning } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Direction = "onward" | "related";
type Mode = "setup" | "update";
type Content = { subject: string; lead: string; body: string; cta: string };
type Resolved = { source: "agency" | "default"; effective: Content; base: Content };

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "onward", label: "Onward purchase" },
  { value: "related", label: "Related sale" },
];
const MODES: { value: Mode; label: string }[] = [
  { value: "setup", label: "Set up" },
  { value: "update", label: "Update" },
];

const emDash = String.fromCharCode(0x2014);
function warnOf(label: string, val: string): string[] {
  const w: string[] = [];
  if (val.includes(emDash)) w.push(`${label}: swap the long dash for a comma or full stop.`);
  if (val.includes("!")) w.push(`${label}: client emails read calmer without exclamation marks.`);
  return w;
}

export function OnwardNudgeEditor() {
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
      const res = await fetch(`/api/agent/email-templates/resolve?templateKey=onward_nudge&variant=${variant}`);
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, [variant]);

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
      const res = await fetch("/api/agent/email-templates/save", {
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
      await fetch("/api/agent/email-templates/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: "onward_nudge", variant }),
      });
      await load();
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
          <Segmented value={direction} onChange={(v) => setDirection(v as Direction)} options={DIRECTIONS} />
          <Segmented value={mode} onChange={(v) => setMode(v as Mode)} options={MODES} />
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

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "inline-flex", width: "fit-content", border: HAIRLINE, borderRadius: 9, background: "#f7f7f8", padding: 3 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{ borderRadius: 6, border: "none", padding: "6px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 120ms, color 120ms, box-shadow 120ms", color: active ? "var(--agent-coral-deep, #E2452A)" : MUTED, background: active ? "#fff" : "transparent", boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Preview({ resolved, onEdit, onReset, resetting }: { resolved: Resolved; onEdit: () => void; onReset: () => void; resetting: boolean }) {
  const e = resolved.effective;
  return (
    <div style={{ border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        {resolved.source === "agency" ? (
          <span style={{ borderRadius: 999, border: "0.5px solid rgba(255,107,74,0.4)", background: "rgba(255,107,74,0.10)", padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "var(--agent-coral-deep, #E2452A)" }}>Your version</span>
        ) : (
          <span style={{ borderRadius: 999, border: HAIRLINE, background: "#f7f7f8", padding: "3px 10px", fontSize: 11, fontWeight: 600, color: MUTED }}>Sales Progressor default</span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {resolved.source === "agency" && (
            <button type="button" onClick={onReset} disabled={resetting} className="account-emails-ghostbtn" style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, border: HAIRLINE, background: "#fff", padding: "7px 12px", fontSize: 13, fontWeight: 600, color: TEXT, cursor: resetting ? "default" : "pointer", opacity: resetting ? 0.55 : 1 }}>
              <ArrowCounterClockwise size={14} />
              {resetting ? "Resetting…" : "Reset to Sales Progressor"}
            </button>
          )}
          <button type="button" onClick={onEdit} className="agent-btn agent-btn-primary agent-btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      <div style={{ overflow: "hidden", borderRadius: 11, border: HAIRLINE, background: "#fcfcfd" }}>
        <div style={{ borderBottom: HAIRLINE, padding: "11px 16px" }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Subject</p>
          <p style={{ margin: "3px 0 0", fontSize: 14, color: TEXT }}>{e.subject}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: TEXT }}>Hi Sam,</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{e.lead}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{e.body}</p>
          <span style={{ display: "inline-block", width: "fit-content", borderRadius: 8, background: "var(--agent-coral, #FF6B4A)", padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {e.cta}
          </span>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview shows an example greeting. The property address is woven into the opening line when we have it, and a &ldquo;reply to update&rdquo; footer is added automatically.
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
      <label style={{ display: "block" }}>
        <span style={labelStyle}>Subject</span>
        <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} style={inputStyle} />
      </label>

      <label style={{ display: "block" }}>
        <span style={labelStyle}>Opening line</span>
        <textarea value={draft.lead} onChange={(e) => setDraft({ ...draft, lead: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </label>

      <label style={{ display: "block" }}>
        <span style={labelStyle}>Body</span>
        <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </label>

      <label style={{ display: "block" }}>
        <span style={labelStyle}>Button label</span>
        <input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} style={inputStyle} />
      </label>

      <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
        The greeting, the property address and the reply footer are added for you. Leave a field blank to keep the Sales Progressor default for it.
      </p>

      {warnings.length > 0 && (
        <div style={{ borderRadius: 10, border: "0.5px solid rgba(217,119,6,0.35)", background: "rgba(251,191,36,0.10)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {warnings.map((w, i) => (
            <p key={i} style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "#92610a" }}>
              <Warning size={14} weight="fill" style={{ marginTop: 1, flexShrink: 0, color: "#d97706" }} />
              {w}
            </p>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={onSave} disabled={saving} className="agent-btn agent-btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="account-emails-ghostbtn" style={{ borderRadius: 9, border: HAIRLINE, background: "#fff", padding: "9px 16px", fontSize: 13.5, fontWeight: 600, color: TEXT, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
