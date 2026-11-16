"use client";

// Shared survey-booking capture sheet (critique #295). The buyer can reach the
// survey step from three places — the progress-page step list, the overview's
// "next step" card, and the chase-email respond page. All three open THIS one
// sheet in place (no page-leaving, no duplicated form), so a survey can never be
// booked without the surveyor's name + at least one contact. On confirm it marks
// the milestone done and records the surveyor (name title-cased, phone
// normalised, email lowercased/validated server-side in applySurveyBooking).

import { useState, useEffect } from "react";
import { PortalSheet } from "./PortalSheet";
import { P } from "./portal-ui";
import { DateField } from "@/components/ui/DateField";
import { isValidEmail } from "@/lib/utils";
import { portalConfirmMilestoneAction, getPortalSurveyBookingOptions, recordPortalSurveyBookingAction } from "@/app/actions/portal";
import type { SurveyBookingOption, SurveyBookingChoice } from "@/lib/services/survey-booking";

async function fireConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 }, colors: ["#FF8A65", "#FFB74D", "#FFD54F", "#FF6B4A", "#FFA726"] });
  } catch { /* confetti is a nicety — never block the confirm on it */ }
}

export function SurveyBookingSheet({
  token,
  milestoneId,
  open,
  onClose,
  onConfirmed,
  readOnly = false,
  mirrorSourceToken,
}: {
  token: string;
  /** The survey milestone (PM9) definition id to confirm. */
  milestoneId: string | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful confirm so the host page can refresh. */
  onConfirmed?: () => void;
  readOnly?: boolean;
  mirrorSourceToken?: string;
}) {
  const [surveyDate, setSurveyDate] = useState("");
  const [options, setOptions] = useState<SurveyBookingOption[] | null>(null);
  const [choice, setChoice] = useState<SurveyBookingChoice | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields + load any quoted firms each time the sheet opens.
  useEffect(() => {
    if (!open || !milestoneId) return;
    setSurveyDate(""); setChoice(null); setName(""); setPhone(""); setEmail(""); setError(null); setOptions(null);
    getPortalSurveyBookingOptions(token).then((opts) => { if (opts.length > 0) setOptions(opts); }).catch(() => {});
  }, [open, milestoneId, token]);

  function close() { if (!loading) onClose(); }

  async function confirm() {
    if (readOnly) { onClose(); return; }
    if (!milestoneId) return;
    if (!surveyDate) { setError("Please enter the survey date."); return; }

    // our_firm: we already hold the firm's name + contact. Otherwise require a
    // name and at least one contact so we can arrange access (critique #295).
    let finalChoice: SurveyBookingChoice;
    if (choice?.kind === "our_firm") {
      finalChoice = choice;
    } else {
      if (options && !choice) { setError("Please choose the surveyor you booked."); return; }
      const n = name.trim(), p = phone.trim(), e = email.trim();
      if (!n) { setError("Enter the surveyor's name."); return; }
      if (e && !isValidEmail(e)) { setError("That surveyor email doesn't look right. Please check it."); return; }
      if (!p && !e) { setError("Add the surveyor's email or phone, so we can arrange access."); return; }
      finalChoice = { kind: "someone_else", firmName: n || undefined, email: e || null, phone: p || null };
    }

    setLoading(true);
    try {
      const res = await portalConfirmMilestoneAction({ token, milestoneDefinitionId: milestoneId, eventDate: surveyDate, mirrorSourceToken });
      if (res.ok) {
        await recordPortalSurveyBookingAction({ token, choice: finalChoice }).catch(() => {});
        await fireConfetti();
        onClose();
        onConfirmed?.();
      } else {
        setError("We couldn't save that just now. Please try again.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const showContactFields = choice?.kind === "someone_else" || !options;

  return (
    <PortalSheet open={open} onClose={close} closeDisabled={loading}>
      {open && milestoneId && (
        <div className="px-6 pb-6 pt-2">
          <p className="text-[18px] font-semibold leading-snug mb-2" style={{ color: P.textPrimary }}>
            Your survey booking
          </p>
          <p className="text-[14px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
            You&apos;ve arranged your survey. Tell us the date it&apos;s taking place and who&apos;s carrying it out, so we can coordinate access to the property.
          </p>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>
              Survey date <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <DateField
              value={surveyDate}
              onChange={(e) => setSurveyDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
              style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
            />
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>
              {options ? "Which surveyor did you book?" : "Who did you book your survey with?"}
            </label>
            <div className="flex flex-col gap-2">
              {options?.map((o) => {
                const active = choice?.kind === "our_firm" && choice.quoteRequestId === o.quoteRequestId;
                return (
                  <button
                    key={o.quoteRequestId}
                    type="button"
                    onClick={() => setChoice({ kind: "our_firm", quoteRequestId: o.quoteRequestId })}
                    className="pbtn-press text-left px-4 py-3 rounded-xl text-[14px] font-semibold border transition-colors"
                    style={{ borderColor: active ? P.primary : P.border, borderWidth: active ? 2 : 1, background: active ? P.primaryBg : P.cardBg, color: P.textPrimary }}
                  >
                    {o.firmName}
                  </button>
                );
              })}
              {options && (
                <button
                  type="button"
                  onClick={() => setChoice({ kind: "someone_else" })}
                  className="pbtn-press text-left px-4 py-3 rounded-xl text-[14px] border transition-colors"
                  style={{ borderColor: choice?.kind === "someone_else" ? P.primary : P.border, borderWidth: choice?.kind === "someone_else" ? 2 : 1, background: choice?.kind === "someone_else" ? P.primaryBg : P.cardBg, color: P.textPrimary }}
                >
                  I booked someone else
                </button>
              )}
              {showContactFields && (
                <>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Surveyor's name"
                    className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
                    style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Surveyor's phone"
                    className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
                    style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Surveyor's email"
                    className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
                    style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
                  />
                  <p className="text-[12px] leading-snug" style={{ color: P.textMuted }}>
                    Add a phone or email so we can arrange access to the property.
                  </p>
                </>
              )}
            </div>
          </div>

          {error && <p className="text-[13px] mb-3" style={{ color: "#EF4444" }}>{error}</p>}

          <button
            onClick={confirm}
            disabled={loading || readOnly}
            className="pbtn pbtn-press w-full flex items-center justify-center py-4 rounded-xl text-[15px] font-bold text-white disabled:opacity-50 transition-opacity"
            style={{ background: P.primary, borderRadius: P.radiusMd, cursor: readOnly ? "not-allowed" : undefined }}
          >
            {loading ? "Saving…" : "Confirm"}
          </button>
          {readOnly && (
            <p className="text-[11.5px] text-center mt-2" style={{ color: P.textMuted }}>
              Preview — only your client can confirm this.
            </p>
          )}
          <button
            onClick={close}
            disabled={loading}
            className="pbtn pbtn-press w-full mt-3 py-3 text-[15px] font-medium rounded-xl"
            style={{ color: P.textSecondary }}
          >
            Cancel
          </button>
        </div>
      )}
    </PortalSheet>
  );
}
