"use client";

// components/account/emails/CompletionPackEditor.tsx
//
// Tier-2 editor for the completion pack ("Contracts exchanged: what happens
// next"). A director edits the subject, opening line and the completion-day
// checklist, per side (buyer/seller). Full prose control — their version, or
// ours. Same light Account register as the milestone editor.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch, Plus, X, Warning } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Content = { subject: string; opening: string; bullets: string[] };
type Resolved = { exists: true; source: "agency" | "default"; effective: Content; base: Content };
type Side = "purchaser" | "vendor";

const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: "purchaser", label: "Buyer" },
  { value: "vendor", label: "Seller" },
];

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";

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
    if (val.includes(emDash)) w.push(`${label}: swap the long dash for a comma or full stop.`);
    if (val.includes("!")) w.push(`${label}: client emails read calmer without exclamation marks.`);
  };
  check("Opening", c.opening);
  c.bullets.forEach((b, i) => check(`Point ${i + 1}`, b));
  return w;
}

export function CompletionPackEditor({
  templateKey = "completion_pack",
  title = "Contracts exchanged: what happens next",
  subtitle = "Sent to your client once contracts exchange, setting out what to expect on completion day.",
}: {
  templateKey?: string;
  title?: string;
  subtitle?: string;
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
      const res = await fetch(`/api/agent/email-templates/resolve?templateKey=${templateKey}&variant=${side}`);
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, [side]);

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
      const res = await fetch("/api/agent/email-templates/save", {
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
      await fetch("/api/agent/email-templates/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, variant: side }),
      });
      await load();
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
        <Segmented value={side} onChange={(v) => setSide(v as Side)} options={SIDE_OPTIONS} />
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
        .account-emails-ghostbtn:hover { background: rgba(0,0,0,0.035) !important; }
        .account-emails-danger:hover { color: #b91c1c !important; }
        .agent-spin { animation: account-emails-spin 0.7s linear infinite; }
        @keyframes account-emails-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "inline-flex", width: "fit-content", border: HAIRLINE, borderRadius: 9, background: "#f7f7f8", padding: 3 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={active ? "account-seg account-seg-on" : "account-seg"}
            style={{
              borderRadius: 6,
              border: "none",
              padding: "6px 13px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 120ms, color 120ms, box-shadow 120ms, transform 90ms",
              color: active ? "var(--agent-coral-deep, #E2452A)" : MUTED,
              background: active ? "#fff" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
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
          <span style={{ borderRadius: 999, border: "0.5px solid rgba(255,107,74,0.4)", background: "rgba(255,107,74,0.10)", padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "var(--agent-coral-deep, #E2452A)" }}>
            Your version
          </span>
        ) : (
          <span style={{ borderRadius: 999, border: HAIRLINE, background: "#f7f7f8", padding: "3px 10px", fontSize: 11, fontWeight: 600, color: MUTED }}>
            Sales Progressor default
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {resolved.source === "agency" && (
            <button
              type="button"
              onClick={onReset}
              disabled={resetting}
              className="account-emails-ghostbtn"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, border: HAIRLINE, background: "#fff", padding: "7px 12px", fontSize: 13, fontWeight: 600, color: TEXT, cursor: resetting ? "default" : "pointer", opacity: resetting ? 0.55 : 1 }}
            >
              <ArrowCounterClockwise size={14} />
              {resetting ? "Resetting…" : "Reset to Sales Progressor"}
            </button>
          )}
          <button type="button" onClick={onEdit} className="agent-btn agent-btn-primary agent-btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Pencil size={14} />
            Edit
          </button>
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
              <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: "#374151" }}>{fill(b)}</li>
            ))}
          </ul>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview fills the blanks (address, your team) with example details. The completion date is added
        automatically when it&apos;s known.
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
      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Subject</span>
        <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} style={inputStyle} />
      </label>

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
              <button
                type="button"
                onClick={() => removeBullet(i)}
                aria-label={`Remove point ${i + 1}`}
                className="account-emails-danger"
                style={{ flexShrink: 0, marginTop: 4, padding: 6, borderRadius: 7, border: HAIRLINE, background: "#fff", color: MUTED, cursor: "pointer", display: "flex" }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addBullet}
          className="account-emails-ghostbtn"
          style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, border: HAIRLINE, background: "#fff", padding: "7px 12px", fontSize: 13, fontWeight: 600, color: TEXT, cursor: "pointer" }}
        >
          <Plus size={14} /> Add a point
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
        Blanks like {"{address}"} and {"{teamRef}"} are filled in for each sale when the email sends. Leave them in place.
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
