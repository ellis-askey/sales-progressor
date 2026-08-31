"use client";

// components/account/emails/WeeklyUpdateEditor.tsx
//
// Tier-2 editor for the weekly client update. Its body is a per-file AI draft
// written from the sale's real state, so it isn't a rewritable block. A director
// can set a custom subject (blank = our default), an optional opening line, a
// tone steer that guides the AI draft (our voice rules always win), and a custom
// closing line. All optional; blank everywhere = our default behaviour.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch, Warning, Sparkle } from "@phosphor-icons/react";

type Content = { subject: string; intro: string; toneGuidance: string; closing: string };
type Resolved = { source: "agency" | "default"; effective: Content; base: Content };

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";

const EX: Record<string, string> = { address: "12 Example Road", firstName: "Sam", roleLabel: "purchase" };
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => EX[k] ?? `{${k}}`);

const emDash = String.fromCharCode(0x2014);
function warnOf(label: string, val: string): string[] {
  const w: string[] = [];
  if (!val) return w;
  if (val.includes(emDash)) w.push(`${label}: swap the long dash for a comma or full stop.`);
  if (val.includes("!")) w.push(`${label}: client emails read calmer without exclamation marks.`);
  return w;
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

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", marginTop: 5, fontSize: 11.5, color: FAINT }}>{hint}</span>}
    </label>
  );
}

export function WeeklyUpdateEditor() {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Content | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setEditing(false);
    try {
      const res = await fetch("/api/agent/email-templates/resolve?templateKey=weekly_update&variant=default");
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

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
        body: JSON.stringify({ templateKey: "weekly_update", variant: "default", content: draft }),
      });
      if (res.ok) {
        setEditing(false);
        await load();
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
        body: JSON.stringify({ templateKey: "weekly_update", variant: "default" }),
      });
      await load();
    } finally {
      setResetting(false);
    }
  }

  const warnings = draft ? [...warnOf("Opening line", draft.intro), ...warnOf("Closing line", draft.closing)] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>Weekly update</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
          A short weekly note to clients on quiet sales. We draft the middle for each sale from its real progress, so
          here you set the subject, an optional opening and closing line, and the tone we write it in.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: MUTED, padding: "8px 2px" }}>
          <CircleNotch size={16} className="agent-spin" /> Loading…
        </div>
      ) : !resolved ? null : editing && draft ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
          <Labelled label="Subject" hint="Leave blank to use our default subject.">
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} style={inputStyle} placeholder="An update on your {roleLabel} at {address}" />
          </Labelled>
          <Labelled label="Opening line (optional)">
            <textarea value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="A line of your own, shown just under the greeting." />
          </Labelled>
          <Labelled label="Tone of the written update" hint="Guides how we word the middle for each sale. Our voice and privacy rules always apply. Example: “warm and concise, reassuring, first-person as the agency.”">
            <div style={{ position: "relative" }}>
              <Sparkle size={15} weight="fill" style={{ position: "absolute", left: 11, top: 11, color: "var(--agent-coral, #FF6B4A)" }} />
              <textarea value={draft.toneGuidance} onChange={(e) => setDraft({ ...draft, toneGuidance: e.target.value })} rows={2} style={{ ...inputStyle, paddingLeft: 32, resize: "vertical", lineHeight: 1.5 }} placeholder="How should these read? e.g. warm and brief, gently reassuring." />
            </div>
          </Labelled>
          <Labelled label="Closing line (optional)" hint="Leave blank to use our default closing.">
            <textarea value={draft.closing} onChange={(e) => setDraft({ ...draft, closing: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="If anything needs your attention we'll be in touch right away." />
          </Labelled>
          <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
            Blanks like {"{firstName}"} and {"{address}"} are filled in for each sale when the email sends.
          </p>
          {warnings.length > 0 && (
            <div style={{ borderRadius: 10, border: "0.5px solid rgba(217,119,6,0.35)", background: "rgba(251,191,36,0.10)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              {warnings.map((w, i) => (
                <p key={i} style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "#92610a" }}>
                  <Warning size={14} weight="fill" style={{ marginTop: 1, flexShrink: 0, color: "#d97706" }} /> {w}
                </p>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={save} disabled={saving} className="agent-btn agent-btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="account-emails-ghostbtn" style={{ borderRadius: 9, border: HAIRLINE, background: "#fff", padding: "9px 16px", fontSize: 13.5, fontWeight: 600, color: TEXT, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <Preview resolved={resolved} onEdit={startEdit} onReset={reset} resetting={resetting} />
      )}
    </div>
  );
}

function Preview({ resolved, onEdit, onReset, resetting }: { resolved: Resolved; onEdit: () => void; onReset: () => void; resetting: boolean }) {
  const c = resolved.effective;
  const defaultClosing = "If anything needs your attention we'll be in touch right away. Otherwise, just reply to this email if you have questions.";
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
              <ArrowCounterClockwise size={14} /> {resetting ? "Resetting…" : "Reset to Sales Progressor"}
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
          <p style={{ margin: "3px 0 0", fontSize: 14, color: c.subject ? TEXT : MUTED, fontStyle: c.subject ? "normal" : "italic" }}>
            {c.subject ? fill(c.subject) : "An update on your purchase at 12 Example Road (our default)"}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: TEXT }}>Hi Sam,</p>
          {c.intro && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{fill(c.intro)}</p>}
          <div style={{ borderRadius: 9, border: "1px dashed rgba(0,0,0,0.14)", background: "#fbfbfc", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <Sparkle size={15} weight="fill" style={{ marginTop: 1, flexShrink: 0, color: "var(--agent-coral, #FF6B4A)" }} />
            <p style={{ margin: 0, fontSize: 12.5, color: FAINT, fontStyle: "italic", lineHeight: 1.5 }}>
              We write a short, warm update here for each sale from its real progress{c.toneGuidance ? `, in the tone you set above` : ""}.
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{c.closing ? fill(c.closing) : defaultClosing}</p>
          <span style={{ display: "inline-block", width: "fit-content", borderRadius: 8, background: "var(--agent-coral, #FF6B4A)", padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff" }}>View your progress →</span>
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Your agency</p>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        The middle is written per sale from its real progress. Only the subject, your optional lines and the tone are set here.
      </p>
    </div>
  );
}
