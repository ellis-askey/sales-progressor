"use client";

// components/account/emails/ClientChaseEditor.tsx
//
// Tier-2 editor for the client chase digest. Its body is assembled dynamically
// (whichever milestones are outstanding, in one of three tones), so unlike the
// other families it isn't a rewritable block. A director can set a custom
// subject (blank = our default), plus an optional opening and closing line that
// bracket the dynamic body. All optional; blank everywhere = our default.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch, Warning } from "@phosphor-icons/react";

type Content = { subject: string; intro: string; outro: string };
type Resolved = { source: "agency" | "default"; effective: Content; base: Content };

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";

const EX: Record<string, string> = { address: "12 Example Road", firstName: "Sam", transactionWord: "purchase" };
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

export function ClientChaseEditor() {
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
      const res = await fetch("/api/agent/email-templates/resolve?templateKey=client_chase&variant=default");
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
        body: JSON.stringify({ templateKey: "client_chase", variant: "default", content: draft }),
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
        body: JSON.stringify({ templateKey: "client_chase", variant: "default" }),
      });
      await load();
    } finally {
      setResetting(false);
    }
  }

  const warnings = draft ? [...warnOf("Opening line", draft.intro), ...warnOf("Closing line", draft.outro)] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>Chase reminder</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
          A gentle reminder to your client when something on their sale is waiting on them or their solicitor. The list
          of what&apos;s outstanding is filled in for each sale, so here you set the subject and an optional line at the
          top and bottom.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: MUTED, padding: "8px 2px" }}>
          <CircleNotch size={16} className="agent-spin" /> Loading…
        </div>
      ) : !resolved ? null : editing && draft ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Subject</span>
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} style={inputStyle} placeholder="Quick update on {address}" />
            <span style={{ display: "block", marginTop: 5, fontSize: 11.5, color: FAINT }}>Leave blank to use our default subject.</span>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Opening line (optional)</span>
            <textarea value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="A line of your own, shown just under the greeting." />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Closing line (optional)</span>
            <textarea value={draft.outro} onChange={(e) => setDraft({ ...draft, outro: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="A sign-off line of your own, shown under the reminder." />
          </label>
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
            {c.subject ? fill(c.subject) : "Our default (rotates, e.g. “Quick update on 12 Example Road”)"}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: TEXT }}>Hi Sam,</p>
          {c.intro && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{fill(c.intro)}</p>}
          <div style={{ borderRadius: 9, border: "1px dashed rgba(0,0,0,0.14)", background: "#fbfbfc", padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: FAINT, fontStyle: "italic", lineHeight: 1.5 }}>
              Whatever&apos;s outstanding on the sale appears here, adapting to what&apos;s due and who it&apos;s with, followed by the &ldquo;Open the page&rdquo; button.
            </p>
          </div>
          {c.outro && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{fill(c.outro)}</p>}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#374151" }}>Thanks,<br /><span style={{ color: MUTED }}>Your agency</span></p>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        The middle changes per sale to list exactly what&apos;s outstanding. Only the subject and your optional lines are set here.
      </p>
    </div>
  );
}
