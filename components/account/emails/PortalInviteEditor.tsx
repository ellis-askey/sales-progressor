"use client";

// components/account/emails/PortalInviteEditor.tsx
//
// Tier-2 editor for the portal invite / welcome email — the first email a client
// gets when they're invited to their portal. Full prose control over the subject,
// headline, body line, the "personal to you" note and the button label; their
// version, or ours. {saleWord} and {address} are filled in per send. Mirrors the
// ClientChaseEditor shape (single variant, base prop for agency vs business).

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch } from "@/components/icons/ph";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";

type Content = { subject: string; headline: string; body: string; note: string; cta: string };
type Resolved = { exists: true; source: "agency" | "default"; effective: Content; base: Content };

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "var(--agent-text-primary)";
const MUTED = "var(--agent-text-muted)";
const FAINT = "var(--agent-text-tertiary)";
const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

const EX: Record<string, string> = { saleWord: "purchase", address: "12 Example Road, Harlow, CM17 9PH" };
const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => EX[k] ?? `{${k}}`);

const emDash = String.fromCharCode(0x2014);
function warnOf(label: string, val: string): string[] {
  const w: string[] = [];
  if (!val) return w;
  if (val.includes(emDash)) w.push(`${label}: try a comma or full stop instead of a long dash.`);
  if (val.includes("!")) w.push(`${label}: client emails tend to read better without exclamation marks.`);
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

export function PortalInviteEditor({ base = "/api/agent/email-templates" }: { base?: string } = {}) {
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
      const res = await fetch(`${base}/resolve?templateKey=portal_invite&variant=default`);
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, [base]);

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
        body: JSON.stringify({ templateKey: "portal_invite", variant: "default", content: draft }),
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
        body: JSON.stringify({ templateKey: "portal_invite", variant: "default" }),
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

  const warnings = draft
    ? [...warnOf("Headline", draft.headline), ...warnOf("Body", draft.body), ...warnOf("Note", draft.note), ...warnOf("Button", draft.cta)]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>Portal invite</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
          The first email a client receives, inviting them into their portal. We&apos;ll add the greeting, their link and
          your branding.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: MUTED, padding: "8px 2px" }}>
          <CircleNotch size={16} className="agent-spin" /> Loading…
        </div>
      ) : !resolved ? null : editing && draft ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
          <LabelInput field="Subject" label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} fullWidth accent="#FF6B4A" />
          <LabelInput field="Headline" label="Headline" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} fullWidth accent="#FF6B4A" />
          <Field label="Body">
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </Field>
          <Field label="Note (optional)" hint="The small reassurance under the button. Leave blank to hide it.">
            <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </Field>
          <LabelInput field="Button label" label="Button label" value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} fullWidth accent="#FF6B4A" />
          <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
            Details like {"{saleWord}"} and {"{address}"} are filled in for each sale when the email sends. Leave them in place.
          </p>
          {warnings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {warnings.map((w, i) => (
                <InlineAlert key={i} kind="warning">{w}</InlineAlert>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button variant="primary" onClick={save} disabled={saving} style={coralVars}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Preview resolved={resolved} onEdit={startEdit} onReset={reset} resetting={resetting} />
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", marginTop: 5, fontSize: 11.5, color: FAINT }}>{hint}</span>}
    </label>
  );
}

function Preview({ resolved, onEdit, onReset, resetting }: { resolved: Resolved; onEdit: () => void; onReset: () => void; resetting: boolean }) {
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
              <ArrowCounterClockwise size={14} /> {resetting ? "Resetting…" : "Reset to Sales Progressor"}
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
          <p style={{ margin: "3px 0 0", fontSize: 14, color: TEXT }}>{fill(c.subject)}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>{fill(c.headline)}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>Hi Sam,</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>{fill(c.body)}</p>
          <span style={{ display: "inline-block", width: "fit-content", borderRadius: 8, background: "var(--agent-coral, #FF6B4A)", padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff" }}>{fill(c.cta)}</span>
          {c.note && (
            <div style={{ borderRadius: 9, background: "#F8F9FB", padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 12.5, color: FAINT, lineHeight: 1.5 }}>{fill(c.note)}</p>
            </div>
          )}
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Your agency</p>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview uses example details for the sale and address. We&apos;ll add your logo, colours and the client&apos;s link.
      </p>
    </div>
  );
}
