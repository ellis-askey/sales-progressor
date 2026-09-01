"use client";

// components/account/emails/ExchangeDayClientEditor.tsx
//
// Tier-2 editor for the two exchange-day client emails: the 9am morning note
// (informational + authority ask) and the 11am authority nudge (with the "I've
// given authority" button). A director edits the subject and each paragraph;
// the greeting sits in the first paragraph, the sign-off and button are ours.
// Full prose control — their version, or ours.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch, Plus, X, Warning } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Variant = "morning" | "authority";
type MorningContent = { subject: string; paragraphs: string[] };
type AuthorityContent = { subject: string; intro: string[]; closing: string };
type Resolved = { source: "agency" | "default"; effective: MorningContent | AuthorityContent; base: MorningContent | AuthorityContent };

const VARIANTS: { value: Variant; label: string }[] = [
  { value: "morning", label: "Morning note" },
  { value: "authority", label: "Authority nudge" },
];

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";

const EX: Record<string, string> = {
  firstName: "Sam",
  address: "12 Example Road, Harlow, CM17 9PH",
  addressShort: "12 Example Road",
  completionDate: "Thursday, 4 September 2026",
  saleWord: "purchase",
};
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => EX[k] ?? `{${k}}`);

const emDash = String.fromCharCode(0x2014);
function warnOf(label: string, val: string): string[] {
  const w: string[] = [];
  if (val.includes(emDash)) w.push(`${label}: swap the long dash for a comma or full stop.`);
  if (val.includes("!")) w.push(`${label}: client emails read calmer without exclamation marks.`);
  return w;
}

export function ExchangeDayClientEditor() {
  const [variant, setVariant] = useState<Variant>("morning");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MorningContent | AuthorityContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useAgentToast();

  const load = useCallback(async () => {
    setLoading(true);
    setEditing(false);
    try {
      const res = await fetch(`/api/agent/email-templates/resolve?templateKey=exchange_day_client&variant=${variant}`);
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
    const e = resolved.effective;
    setDraft(variant === "authority"
      ? { subject: (e as AuthorityContent).subject, intro: [...(e as AuthorityContent).intro], closing: (e as AuthorityContent).closing }
      : { subject: (e as MorningContent).subject, paragraphs: [...(e as MorningContent).paragraphs] });
    setEditing(true);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agent/email-templates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: "exchange_day_client", variant, content: draft }),
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
        body: JSON.stringify({ templateKey: "exchange_day_client", variant }),
      });
      await load();
    } finally {
      setResetting(false);
    }
  }

  const warnings: string[] = [];
  if (draft) {
    if (variant === "authority") {
      const d = draft as AuthorityContent;
      d.intro.forEach((p, i) => warnings.push(...warnOf(`Paragraph ${i + 1}`, p)));
      warnings.push(...warnOf("Closing", d.closing));
    } else {
      (draft as MorningContent).paragraphs.forEach((p, i) => warnings.push(...warnOf(`Paragraph ${i + 1}`, p)));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>Exchange day</p>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
            {variant === "morning"
              ? "Sent to your client on the morning of exchange, letting them know it's happening and to give their solicitor authority."
              : "A short late-morning nudge with a button, sent only to clients who haven't yet confirmed they've given authority."}
          </p>
        </div>
        <Segmented value={variant} onChange={(v) => setVariant(v as Variant)} options={VARIANTS} />
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: MUTED, padding: "8px 2px" }}>
          <CircleNotch size={16} className="agent-spin" /> Loading…
        </div>
      ) : !resolved ? null : editing && draft ? (
        <Editor variant={variant} draft={draft} setDraft={setDraft} warnings={warnings} saving={saving} onSave={save} onCancel={() => setEditing(false)} />
      ) : (
        <Preview variant={variant} resolved={resolved} onEdit={startEdit} onReset={reset} resetting={resetting} />
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

function Preview({ variant, resolved, onEdit, onReset, resetting }: { variant: Variant; resolved: Resolved; onEdit: () => void; onReset: () => void; resetting: boolean }) {
  const e = resolved.effective;
  const paras = variant === "authority" ? (e as AuthorityContent).intro : (e as MorningContent).paragraphs;
  const closing = variant === "authority" ? (e as AuthorityContent).closing : null;
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
          <p style={{ margin: "3px 0 0", fontSize: 14, color: TEXT }}>{fill(e.subject)}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          {paras.map((p, i) => (
            <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: i === 0 ? TEXT : "#374151" }}>{fill(p)}</p>
          ))}
          {variant === "authority" && (
            <span style={{ display: "inline-block", width: "fit-content", borderRadius: 8, background: "var(--agent-coral, #FF6B4A)", padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
              I&apos;ve given authority
            </span>
          )}
          {closing && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{fill(closing)}</p>}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#374151" }}>Kind regards,<br /><strong>Your name</strong><br /><span style={{ color: MUTED }}>Your agency</span></p>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview fills the blanks (name, address, completion date) with example details. The button and sign-off are added automatically.
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

function Editor({ variant, draft, setDraft, warnings, saving, onSave, onCancel }: {
  variant: Variant;
  draft: MorningContent | AuthorityContent;
  setDraft: (c: MorningContent | AuthorityContent) => void;
  warnings: string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isAuthority = variant === "authority";
  const list = isAuthority ? (draft as AuthorityContent).intro : (draft as MorningContent).paragraphs;
  const setList = (next: string[]) =>
    setDraft(isAuthority ? { ...(draft as AuthorityContent), intro: next } : { ...(draft as MorningContent), paragraphs: next });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Subject</span>
        <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} style={inputStyle} />
      </label>

      <div>
        <span style={{ display: "block", marginBottom: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
          {isAuthority ? "Paragraphs (before the button)" : "Paragraphs"}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <textarea value={p} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={`Remove paragraph ${i + 1}`} className="account-emails-danger" style={{ flexShrink: 0, marginTop: 4, padding: 6, borderRadius: 7, border: HAIRLINE, background: "#fff", color: MUTED, cursor: "pointer", display: "flex" }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setList([...list, ""])} className="account-emails-ghostbtn" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9, border: HAIRLINE, background: "#fff", padding: "7px 12px", fontSize: 13, fontWeight: 600, color: TEXT, cursor: "pointer" }}>
          <Plus size={14} /> Add a paragraph
        </button>
      </div>

      {isAuthority && (
        <label style={{ display: "block" }}>
          <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Closing (after the button)</span>
          <textarea value={(draft as AuthorityContent).closing} onChange={(e) => setDraft({ ...(draft as AuthorityContent), closing: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </label>
      )}

      <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
        Blanks like {"{firstName}"}, {"{address}"} and {"{completionDate}"} are filled in for each sale when the email sends. Leave them in place.
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
