"use client";

// components/account/emails/AgencyMilestoneEmailsEditor.tsx
//
// Agency-facing milestone-email editor for the Account area. A director picks a
// step + scenario (buyer/seller, tenure, method) and sees exactly what their
// client would receive. Editing saves the AGENCY's own version, layered over
// the Sales Progressor default; resetting removes it and reverts to ours.
//
// This is the warm, light Account-register twin of the Command Centre matrix
// (components/command/milestone-emails/MilestoneEmailsMatrix.tsx). Same data
// contract, different surface — the agent app must not import command UI.
// Sides are limited to buyer + seller: client-facing copy only.

import { useCallback, useEffect, useState } from "react";
import { Pencil, ArrowCounterClockwise, Warning, CircleNotch } from "@phosphor-icons/react";

type StepMeta = {
  code: string;
  label: string;
  sides: string[];
  mortgageOnly: boolean;
  leaseholdOnly: boolean;
};
type Copy = {
  subject: string;
  heroLabel: string;
  opening: string;
  whatHappened: string;
  whatNext: string | null;
  action: string | null;
};
type Resolved =
  | {
      exists: true;
      source: "agency" | "sp_default" | "default";
      matchedTenure: string | null;
      matchedMethod: string | null;
      raw: Copy;
      base: Copy;
      preview: Copy;
    }
  | { exists: false };

type Side = "vendor" | "purchaser";

const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: "purchaser", label: "Buyer" },
  { value: "vendor", label: "Seller" },
];

const HAIRLINE = "0.5px solid rgba(0,0,0,0.10)";
const TEXT = "#111827";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";

const scopeLabel = (t: string | null, m: string | null) => {
  const parts: string[] = [];
  parts.push(t && t !== "any" ? t : "all tenures");
  parts.push(m && m !== "any" ? (m === "mortgage" ? "mortgage" : "cash") : "all methods");
  return parts.join(" · ");
};

function voiceWarnings(draft: Copy): string[] {
  const w: string[] = [];
  const prose: [string, string | null][] = [
    ["Opening", draft.opening],
    ["What happened", draft.whatHappened],
    ["What next", draft.whatNext],
  ];
  const emDash = String.fromCharCode(0x2014);
  for (const [label, val] of prose) {
    if (!val) continue;
    if (val.includes(emDash)) w.push(`${label}: swap the long dash for a comma or full stop.`);
    if (val.includes("!")) w.push(`${label}: client emails read calmer without exclamation marks.`);
  }
  return w;
}

export function AgencyMilestoneEmailsEditor({ steps }: { steps: StepMeta[] }) {
  const [side, setSide] = useState<Side>("purchaser");
  const [tenure, setTenure] = useState<"freehold" | "leasehold">("freehold");
  const [method, setMethod] = useState<"mortgage" | "cash">("mortgage");

  const stepsForSide = steps.filter((s) => s.sides.includes(side));
  const [code, setCode] = useState<string>(stepsForSide[0]?.code ?? "");

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Copy | null>(null);
  const [tenureScope, setTenureScope] = useState<"this" | "any">("this");
  const [methodScope, setMethodScope] = useState<"this" | "any">("this");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const step = steps.find((s) => s.code === code);

  useEffect(() => {
    if (!stepsForSide.some((s) => s.code === code)) {
      setCode(stepsForSide[0]?.code ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  const load = useCallback(async () => {
    if (!code) {
      setResolved(null);
      return;
    }
    setLoading(true);
    setEditing(false);
    try {
      const res = await fetch(
        `/api/agent/milestone-emails/resolve?code=${encodeURIComponent(code)}&side=${side}&tenure=${tenure}&method=${method}`
      );
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, [code, side, tenure, method]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!resolved || !resolved.exists) return;
    setDraft({ ...resolved.raw });
    setTenureScope("this");
    setMethodScope("this");
    setEditing(true);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agent/milestone-emails/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          side,
          tenure: tenureScope === "this" ? tenure : "any",
          purchaseType: methodScope === "this" ? method : "any",
          ...draft,
        }),
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
    if (!resolved || !resolved.exists || resolved.source !== "agency") return;
    setResetting(true);
    try {
      await fetch("/api/agent/milestone-emails/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          side,
          tenure: resolved.matchedTenure ?? "any",
          purchaseType: resolved.matchedMethod ?? "any",
        }),
      });
      await load();
    } finally {
      setResetting(false);
    }
  }

  const scenarioWarning =
    step && step.mortgageOnly && method === "cash"
      ? "This step only happens for a buyer with a mortgage, so a cash buyer never receives it."
      : step && step.leaseholdOnly && tenure === "freehold"
        ? "This step only happens on a leasehold sale, so it never sends on a freehold file."
        : null;

  const warnings = draft ? voiceWarnings(draft) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Selectors */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "16px 28px",
          border: HAIRLINE,
          borderRadius: 14,
          background: "#fff",
          padding: 18,
        }}
      >
        <Field label="Recipient">
          <Segmented value={side} onChange={(v) => setSide(v as Side)} options={SIDE_OPTIONS} />
        </Field>
        <Field label="Tenure">
          <Segmented
            value={tenure}
            onChange={(v) => setTenure(v as "freehold" | "leasehold")}
            options={[
              { value: "freehold", label: "Freehold" },
              { value: "leasehold", label: "Leasehold" },
            ]}
          />
        </Field>
        <Field label="Payment">
          <Segmented
            value={method}
            onChange={(v) => setMethod(v as "mortgage" | "cash")}
            options={[
              { value: "mortgage", label: "Mortgage" },
              { value: "cash", label: "Cash" },
            ]}
          />
        </Field>
        <Field label="Step">
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              minWidth: 300,
              border: "1px solid rgba(0,0,0,0.14)",
              borderRadius: 9,
              background: "#fff",
              padding: "8px 10px",
              fontSize: 13.5,
              color: TEXT,
            }}
          >
            {stepsForSide.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
                {s.mortgageOnly ? " (mortgage only)" : ""}
                {s.leaseholdOnly ? " (leasehold only)" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {scenarioWarning && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            border: "0.5px solid rgba(217,119,6,0.35)",
            background: "rgba(251,191,36,0.10)",
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 13,
            color: "#92610a",
          }}
        >
          <Warning size={16} weight="fill" style={{ marginTop: 1, flexShrink: 0, color: "#d97706" }} />
          {scenarioWarning}
        </div>
      )}

      {/* Preview / editor */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: MUTED, padding: "8px 2px" }}>
          <CircleNotch size={16} className="agent-spin" /> Loading…
        </div>
      ) : !resolved ? null : !resolved.exists ? (
        <div
          style={{
            border: HAIRLINE,
            borderRadius: 14,
            background: "#fff",
            padding: 20,
            fontSize: 13.5,
            color: MUTED,
          }}
        >
          This step doesn&apos;t send an email to the {SIDE_OPTIONS.find((o) => o.value === side)?.label.toLowerCase()}.
        </div>
      ) : editing && draft ? (
        <Editor
          draft={draft}
          setDraft={setDraft}
          tenure={tenure}
          method={method}
          tenureScope={tenureScope}
          methodScope={methodScope}
          setTenureScope={setTenureScope}
          setMethodScope={setMethodScope}
          warnings={warnings}
          saving={saving}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Preview resolved={resolved} onEdit={startEdit} onReset={reset} resetting={resetting} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: FAINT }}>
        {label}
      </span>
      {children}
    </label>
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
    <div
      style={{
        display: "inline-flex",
        width: "fit-content",
        border: HAIRLINE,
        borderRadius: 9,
        background: "#f7f7f8",
        padding: 3,
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              borderRadius: 6,
              border: "none",
              padding: "6px 13px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 120ms, color 120ms, box-shadow 120ms",
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

function SourceBadge({ resolved }: { resolved: Extract<Resolved, { exists: true }> }) {
  if (resolved.source === "agency") {
    return (
      <span
        style={{
          borderRadius: 999,
          border: "0.5px solid rgba(255,107,74,0.4)",
          background: "rgba(255,107,74,0.10)",
          padding: "3px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--agent-coral-deep, #E2452A)",
        }}
      >
        Your version · {scopeLabel(resolved.matchedTenure, resolved.matchedMethod)}
      </span>
    );
  }
  return (
    <span
      style={{
        borderRadius: 999,
        border: HAIRLINE,
        background: "#f7f7f8",
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 600,
        color: MUTED,
      }}
    >
      Sales Progressor default
    </span>
  );
}

function Preview({
  resolved,
  onEdit,
  onReset,
  resetting,
}: {
  resolved: Extract<Resolved, { exists: true }>;
  onEdit: () => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const p = resolved.preview;
  return (
    <div style={{ border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <SourceBadge resolved={resolved} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {resolved.source === "agency" && (
            <button
              type="button"
              onClick={onReset}
              disabled={resetting}
              className="account-emails-ghostbtn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 9,
                border: HAIRLINE,
                background: "#fff",
                padding: "7px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: TEXT,
                cursor: resetting ? "default" : "pointer",
                opacity: resetting ? 0.55 : 1,
              }}
            >
              <ArrowCounterClockwise size={14} />
              {resetting ? "Resetting…" : "Reset to Sales Progressor"}
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="agent-btn agent-btn-primary agent-btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>
      </div>

      {/* Email preview */}
      <div style={{ overflow: "hidden", borderRadius: 11, border: HAIRLINE, background: "#fcfcfd" }}>
        <div style={{ borderBottom: HAIRLINE, padding: "11px 16px" }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
            Subject
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 14, color: TEXT }}>{p.subject}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px" }}>
          <p style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
            {p.heroLabel}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>{p.opening}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: TEXT }}>{p.whatHappened}</p>
          {p.whatNext && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#374151" }}>{p.whatNext}</p>}
          {p.action && (
            <span
              style={{
                display: "inline-block",
                width: "fit-content",
                borderRadius: 8,
                background: "var(--agent-coral, #FF6B4A)",
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {p.action}
            </span>
          )}
        </div>
      </div>
      <p style={{ margin: "9px 2px 0", fontSize: 11.5, color: FAINT }}>
        Preview fills the blanks (address, dates, surveyor) with example details.
      </p>
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  tenure,
  method,
  tenureScope,
  methodScope,
  setTenureScope,
  setMethodScope,
  warnings,
  saving,
  onSave,
  onCancel,
}: {
  draft: Copy;
  setDraft: (c: Copy) => void;
  tenure: string;
  method: string;
  tenureScope: "this" | "any";
  methodScope: "this" | "any";
  setTenureScope: (v: "this" | "any") => void;
  setMethodScope: (v: "this" | "any") => void;
  warnings: string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (k: keyof Copy, v: string) => setDraft({ ...draft, [k]: v });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, border: HAIRLINE, borderRadius: 14, background: "#fff", padding: 20 }}>
      <EditorField label="Subject" value={draft.subject} onChange={(v) => set("subject", v)} />
      <EditorField label="Hero label" value={draft.heroLabel} onChange={(v) => set("heroLabel", v)} />
      <EditorField label="Opening" value={draft.opening} onChange={(v) => set("opening", v)} rows={2} />
      <EditorField label="What happened" value={draft.whatHappened} onChange={(v) => set("whatHappened", v)} rows={4} />
      <EditorField
        label="What next"
        value={draft.whatNext ?? ""}
        onChange={(v) => set("whatNext", v)}
        rows={3}
        hint="Leave blank for no follow-up paragraph."
      />
      <EditorField
        label="Button label"
        value={draft.action ?? ""}
        onChange={(v) => set("action", v)}
        hint="Leave blank for the default button."
      />

      <p style={{ margin: 0, fontSize: 11.5, color: FAINT }}>
        Blanks like {"{address}"} are filled in for each sale when the email sends. Leave them in place.
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

      {/* Scope */}
      <div style={{ borderRadius: 10, border: HAIRLINE, background: "#fafafa", padding: 14 }}>
        <p style={{ margin: "0 0 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
          This change applies to
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Segmented
            value={tenureScope}
            onChange={(v) => setTenureScope(v as "this" | "any")}
            options={[
              { value: "this", label: `${tenure} only` },
              { value: "any", label: "All tenures" },
            ]}
          />
          <Segmented
            value={methodScope}
            onChange={(v) => setMethodScope(v as "this" | "any")}
            options={[
              { value: "this", label: `${method === "mortgage" ? "Mortgage" : "Cash"} only` },
              { value: "any", label: "All payment types" },
            ]}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="agent-btn agent-btn-primary"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="account-emails-ghostbtn"
          style={{ borderRadius: 9, border: HAIRLINE, background: "#fff", padding: "9px 16px", fontSize: 13.5, fontWeight: 600, color: TEXT, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>

      <style>{`
        .account-emails-ghostbtn:hover { background: rgba(0,0,0,0.035) !important; }
        .agent-spin { animation: account-emails-spin 0.7s linear infinite; }
        @keyframes account-emails-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function EditorField({
  label,
  value,
  onChange,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  const shared: React.CSSProperties = {
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
    <label style={{ display: "block" }}>
      <span style={{ display: "block", marginBottom: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
        {label}
      </span>
      {rows ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} style={{ ...shared, resize: "vertical", lineHeight: 1.5 }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={shared} />
      )}
      {hint && <span style={{ display: "block", marginTop: 5, fontSize: 11.5, color: FAINT }}>{hint}</span>}
    </label>
  );
}
