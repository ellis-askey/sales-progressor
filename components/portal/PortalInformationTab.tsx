"use client";

// Information tab (Batch 3, 2026-08-17). A quick, low-friction place for the
// client to tell their sales progressor their circumstances / availability /
// moving plans. Adapts to role + purchase type + milestone stage; auto-saves on
// selection (no big Save button); read-only once completed. FOR THE PROGRESSOR
// ONLY — never shared with the other side.
//
// Stage 3a: intro + Your move + Moving plans (removals) + Availability + note.
// Stage 3b adds the conditional Situation (mortgage / funds / notice / onward)
// and seller handover sections.

import { useEffect, useState } from "react";
import { P } from "./portal-ui";
import { getMyMoveInfoAction, portalSaveMoveInfoAction } from "@/app/actions/portal";
import type { MoveInfo, MoveInfoContext, UnavailableRange } from "@/lib/services/portal-info";

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function PortalInformationTab({ token }: { token: string }) {
  const [ctx, setCtx] = useState<MoveInfoContext | null>(null);
  const [info, setInfo] = useState<MoveInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMyMoveInfoAction(token).then((d) => {
      if (d) { setCtx(d.context); setInfo(d.info); }
      setLoading(false);
    });
  }, [token]);

  async function patch(p: Partial<MoveInfo>) {
    setInfo((prev) => (prev ? { ...prev, ...p } : prev));
    await portalSaveMoveInfoAction({ token, patch: p });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  if (loading) return <p className="text-[13px] py-6 text-center" style={{ color: P.textMuted }}>Loading…</p>;
  if (!ctx || !info) return <p className="text-[13px] py-6 text-center" style={{ color: P.textMuted }}>We couldn&apos;t load this.</p>;

  const other = ctx.role === "seller" ? "buyer" : "seller";
  const readOnly = ctx.hasCompleted;

  return (
    <div className="pb-4">
      {/* Intro */}
      <div className="mb-5">
        <p className="text-[15px] font-bold mb-1" style={{ color: P.textPrimary }}>Tell us about your move</p>
        <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>
          Add as much as you can. It helps your sales progressor plan ahead for exchange and completion, and you can
          change it anytime. This is just for your progressor and isn&apos;t shared with the {other}.
        </p>
      </div>

      {saved && (
        <div className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: P.success }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          Saved
        </div>
      )}

      {/* YOUR MOVE */}
      <Section label="Your move">
        {ctx.hasExchanged ? (
          <Row label="Completion date">
            <span className="text-[14px] font-semibold" style={{ color: P.textPrimary }}>
              {ctx.completionDate ? fmtDate(ctx.completionDate) : "To be confirmed"}
            </span>
          </Row>
        ) : (
          <>
            <Row label="Preferred completion date">
              {info.noCompletionPreference ? (
                <span className="text-[13px]" style={{ color: P.textMuted }}>No preference yet</span>
              ) : (
                <DateInput value={info.preferredCompletionDate} disabled={readOnly} onChange={(v) => patch({ preferredCompletionDate: v })} />
              )}
            </Row>
            <ToggleRow
              label="No preference yet"
              on={info.noCompletionPreference}
              disabled={readOnly}
              onChange={(on) => patch({ noCompletionPreference: on, ...(on ? { preferredCompletionDate: null } : {}) })}
            />
            <Field label="How flexible is your preferred date?">
              <Segmented
                value={info.flexibility}
                disabled={readOnly}
                options={[["very", "Very"], ["somewhat", "Somewhat"], ["not", "Not"]]}
                onChange={(v) => patch({ flexibility: v })}
              />
            </Field>
          </>
        )}
      </Section>

      {/* YOUR SITUATION (buyers) */}
      {ctx.role === "buyer" && (ctx.isMortgaged || !ctx.hasExchanged) && (
        <Section label="Your situation">
          {ctx.isMortgaged && (
            <Field label="Mortgage offer expiry">
              <DateInput value={info.mortgageOfferExpiry} disabled={readOnly} onChange={(v) => patch({ mortgageOfferExpiry: v })} />
            </Field>
          )}
          {!ctx.hasExchanged && (
            <>
              <Field label={ctx.isMortgaged ? "Are the funds for your deposit in place?" : "Are the funds for your purchase in place?"}>
                <Segmented value={info.fundsInPlace} disabled={readOnly} options={[["yes", "Yes"], ["not_yet", "Not yet"], ["not_sure", "Not sure"]]} onChange={(v) => patch({ fundsInPlace: v })} />
              </Field>
              <Field label="Where are they coming from?">
                <Segmented value={info.fundsSource} disabled={readOnly} options={[["savings", "Savings"], ["lisa", "Lifetime ISA"], ["gift", "Gift"], ["sale", "From a sale"], ["other", "Other"]]} onChange={(v) => patch({ fundsSource: v })} />
                <p className="text-[12px] mt-2 leading-snug" style={{ color: P.textMuted }}>
                  {info.fundsSource === "lisa"
                    ? "A Lifetime ISA can take up to 30 days to release, so it helps us to know. You don't need to move the money now."
                    : "Just so we can plan timing. You don't need to move any money now."}
                </p>
              </Field>
            </>
          )}
          {ctx.isMortgaged && (
            <>
              <Field label="Do you need to give notice on your current home?">
                <YesNo value={info.needsNotice} disabled={readOnly} onChange={(v) => patch({ needsNotice: v, ...(v ? {} : { noticePeriod: null, noticeGiven: null, noticeEndDate: null }) })} />
              </Field>
              {info.needsNotice === true && (
                <>
                  <Field label="Notice period">
                    <Segmented value={info.noticePeriod} disabled={readOnly} options={[["1m", "1 month"], ["2m", "2 months"], ["other", "Other"]]} onChange={(v) => patch({ noticePeriod: v })} />
                  </Field>
                  <Field label="Have you given notice?">
                    <YesNo value={info.noticeGiven} disabled={readOnly} onChange={(v) => patch({ noticeGiven: v, ...(v ? {} : { noticeEndDate: null }) })} />
                  </Field>
                  {info.noticeGiven === true && (
                    <Field label="Notice ends">
                      <DateInput value={info.noticeEndDate} disabled={readOnly} onChange={(v) => patch({ noticeEndDate: v })} />
                    </Field>
                  )}
                </>
              )}
            </>
          )}
        </Section>
      )}

      {/* ONWARD PURCHASE (sellers) */}
      {ctx.role === "seller" && (
        <Section label="Onward purchase">
          {ctx.onwardLinkKnown ? (
            <Row label="Buying onward">
              <span className="text-[14px] font-semibold text-right" style={{ color: P.textPrimary }}>{ctx.onwardManagedAddress ?? "Yes"}</span>
            </Row>
          ) : (
            <Field label="Are you also buying another property?">
              <YesNo value={info.buyingOnward} disabled={readOnly} onChange={(v) => patch({ buyingOnward: v })} />
            </Field>
          )}
          {(ctx.onwardLinkKnown || info.buyingOnward === true) && (
            <>
              <Field label="Is your onward purchase ready to exchange?">
                <Segmented value={info.onwardReadyToExchange} disabled={readOnly} options={[["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]]} onChange={(v) => patch({ onwardReadyToExchange: v })} />
              </Field>
              <Field label="Onward mortgage offer expiry (if mortgaged)">
                <DateInput value={info.onwardMortgageOfferExpiry} disabled={readOnly} onChange={(v) => patch({ onwardMortgageOfferExpiry: v })} />
              </Field>
            </>
          )}
        </Section>
      )}

      {/* MOVING PLANS */}
      <Section label="Moving plans">
        <Field label="Removals">
          <Segmented
            value={info.removalStatus}
            disabled={readOnly}
            options={[["not_started", "Not started"], ["getting_quotes", "Getting quotes"], ["provisional", "Provisionally booked"], ["confirmed", "Confirmed"]]}
            onChange={(v) => patch({ removalStatus: v })}
          />
        </Field>
        {info.removalStatus === "confirmed" && (
          <Field label="Removal company (optional)">
            <TextInput value={info.removalCompany} disabled={readOnly} placeholder="Company name" onCommit={(v) => patch({ removalCompany: v })} />
          </Field>
        )}
      </Section>

      {/* HANDOVER (sellers, near/after exchange) */}
      {ctx.role === "seller" && ctx.hasExchanged && (
        <Section label="Handover">
          <Field label="Will the property be vacant before completion?">
            <Segmented value={info.vacantBeforeCompletion} disabled={readOnly} options={[["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]]} onChange={(v) => patch({ vacantBeforeCompletion: v })} />
          </Field>
        </Section>
      )}

      {/* AVAILABILITY */}
      <Section label="Dates you can't do">
        <UnavailableEditor value={info.unavailableDates} disabled={readOnly} onChange={(v) => patch({ unavailableDates: v })} />
      </Section>

      {/* ANYTHING ELSE */}
      <Section label="Anything else">
        <TextArea
          value={info.progressorNote}
          disabled={readOnly}
          placeholder="Anything your sales progressor should know about your move."
          onCommit={(v) => patch({ progressorNote: v })}
        />
      </Section>

      {readOnly && (
        <p className="text-[12px] mt-3" style={{ color: P.textMuted }}>
          Your move is complete, so this is now read-only.
        </p>
      )}
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.09em] mb-2.5" style={{ color: P.textMuted }}>{label}</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${P.border}` }}>
      <p className="text-[14px]" style={{ color: P.textPrimary }}>{label}</p>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3" style={{ borderBottom: `1px solid ${P.border}` }}>
      <p className="text-[13px] mb-2" style={{ color: P.textSecondary }}>{label}</p>
      {children}
    </div>
  );
}

function ToggleRow({ label, on, disabled, onChange }: { label: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-60"
      style={{ borderBottom: `1px solid ${P.border}` }}
    >
      <span className="text-[14px]" style={{ color: P.textPrimary }}>{label}</span>
      <span className="relative inline-flex flex-shrink-0 rounded-full transition-colors" style={{ width: 38, height: 22, background: on ? P.primary : "rgba(15,23,42,0.18)" }}>
        <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 18, height: 18, left: on ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
      </span>
    </button>
  );
}

/* ── Controls ────────────────────────────────────────────────────────────── */

function Segmented({ value, options, disabled, onChange }: { value: string | null; options: [string, string][]; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([val, label]) => {
        const active = value === val;
        return (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => onChange(val)}
            className="pbtn-press text-[13px] font-semibold px-3.5 py-2 rounded-xl disabled:opacity-60"
            style={active
              ? { background: P.primary, color: "#fff" }
              : { background: P.pageBg, color: P.textSecondary, border: `1px solid ${P.border}` }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, disabled, onChange }: { value: boolean | null; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[[true, "Yes"], [false, "No"]].map(([val, label]) => {
        const active = value === val;
        return (
          <button
            key={String(val)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(val as boolean)}
            className="pbtn-press text-[13px] font-semibold px-4 py-2 rounded-xl disabled:opacity-60"
            style={active ? { background: P.primary, color: "#fff" } : { background: P.pageBg, color: P.textSecondary, border: `1px solid ${P.border}` }}
          >
            {label as string}
          </button>
        );
      })}
    </div>
  );
}

function DateInput({ value, disabled, onChange }: { value: string | null; disabled?: boolean; onChange: (v: string | null) => void }) {
  return (
    <input
      type="date"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg px-2.5 py-1.5 text-[14px] font-semibold disabled:opacity-60"
      style={{ border: `1px solid ${P.border}`, background: P.pageBg, color: P.textPrimary }}
    />
  );
}

function TextInput({ value, placeholder, disabled, onCommit }: { value: string | null; placeholder?: string; disabled?: boolean; onCommit: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <input
      type="text"
      value={v}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const t = v.trim(); if ((t || null) !== (value ?? null)) onCommit(t || null); }}
      className="w-full rounded-lg px-3 py-2 text-[14px] disabled:opacity-60"
      style={{ border: `1px solid ${P.border}`, background: P.pageBg, color: P.textPrimary }}
    />
  );
}

function TextArea({ value, placeholder, disabled, onCommit }: { value: string | null; placeholder?: string; disabled?: boolean; onCommit: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <textarea
      value={v}
      placeholder={placeholder}
      disabled={disabled}
      rows={3}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const t = v.trim(); if ((t || null) !== (value ?? null)) onCommit(t || null); }}
      className="w-full rounded-xl px-3 py-2.5 text-[14px] leading-relaxed resize-none disabled:opacity-60"
      style={{ border: `1px solid ${P.border}`, background: P.pageBg, color: P.textPrimary }}
    />
  );
}

function UnavailableEditor({ value, disabled, onChange }: { value: UnavailableRange[]; disabled?: boolean; onChange: (v: UnavailableRange[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  function add() {
    if (!start) return;
    onChange([...value, { start, end: end || null }]);
    setStart(""); setEnd(""); setAdding(false);
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="px-4 py-3">
      {value.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {value.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: P.pageBg }}>
              <span className="text-[13.5px] font-medium" style={{ color: P.textPrimary }}>
                {fmtDate(r.start)}{r.end ? ` – ${fmtDate(r.end)}` : ""}
              </span>
              {!disabled && (
                <button type="button" onClick={() => remove(i)} aria-label="Remove" className="text-[12px] font-semibold" style={{ color: P.textMuted }}>Remove</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (adding ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <DateInput value={start || null} onChange={(v) => setStart(v ?? "")} />
            <span className="text-[13px]" style={{ color: P.textMuted }}>to (optional)</span>
            <DateInput value={end || null} onChange={(v) => setEnd(v ?? "")} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={add} disabled={!start} className="pbtn-press text-[13px] font-bold text-white px-3.5 py-2 rounded-xl disabled:opacity-50" style={{ background: P.primary }}>Add</button>
            <button type="button" onClick={() => { setAdding(false); setStart(""); setEnd(""); }} className="pbtn-press text-[13px] font-semibold px-3.5 py-2 rounded-xl" style={{ color: P.textSecondary }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="pbtn-press inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: P.primary }}>
          + Add dates
        </button>
      ))}

      {value.length === 0 && !adding && (
        <p className="text-[12px] mt-1.5" style={{ color: P.textMuted }}>Holidays or any dates you couldn&apos;t move.</p>
      )}
    </div>
  );
}
