"use client";

// Information tab (Batch 3, 2026-08-17). A quick, low-friction place for the
// client to tell their sales progressor their circumstances / availability /
// moving plans. Adapts to role + purchase type + milestone stage; auto-saves on
// selection (a subtle "Saved" fades in beside the relevant section header);
// read-only once completed. FOR THE PROGRESSOR ONLY — never shared with the
// other side. Onward agent DETAILS are edited under Settings > Your Agents; here
// we only ask the move-planning follow-ups.

import { useEffect, useState } from "react";
import { P } from "./portal-ui";
import { getMyMoveInfoAction, portalSaveMoveInfoAction } from "@/app/actions/portal";
import { portalOnwardMortgageStatusAction, portalConfirmOnwardMortgageOfferAction } from "@/app/actions/portal-onward";
import type { MoveInfo, MoveInfoContext, UnavailableRange } from "@/lib/services/portal-info";

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function PortalInformationTab({ token }: { token: string }) {
  const [ctx, setCtx] = useState<MoveInfoContext | null>(null);
  const [info, setInfo] = useState<MoveInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedSection, setSavedSection] = useState<string | null>(null);

  useEffect(() => {
    getMyMoveInfoAction(token).then((d) => {
      if (d) { setCtx(d.context); setInfo(d.info); }
      setLoading(false);
    });
  }, [token]);

  const [mortgageModal, setMortgageModal] = useState(false);
  const [mortgageBusy, setMortgageBusy] = useState(false);

  async function patch(section: string, p: Partial<MoveInfo>) {
    setInfo((prev) => (prev ? { ...prev, ...p } : prev));
    await portalSaveMoveInfoAction({ token, patch: p });
    setSavedSection(section);
    window.setTimeout(() => setSavedSection((s) => (s === section ? null : s)), 1600);
  }

  // Entering an onward mortgage-offer expiry implies the offer exists. If the
  // onward tracker still hasn't recorded the mortgage steps, offer to tick them.
  async function onwardExpiryChange(v: string | null) {
    await patch("onward", { onwardMortgageOfferExpiry: v });
    if (v) {
      const r = await portalOnwardMortgageStatusAction(token);
      if (r?.needsConfirm) setMortgageModal(true);
    }
  }

  if (loading) return <p className="text-[13px] py-6 text-center" style={{ color: P.textMuted }}>Loading…</p>;
  if (!ctx || !info) return <p className="text-[13px] py-6 text-center" style={{ color: P.textMuted }}>We couldn&apos;t load this.</p>;

  const other = ctx.role === "seller" ? "buyer" : "seller";
  const readOnly = ctx.hasCompleted;

  const intro = ctx.hasCompleted
    ? "Here's what you told us about your move."
    : ctx.hasExchanged
      ? `Add as much as you can. It helps your sales progressor plan ahead for completion and moving day, and you can change it anytime. This is just for your progressor and isn't shared with the ${other}.`
      : `Add as much as you can. It helps your sales progressor plan ahead for exchange and completion, and you can change it anytime. This is just for your progressor and isn't shared with the ${other}.`;

  return (
    <div className="pb-4">
      <div className="mb-5">
        <p className="text-[15px] font-bold mb-1" style={{ color: P.textPrimary }}>
          {ctx.hasCompleted ? "Your move" : "Tell us about your move"}
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>{intro}</p>
      </div>

      {/* YOUR MOVE */}
      <Section id="your-move" label="Your move" saved={savedSection}>
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
                <DateInput value={info.preferredCompletionDate} disabled={readOnly} onChange={(v) => patch("your-move", { preferredCompletionDate: v })} />
              )}
            </Row>
            <ToggleRow
              label="No preference yet"
              on={info.noCompletionPreference}
              disabled={readOnly}
              onChange={(on) => patch("your-move", { noCompletionPreference: on, ...(on ? { preferredCompletionDate: null } : {}) })}
            />
            <Field label="How flexible is your preferred date?">
              <Segmented value={info.flexibility} disabled={readOnly} options={[["very", "Very"], ["somewhat", "Somewhat"], ["not", "Not"]]} onChange={(v) => patch("your-move", { flexibility: v })} />
            </Field>
          </>
        )}
      </Section>

      {/* YOUR SITUATION (buyers) */}
      {ctx.role === "buyer" && (ctx.isMortgaged || !ctx.hasExchanged) && (
        <Section id="your-situation" label="Your situation" saved={savedSection}>
          {ctx.isMortgaged && (
            <Field label="Mortgage offer expiry">
              <DateInput value={info.mortgageOfferExpiry} disabled={readOnly} onChange={(v) => patch("your-situation", { mortgageOfferExpiry: v })} />
            </Field>
          )}
          {!ctx.hasExchanged && (
            <>
              <Field label={ctx.isMortgaged ? "Are the funds for your deposit in place?" : "Are the funds for your purchase in place?"}>
                <Segmented value={info.fundsInPlace} disabled={readOnly} options={[["yes", "Yes"], ["not_yet", "Not yet"], ["not_sure", "Not sure"]]} onChange={(v) => patch("your-situation", { fundsInPlace: v })} />
              </Field>
              <Field label="Where are they coming from?">
                <Segmented value={info.fundsSource} disabled={readOnly} options={[["savings", "Savings"], ["lisa", "Lifetime ISA"], ["gift", "Gift"], ["sale", "From a sale"], ["other", "Other"]]} onChange={(v) => patch("your-situation", { fundsSource: v })} />
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
                <YesNo value={info.needsNotice} disabled={readOnly} onChange={(v) => patch("your-situation", { needsNotice: v, ...(v ? {} : { noticePeriod: null, noticeGiven: null, noticeEndDate: null }) })} />
              </Field>
              {info.needsNotice === true && (
                <>
                  <Field label="Notice period">
                    <Segmented value={info.noticePeriod} disabled={readOnly} options={[["1m", "1 month"], ["2m", "2 months"], ["other", "Other"]]} onChange={(v) => patch("your-situation", { noticePeriod: v })} />
                  </Field>
                  <Field label="Have you given notice?">
                    <YesNo value={info.noticeGiven} disabled={readOnly} onChange={(v) => patch("your-situation", { noticeGiven: v, ...(v ? {} : { noticeEndDate: null }) })} />
                  </Field>
                  {info.noticeGiven === true && (
                    <Field label="Notice ends">
                      <DateInput value={info.noticeEndDate} disabled={readOnly} onChange={(v) => patch("your-situation", { noticeEndDate: v })} />
                    </Field>
                  )}
                </>
              )}
            </>
          )}
        </Section>
      )}

      {/* ONWARD PURCHASE (sellers, pre-exchange only) */}
      {ctx.role === "seller" && !ctx.hasExchanged && (
        <Section id="onward" label="Onward purchase" saved={savedSection}>
          {ctx.onwardLinkKnown ? (
            <Row label="Buying onward">
              <span className="text-[14px] font-semibold text-right" style={{ color: P.textPrimary }}>{ctx.onwardManagedAddress ?? "Yes"}</span>
            </Row>
          ) : (
            <Field label="Are you also buying another property?">
              <YesNo value={info.buyingOnward} disabled={readOnly} onChange={(v) => patch("onward", { buyingOnward: v })} />
            </Field>
          )}
          {(ctx.onwardLinkKnown || info.buyingOnward === true) && (
            <>
              {/* The onward STEP tracker moved to the Progress tab (swipe to
                  "Your onward"). Here we keep the mortgage-offer expiry, which
                  offers to confirm the offer and fill in the mortgage steps. */}
              <Field label="Onward mortgage offer expiry (if mortgaged)">
                <DateInput value={info.onwardMortgageOfferExpiry} disabled={readOnly} onChange={onwardExpiryChange} />
              </Field>
              <p className="text-[11px] px-4 pb-3 -mt-1" style={{ color: P.textMuted }}>
                Track the steps on your onward under Progress. You can add your onward agent under Your agents in Settings.
              </p>
            </>
          )}
        </Section>
      )}

      {/* Mortgage-offer shortcut modal */}
      {mortgageModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!mortgageBusy) setMortgageModal(false); }}>
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
          <div
            className="relative w-full max-w-md mx-auto p-6"
            style={{ background: P.cardBg, borderRadius: P.radiusXl, boxShadow: P.shadowXl, marginBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[18px] font-semibold mb-2" style={{ color: P.textPrimary }}>Is your mortgage offer in place?</p>
            <p className="text-[14px] leading-relaxed mb-5" style={{ color: P.textSecondary }}>
              You&apos;ve added your offer expiry, so it sounds like your mortgage is sorted. If your offer is in place, we&apos;ll tick off the mortgage steps on your onward: applied, valuation and offer received.
            </p>
            <button
              onClick={async () => { setMortgageBusy(true); try { await portalConfirmOnwardMortgageOfferAction(token); } finally { setMortgageBusy(false); setMortgageModal(false); } }}
              disabled={mortgageBusy}
              className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white mb-2"
              style={{ background: P.primary, borderRadius: P.radiusMd, opacity: mortgageBusy ? 0.6 : 1 }}
            >
              {mortgageBusy ? "Saving…" : "Yes, my offer is in place"}
            </button>
            <button
              onClick={() => setMortgageModal(false)}
              disabled={mortgageBusy}
              className="w-full py-3 text-[15px] font-medium rounded-xl"
              style={{ color: P.textSecondary }}
            >
              Not yet
            </button>
          </div>
        </div>
      )}

      {/* MOVING PLANS */}
      <Section id="moving-plans" label="Moving plans" saved={savedSection}>
        <Field label="Removals">
          <Segmented value={info.removalStatus} disabled={readOnly} options={[["not_started", "Not started"], ["getting_quotes", "Getting quotes"], ["provisional", "Provisionally booked"], ["confirmed", "Confirmed"]]} onChange={(v) => patch("moving-plans", { removalStatus: v })} />
        </Field>
        {info.removalStatus === "confirmed" && (
          <Field label="Removal company (optional)">
            <TextInput value={info.removalCompany} disabled={readOnly} placeholder="Company name" onCommit={(v) => patch("moving-plans", { removalCompany: v })} />
          </Field>
        )}
      </Section>

      {/* HANDOVER (sellers, near/after exchange) */}
      {ctx.role === "seller" && ctx.hasExchanged && (
        <Section id="handover" label="Handover" saved={savedSection}>
          <Field label="Will the property be vacant before completion?">
            <Segmented value={info.vacantBeforeCompletion} disabled={readOnly} options={[["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]]} onChange={(v) => patch("handover", { vacantBeforeCompletion: v })} />
          </Field>
        </Section>
      )}

      {/* AVAILABILITY */}
      <Section id="availability" label="Dates you can't do" saved={savedSection}>
        <UnavailableEditor value={info.unavailableDates} disabled={readOnly} onChange={(v) => patch("availability", { unavailableDates: v })} />
      </Section>

      {/* ANYTHING ELSE — no card wrapper: the textarea is its own container. */}
      <div className="mb-5">
        <SectionLabel label="Anything else" saved={savedSection === "anything-else"} />
        <TextArea
          value={info.progressorNote}
          disabled={readOnly}
          placeholder="Anything your sales progressor should know about your move."
          onCommit={(v) => patch("anything-else", { progressorNote: v })}
        />
      </div>

      {readOnly && (
        <p className="text-[12px] mt-1" style={{ color: P.textMuted }}>
          Your move is complete, so this is now read-only.
        </p>
      )}
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */

function SectionLabel({ label, saved }: { label: string; saved: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: P.textMuted }}>{label}</p>
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold"
        style={{ color: P.success, opacity: saved ? 1 : 0, transition: "opacity 300ms ease" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        Saved
      </span>
    </div>
  );
}

function Section({ id, label, saved, children }: { id: string; label: string; saved: string | null; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <SectionLabel label={label} saved={saved === id} />
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
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-60" style={{ borderBottom: `1px solid ${P.border}` }}>
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
          <button key={val} type="button" disabled={disabled} onClick={() => onChange(val)} className="pbtn-press text-[13px] font-semibold px-3.5 py-2 rounded-xl disabled:opacity-60" style={active ? { background: P.primary, color: "#fff" } : { background: P.pageBg, color: P.textSecondary, border: `1px solid ${P.border}` }}>
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
          <button key={String(val)} type="button" disabled={disabled} onClick={() => onChange(val as boolean)} className="pbtn-press text-[13px] font-semibold px-4 py-2 rounded-xl disabled:opacity-60" style={active ? { background: P.primary, color: "#fff" } : { background: P.pageBg, color: P.textSecondary, border: `1px solid ${P.border}` }}>
            {label as string}
          </button>
        );
      })}
    </div>
  );
}

function DateInput({ value, disabled, onChange }: { value: string | null; disabled?: boolean; onChange: (v: string | null) => void }) {
  return (
    <input type="date" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} className="rounded-lg px-2.5 py-1.5 text-[14px] font-semibold disabled:opacity-60" style={{ border: `1px solid ${P.border}`, background: P.pageBg, color: P.textPrimary }} />
  );
}

function TextInput({ value, placeholder, disabled, onCommit }: { value: string | null; placeholder?: string; disabled?: boolean; onCommit: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <input type="text" value={v} placeholder={placeholder} disabled={disabled} onChange={(e) => setV(e.target.value)} onBlur={() => { const t = v.trim(); if ((t || null) !== (value ?? null)) onCommit(t || null); }} className="w-full rounded-lg px-3 py-2 text-[14px] disabled:opacity-60" style={{ border: `1px solid ${P.border}`, background: P.pageBg, color: P.textPrimary }} />
  );
}

function TextArea({ value, placeholder, disabled, onCommit }: { value: string | null; placeholder?: string; disabled?: boolean; onCommit: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <textarea value={v} placeholder={placeholder} disabled={disabled} rows={3} onChange={(e) => setV(e.target.value)} onBlur={() => { const t = v.trim(); if ((t || null) !== (value ?? null)) onCommit(t || null); }} className="w-full rounded-2xl px-3.5 py-3 text-[14px] leading-relaxed resize-none disabled:opacity-60" style={{ border: `1px solid ${P.border}`, background: P.cardBg, boxShadow: P.shadowSm, color: P.textPrimary }} />
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
  function remove(i: number) { onChange(value.filter((_, idx) => idx !== i)); }

  return (
    <div className="px-4 py-3">
      {value.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {value.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: P.pageBg }}>
              <span className="text-[13.5px] font-medium" style={{ color: P.textPrimary }}>{fmtDate(r.start)}{r.end ? ` to ${fmtDate(r.end)}` : ""}</span>
              {!disabled && <button type="button" onClick={() => remove(i)} aria-label="Remove" className="text-[12px] font-semibold" style={{ color: P.textMuted }}>Remove</button>}
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
        <button type="button" onClick={() => setAdding(true)} className="pbtn-press inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: P.primary }}>+ Add dates</button>
      ))}

      {value.length === 0 && !adding && <p className="text-[12px] mt-1.5" style={{ color: P.textMuted }}>Holidays or any dates you couldn&apos;t move.</p>}
    </div>
  );
}
