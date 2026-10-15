"use client";

// components/account/emails/AgencyMilestoneEmailsEditor.tsx
//
// Agency-facing milestone-email editor for the Account area. A director picks a
// step + scenario (buyer/seller, tenure, method) and sees exactly what their
// client would receive. Editing saves the AGENCY's own version, layered over
// the Sales Progressor default; resetting removes it and reverts to ours.
//
// Redesign (founder, 2026-10-15): the scenario selectors live in a LEFT RAIL
// (recipient / tenure / payment / step, stacked); the email is the canvas on
// the right, rendered in the agency's real branding (the look set on the Style
// tab). "Edit" makes the email editable IN PLACE. The step list only shows the
// steps that apply to the chosen scenario (a leasehold step never appears on a
// freehold file; a mortgage step never on a cash buyer), so there are no
// "mortgage only" tags or "not sent" states to wade past. An agency edit always
// applies across every scenario (saved as "any"), so one edit covers the matrix.
//
// Same data contract as the Command Centre matrix. Sides are limited to buyer +
// seller: client-facing copy only.

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, ArrowCounterClockwise, Warning, CircleNotch, Check, X } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { EmailLookCard, type EmailLookContent } from "@/components/account/emails/EmailLook";
import type { StudioTheme } from "@/lib/email/email-theme-studio";

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
    if (val.includes(emDash)) w.push(`${label}: try a comma or full stop instead of a long dash.`);
    if (val.includes("!")) w.push(`${label}: client emails tend to read better without exclamation marks.`);
  }
  return w;
}

// A trimmed view of the resolved email theme, enough to render the preview in
// the agency's real branding (words in their colours + font).
export type PreviewTheme = {
  headerBg: string;
  headerText: string;
  accent: string;
  cardBg: string;
  bodyFont: string;
};

// The agency's full email look — resolved server-side and passed in so the
// preview renders through the SAME engine as the Style tab (byte-for-byte).
export type EmailLook = { st: StudioTheme; logoUrl: string | null; tileColor: string; identityName: string };

// Milestone copy -> the shared email-look content model. Editable wires each
// slot back to the matching Copy field for edit-in-place.
function milestoneContent(copy: Copy, editable: boolean, setField: (k: keyof Copy, v: string) => void): EmailLookContent {
  const slot = (key: keyof Copy, text: string, placeholder?: string) => ({ text, placeholder, onEdit: editable ? (v: string) => setField(key, v) : undefined });
  const body = [slot("opening", copy.opening), slot("whatHappened", copy.whatHappened)];
  if (editable || copy.whatNext) body.push(slot("whatNext", copy.whatNext ?? "", "Add a follow-up paragraph, or leave blank"));
  return {
    eyebrow: "Milestone update",
    headline: slot("heroLabel", copy.heroLabel, "Headline"),
    lead: null,
    greeting: null,
    body,
    cta: editable || copy.action ? slot("action", copy.action ?? "", "Button label") : { text: "View your portal" },
  };
}

// `base` points at the resolve/save/reset routes. Defaults to the agency routes;
// a progression business passes "/api/agent/settings/milestone-emails" so its own
// edits are saved as the business layer.
export function AgencyMilestoneEmailsEditor({ steps, base = "/api/agent/milestone-emails", previewTheme = null, look = null }: { steps: StepMeta[]; base?: string; previewTheme?: PreviewTheme | null; look?: EmailLook | null }) {
  const [side, setSide] = useState<Side>("purchaser");
  const [tenure, setTenure] = useState<"freehold" | "leasehold">("freehold");
  const [method, setMethod] = useState<"mortgage" | "cash">("mortgage");

  // Only the steps that apply to the chosen recipient + scenario.
  const visibleSteps = steps.filter(
    (s) =>
      s.sides.includes(side) &&
      !(s.mortgageOnly && method === "cash") &&
      !(s.leaseholdOnly && tenure === "freehold"),
  );
  const [code, setCode] = useState<string>(visibleSteps[0]?.code ?? "");

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Copy | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useAgentToast();
  const [resetting, setResetting] = useState(false);

  // Keep the selected step valid as the scenario (and therefore the list) changes.
  useEffect(() => {
    if (!visibleSteps.some((s) => s.code === code)) {
      setCode(visibleSteps[0]?.code ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, tenure, method]);

  const load = useCallback(async () => {
    if (!code) {
      setResolved(null);
      return;
    }
    setLoading(true);
    setEditing(false);
    setLoadError(false);
    try {
      const res = await fetch(
        `${base}/resolve?code=${encodeURIComponent(code)}&side=${side}&tenure=${tenure}&method=${method}`
      );
      if (res.ok) setResolved(await res.json());
      else setLoadError(true);
    } catch {
      setLoadError(true);
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
    setEditing(true);
  }

  const setField = useCallback((k: keyof Copy, v: string) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      // One edit covers the whole matrix: saved as "any" tenure + "any" method.
      const res = await fetch(`${base}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, side, tenure: "any", purchaseType: "any", ...draft }),
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
    if (!resolved || !resolved.exists || resolved.source !== "agency") return;
    setResetting(true);
    try {
      const res = await fetch(`${base}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          side,
          tenure: resolved.matchedTenure ?? "any",
          purchaseType: resolved.matchedMethod ?? "any",
        }),
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
  const shown = editing && draft ? draft : resolved && resolved.exists ? resolved.preview : null;
  const isAgencyVersion = !!resolved && resolved.exists && resolved.source === "agency";
  // Labels appearing more than once in the current list need a side tag to tell
  // the two emails apart.
  const labelCounts = new Map<string, number>();
  visibleSteps.forEach((s) => labelCounts.set(s.label, (labelCounts.get(s.label) ?? 0) + 1));

  return (
    <div className="eme2">
      <style>{EME2_STYLES}</style>

      {/* ── Left rail: which email ─────────────────────────────── */}
      <aside className="eme2-rail">
        <RailField label="Recipient">
          <Segmented value={side} disabled={editing} onChange={(v) => setSide(v as Side)} options={SIDE_OPTIONS} />
        </RailField>
        <RailField label="Tenure">
          <Segmented
            value={tenure}
            disabled={editing}
            onChange={(v) => setTenure(v as "freehold" | "leasehold")}
            options={[{ value: "freehold", label: "Freehold" }, { value: "leasehold", label: "Leasehold" }]}
          />
        </RailField>
        <RailField label="Payment">
          <Segmented
            value={method}
            disabled={editing}
            onChange={(v) => setMethod(v as "mortgage" | "cash")}
            options={[{ value: "mortgage", label: "Mortgage" }, { value: "cash", label: "Cash" }]}
          />
        </RailField>
        <RailField label="Step" grow>
          <div className="eme2-steps" role="listbox" aria-label="Choose a step">
            {visibleSteps.map((s, i) => {
              const on = s.code === code;
              // Some steps happen on both sides (the recipient is emailed when
              // they do it AND when the other party does), so the same label
              // appears twice. Tag those with whose side the email is about.
              const dup = (labelCounts.get(s.label) ?? 0) > 1;
              const ownSide = s.code.startsWith(side === "purchaser" ? "PM" : "VM");
              const sideTag = dup
                ? ownSide
                  ? "Current side"
                  : side === "purchaser" ? "The seller's side" : "The buyer's side"
                : null;
              return (
                <button
                  key={s.code}
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={editing}
                  className={`eme2-step${on ? " on" : ""}`}
                  onClick={() => { if (!editing) setCode(s.code); }}
                >
                  <span className="eme2-step-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="eme2-step-lbl">
                    {s.label}
                    {sideTag && <span className="eme2-step-side">{sideTag}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </RailField>
      </aside>

      {/* ── Canvas: the email ──────────────────────────────────── */}
      <section className="eme2-canvas">
        <div className="eme2-bar">
          {editing ? (
            <span className="eme2-badge custom">Editing your version</span>
          ) : isAgencyVersion ? (
            <span className="eme2-badge custom">Your version</span>
          ) : (
            <span className="eme2-badge">Sales Progressor default</span>
          )}

          <div className="eme2-actions">
            {editing ? (
              <>
                <button type="button" onClick={() => setEditing(false)} className="eme2-btn eme2-btn-ghost">
                  <X size={14} /> Cancel
                </button>
                <button type="button" onClick={save} disabled={saving} className="eme2-btn eme2-btn-primary">
                  {saving ? <CircleNotch size={14} className="eme2-spin" /> : <Check size={14} weight="bold" />}
                  {saving ? "Saving…" : "Save your version"}
                </button>
              </>
            ) : (
              <>
                {isAgencyVersion && (
                  <button type="button" onClick={reset} disabled={resetting} className="eme2-btn eme2-btn-ghost">
                    <ArrowCounterClockwise size={14} /> {resetting ? "Resetting…" : "Reset to default"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={!resolved || !resolved.exists || loading}
                  className="eme2-btn"
                >
                  <Pencil size={14} /> Edit wording
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="eme2-loading"><CircleNotch size={16} className="eme2-spin" /> Loading…</div>
        ) : loadError ? (
          <div className="eme2-state">
            <span style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: MUTED }}>
              <Warning size={16} weight="fill" style={{ marginTop: 1, flexShrink: 0, color: "#d97706" }} />
              We couldn&apos;t load this email just now. Check your connection and try again.
            </span>
            <button type="button" onClick={() => load()} className="eme2-btn eme2-btn-ghost" style={{ marginTop: 12 }}>
              <ArrowCounterClockwise size={14} /> Try again
            </button>
          </div>
        ) : !resolved ? null : !resolved.exists ? (
          <div className="eme2-state" style={{ color: MUTED, fontSize: 13.5 }}>
            This step doesn&apos;t send an email to the {SIDE_OPTIONS.find((o) => o.value === side)?.label.toLowerCase()}.
          </div>
        ) : shown ? (
          <>
            {look ? (
              <div key={editing ? `edit-${code}-${side}` : `view-${code}-${side}`}>
                {/* Subject sits above the email (it isn't part of the rendered
                    body), editable in place like everything else. */}
                <div className="eme2-subjline">
                  <span className="eme2-slbl">Subject</span>
                  {editing
                    ? <EditableRegion singleLine initial={shown.subject} onInput={(v) => setField("subject", v)} className="eme2-subjtxt" />
                    : <span className="eme2-subjtxt">{shown.subject}</span>}
                </div>
                {/* The real email, rendered through the shared Style engine. */}
                <div className={`eme2-stage${editing ? " editing" : ""}`} style={{ background: look.st.pageBg }}>
                  <EmailLookCard st={look.st} content={milestoneContent(shown, editing, setField)} identityName={look.identityName} logo={look.logoUrl} tileColor={look.tileColor} />
                </div>
              </div>
            ) : (
              <EmailCard key={editing ? `edit-${code}-${side}` : `view-${code}-${side}`} copy={shown} theme={previewTheme} editable={editing} onField={setField} />
            )}

            {editing ? (
              <>
                {warnings.length > 0 && (
                  <div className="eme2-warn" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                    {warnings.map((w, i) => (
                      <p key={i} style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "#92610a" }}>
                        <Warning size={14} weight="fill" style={{ marginTop: 1, flexShrink: 0, color: "#d97706" }} />
                        {w}
                      </p>
                    ))}
                  </div>
                )}
                <p className="eme2-caption">Edit the email above. Your version applies to every scenario. Details like {"{address}"} fill in for each sale when it sends.</p>
              </>
            ) : (
              <p className="eme2-caption">Preview uses example details for things like the address, dates and surveyor.</p>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

// ── Rail pieces ─────────────────────────────────────────────────────────────
function RailField({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className={`eme2-field${grow ? " grow" : ""}`}>
      <p className="eme2-field-lbl">{label}</p>
      {children}
    </div>
  );
}

// Segmented toggle: the active option is a solid coral-gradient pill with white
// text, and the pill slides between options (founder, 2026-10-15).
function Segmented({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className={`eme2-seg${disabled ? " disabled" : ""}`}
      style={{ ["--n" as string]: options.length, ["--i" as string]: idx } as React.CSSProperties}
    >
      <span className="eme2-seg-pill" aria-hidden />
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(o.value)}
            className={active ? "on" : ""}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Editable text region — contentEditable, seeded once so the caret never
// jumps; reports changes up without being re-controlled by React. ────────────
function EditableRegion({
  initial,
  onInput,
  className,
  style,
  placeholder,
  singleLine,
}: {
  initial: string;
  onInput: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  singleLine?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.textContent = initial;
    // Seed once on mount only — never re-seed from state (would move the caret).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      data-placeholder={placeholder}
      className={`eme2-edit${className ? " " + className : ""}`}
      style={style}
      onInput={(e) => onInput(e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => { if (singleLine && e.key === "Enter") e.preventDefault(); }}
    />
  );
}

// The rendered email — view (plain text) or edit (contentEditable in place).
function EmailCard({
  copy,
  theme,
  editable,
  onField,
}: {
  copy: Copy;
  theme?: PreviewTheme | null;
  editable?: boolean;
  onField?: (k: keyof Copy, v: string) => void;
}) {
  const accent = theme?.accent ?? "var(--agent-coral, #FF6B4A)";
  const set = (k: keyof Copy) => (v: string) => onField?.(k, v);

  return (
    <div className={`eme2-email${editable ? " editing" : ""}`} style={{ background: theme?.cardBg ?? "#fcfcfd", fontFamily: theme?.bodyFont }}>
      <div className="eme2-email-subj">
        <span className="eme2-slbl">Subject</span>
        {editable
          ? <EditableRegion singleLine initial={copy.subject} onInput={set("subject")} className="eme2-subjtxt" />
          : <p className="eme2-subjtxt">{copy.subject}</p>}
      </div>

      {theme ? (
        <div className="eme2-hero" style={{ background: theme.headerBg, color: theme.headerText }}>
          {editable
            ? <EditableRegion singleLine initial={copy.heroLabel} onInput={set("heroLabel")} className="eme2-herotxt" />
            : <span className="eme2-herotxt">{copy.heroLabel}</span>}
        </div>
      ) : null}

      <div className="eme2-email-body">
        {!theme && (
          editable
            ? <EditableRegion singleLine initial={copy.heroLabel} onInput={set("heroLabel")} className="eme2-hero-plain" />
            : <p className="eme2-hero-plain">{copy.heroLabel}</p>
        )}
        {editable
          ? <EditableRegion initial={copy.opening} onInput={set("opening")} className="eme2-p eme2-lede" />
          : <p className="eme2-p eme2-lede">{copy.opening}</p>}
        {editable
          ? <EditableRegion initial={copy.whatHappened} onInput={set("whatHappened")} className="eme2-p" />
          : <p className="eme2-p">{copy.whatHappened}</p>}
        {editable
          ? <EditableRegion initial={copy.whatNext ?? ""} onInput={set("whatNext")} className="eme2-p" placeholder="Add a follow-up paragraph, or leave blank" />
          : (copy.whatNext ? <p className="eme2-p">{copy.whatNext}</p> : null)}
        {editable
          ? <span className="eme2-cta" style={{ background: accent }}><EditableRegion singleLine initial={copy.action ?? ""} onInput={set("action")} placeholder="Button label" /></span>
          : (copy.action ? <span className="eme2-cta" style={{ background: accent }}>{copy.action}</span> : null)}
      </div>
    </div>
  );
}

const EME2_STYLES = `
  .eme2 { display: grid; grid-template-columns: 236px minmax(0,1fr); border: ${HAIRLINE}; border-radius: 14px; overflow: hidden; background: #fff; }
  .eme2-rail { background: #faf8f7; border-right: ${HAIRLINE}; padding: 18px; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
  .eme2-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
  .eme2-field.grow { flex: 1; min-height: 0; }
  .eme2-field-lbl { margin: 0; font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: ${FAINT}; }

  /* Animated segmented toggle: sliding coral-gradient pill, white active text. */
  .eme2-seg { position: relative; display: grid; grid-template-columns: repeat(var(--n), 1fr); border: ${HAIRLINE}; border-radius: 9px; background: #f3f1f0; padding: 3px; isolation: isolate; }
  .eme2-seg.disabled { opacity: .55; }
  .eme2-seg-pill { position: absolute; z-index: 0; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / var(--n)); border-radius: 6px; background: linear-gradient(180deg, #FF7A5C, #E2452A); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 2px 7px -1px rgba(226,69,42,.5); transform: translateX(calc(var(--i) * 100%)); transition: transform 260ms cubic-bezier(.34,1.25,.5,1); }
  .eme2-seg button { position: relative; z-index: 1; appearance: none; border: none; background: none; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 600; color: ${MUTED}; padding: 7px 8px; border-radius: 6px; transition: color 180ms ease; }
  .eme2-seg button:hover:not(.on):not(:disabled) { color: ${TEXT}; }
  .eme2-seg button:disabled { cursor: default; }
  .eme2-seg button.on { color: #fff; }
  .eme2-seg button:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255,107,74,.45); }

  .eme2-steps { display: flex; flex-direction: column; gap: 1px; max-height: 320px; overflow-y: auto; margin: 0 -4px; padding: 2px 4px; }
  .eme2-step { appearance: none; border: none; background: none; cursor: pointer; font: inherit; text-align: left; display: flex; gap: 8px; align-items: flex-start; padding: 7px 9px; border-radius: 8px; color: ${MUTED}; transition: background 140ms, color 140ms; }
  .eme2-step:hover:not(.on):not(:disabled) { background: rgba(0,0,0,.04); color: ${TEXT}; }
  .eme2-step:disabled { cursor: default; opacity: .5; }
  .eme2-step.on { background: rgba(255,107,74,.10); color: var(--agent-coral-deep, #E2452A); }
  .eme2-step:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255,107,74,.4); }
  .eme2-step-num { font-variant-numeric: tabular-nums; font-size: 10.5px; color: ${FAINT}; flex: 0 0 20px; margin-top: 1px; }
  .eme2-step.on .eme2-step-num { color: var(--agent-coral-deep, #E2452A); }
  .eme2-step-lbl { font-size: 12.5px; line-height: 1.35; }
  .eme2-step.on .eme2-step-lbl { font-weight: 650; }
  .eme2-step-side { display: block; font-size: 10.5px; font-weight: 500; color: ${FAINT}; margin-top: 1px; }
  .eme2-step.on .eme2-step-side { color: var(--agent-coral-deep, #E2452A); opacity: .8; }

  .eme2-canvas { padding: 20px; min-width: 0; }
  .eme2-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .eme2-badge { font-size: 11px; font-weight: 600; color: ${MUTED}; background: #f3f3f4; padding: 4px 10px; border-radius: 999px; }
  .eme2-badge.custom { color: var(--agent-coral-deep, #E2452A); background: rgba(255,107,74,.10); font-weight: 700; }
  .eme2-actions { display: flex; align-items: center; gap: 8px; }
  .eme2-btn { appearance: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; border-radius: 9px; padding: 7px 12px; display: inline-flex; align-items: center; gap: 6px; border: ${HAIRLINE}; background: #fff; color: #374151; transition: background 140ms, border-color 140ms, color 140ms, transform 80ms; }
  .eme2-btn:hover:not(:disabled) { background: rgba(0,0,0,.05); color: ${TEXT}; }
  .eme2-btn:active:not(:disabled) { transform: scale(.975); }
  .eme2-btn:disabled { opacity: .5; cursor: default; }
  .eme2-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,107,74,.32); }
  .eme2-btn-ghost { border-color: transparent; background: none; color: ${MUTED}; }
  .eme2-btn-ghost:hover:not(:disabled) { background: rgba(0,0,0,.05); color: ${TEXT}; }
  .eme2-btn-primary { border-color: transparent; color: #fff; background: linear-gradient(180deg,#FF7A5C,#E2452A); box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 3px 10px -4px rgba(255,107,74,.5); }
  .eme2-btn-primary:hover:not(:disabled) { filter: brightness(1.04); background: linear-gradient(180deg,#FF7A5C,#E2452A); color: #fff; }

  .eme2-warn { display: flex; align-items: flex-start; gap: 8px; border: 0.5px solid rgba(217,119,6,0.35); background: rgba(251,191,36,0.10); border-radius: 10px; padding: 9px 12px; font-size: 13px; color: #92610a; margin-top: 14px; }
  .eme2-loading { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: ${MUTED}; padding: 20px 2px; }
  .eme2-state { border: ${HAIRLINE}; border-radius: 12px; background: #fff; padding: 20px; }

  /* The email itself — a light "paper" surface like a real inbox. */
  .eme2-email { border: ${HAIRLINE}; border-radius: 11px; overflow: hidden; transition: box-shadow .2s ease; }
  .eme2-email.editing { box-shadow: 0 0 0 2px var(--agent-coral, #FF6B4A); }
  .eme2-email-subj { border-bottom: ${HAIRLINE}; padding: 11px 16px; background: #fff; }
  .eme2-slbl { display: block; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: ${FAINT}; margin-bottom: 3px; }
  .eme2-subjtxt { margin: 0; font-size: 14px; color: ${TEXT}; }
  .eme2-hero { padding: 16px; }
  .eme2-herotxt { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .eme2-email-body { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
  .eme2-hero-plain { margin: 0; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: ${FAINT}; }
  .eme2-p { margin: 0; font-size: 14px; line-height: 1.55; color: #374151; }
  .eme2-lede { color: ${TEXT}; }
  .eme2-cta { display: inline-block; width: fit-content; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #fff; }

  /* Edit-in-place affordance. */
  .eme2-edit { outline: none; cursor: text; border-radius: 3px; }
  .eme2-edit:empty:before { content: attr(data-placeholder); color: #bdbdbd; pointer-events: none; }
  .eme2-email.editing .eme2-edit { outline: 1px dashed rgba(226,69,42,.4); outline-offset: 3px; }
  .eme2-edit:focus { outline: 1.5px solid var(--agent-coral, #FF6B4A); outline-offset: 3px; }
  .eme2-cta .eme2-edit:empty:before { color: rgba(255,255,255,.7); }

  .eme2-subjline { border: ${HAIRLINE}; border-radius: 11px; background: #fff; padding: 11px 16px; margin-bottom: 12px; }
  .eme2-stage { border: ${HAIRLINE}; border-radius: 12px; padding: 20px; display: flex; justify-content: center; transition: box-shadow .2s ease; }
  .eme2-stage.editing { box-shadow: 0 0 0 2px var(--agent-coral, #FF6B4A); }

  .eme2-caption { margin: 12px 2px 0; font-size: 11.5px; color: ${FAINT}; }

  .eme2-spin { animation: eme2-spin .7s linear infinite; }
  @keyframes eme2-spin { to { transform: rotate(360deg); } }

  @media (max-width: 760px) {
    .eme2 { grid-template-columns: 1fr; }
    .eme2-rail { border-right: none; border-bottom: ${HAIRLINE}; }
    .eme2-steps { max-height: 220px; }
  }
  @media (prefers-reduced-motion: reduce) { .eme2-email, .eme2-btn, .eme2-seg button, .eme2-seg-pill, .eme2-step { transition: none; } }
`;
