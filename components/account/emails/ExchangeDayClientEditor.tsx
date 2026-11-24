"use client";

// components/account/emails/ExchangeDayClientEditor.tsx
//
// Tier-2 editor for the two exchange-day client emails: the 9am morning note
// (informational + authority ask) and the 11am authority nudge (with the "I've
// given authority" button). A director edits the subject and each paragraph;
// the greeting sits in the first paragraph, the sign-off and button are ours.
// Full prose control — their version, or ours.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, CircleNotch, Plus, X } from "@/components/icons/ph";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";

type Variant = "morning" | "authority";
type MorningContent = { subject: string; paragraphs: string[] };
type AuthorityContent = { subject: string; intro: string[]; closing: string };
type Resolved = { source: "agency" | "default"; effective: MorningContent | AuthorityContent; base: MorningContent | AuthorityContent };

const VARIANTS: { id: Variant; label: string }[] = [
  { id: "morning", label: "Morning note" },
  { id: "authority", label: "Authority nudge" },
];

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "var(--agent-text-primary)";
const MUTED = "var(--agent-text-muted)";
const FAINT = "var(--agent-text-tertiary)";
const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

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
  if (val.includes(emDash)) w.push(`${label}: try a comma or full stop instead of a long dash.`);
  if (val.includes("!")) w.push(`${label}: client emails tend to read better without exclamation marks.`);
  return w;
}

export function ExchangeDayClientEditor({ base = "/api/agent/email-templates" }: { base?: string } = {}) {
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
      const res = await fetch(`${base}/resolve?templateKey=exchange_day_client&variant=${variant}`);
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
      const res = await fetch(`${base}/save`, {
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
      const res = await fetch(`${base}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: "exchange_day_client", variant }),
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
        <SegmentedSwitch options={VARIANTS} value={variant} onChange={setVariant} ariaLabel="Morning note or authority nudge" size="sm" />
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

function Preview({ variant, resolved, onEdit, onReset, resetting }: { variant: Variant; resolved: Resolved; onEdit: () => void; onReset: () => void; resetting: boolean }) {
  const e = resolved.effective;
  const paras = variant === "authority" ? (e as AuthorityContent).intro : (e as MorningContent).paragraphs;
  const closing = variant === "authority" ? (e as AuthorityContent).closing : null;
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
          {closing && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>{fill(closing)}</p>}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>Kind regards,<br /><strong>Your name</strong><br /><span style={{ color: MUTED }}>Your agency</span></p>
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview uses example details for things like the name, address and completion date. We&apos;ll add the button and sign-off for you.
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
      <LabelInput field="Subject" label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} fullWidth accent="#FF6B4A" />

      <div>
        <span style={{ display: "block", marginBottom: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
          {isAuthority ? "Paragraphs (before the button)" : "Paragraphs"}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <textarea value={p} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              <div style={{ flexShrink: 0, marginTop: 4 }}>
                <Button type="button" variant="danger" size="sm" icon onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={`Remove paragraph ${i + 1}`}>
                  <X size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Button type="button" variant="secondary" size="sm" onClick={() => setList([...list, ""])}>
            <Plus size={14} /> Add a paragraph
          </Button>
        </div>
      </div>

      {isAuthority && (
        <label style={{ display: "block" }}>
          <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>Closing (after the button)</span>
          <textarea value={(draft as AuthorityContent).closing} onChange={(e) => setDraft({ ...(draft as AuthorityContent), closing: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </label>
      )}

      <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
        Details like {"{firstName}"}, {"{address}"} and {"{completionDate}"} are filled in for each sale when the email sends. Leave them in place.
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
