"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advisorConfirmStepAction, advisorUpdateStepAction } from "./actions";
import { P } from "@/components/portal/portal-ui";
import type { AdvisorStep } from "@/lib/advisor-confirm/portal-data";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}
function primaryLabel(code: string): string {
  if (code === "PM5") return "Mark as submitted";
  if (code === "PM6") return "Confirm valuation";
  return "Mark offer received";
}

function StepDot({ status }: { status: "complete" | "current" | "upcoming" }) {
  if (status === "complete") {
    return (
      <span style={{ width: 22, height: 22, borderRadius: 999, background: P.success, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 6.2 5 8.7 9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    );
  }
  if (status === "current") return <span style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${P.primary}`, background: P.primaryBg, flexShrink: 0 }} />;
  return <span style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${P.border}`, background: P.cardBg, flexShrink: 0 }} />;
}

type Drawer = { kind: "confirm" | "note"; step: AdvisorStep } | null;

export function AdvisorMortgageSteps({ token, steps }: { token: string; steps: AdvisorStep[] }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Drawer form fields
  const [vDate, setVDate] = useState("");
  const [desktop, setDesktop] = useState(false);
  const [valuer, setValuer] = useState("");
  const [offerExpiry, setOfferExpiry] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setVDate(""); setDesktop(false); setValuer(""); setOfferExpiry(""); setNote(""); setError(null);
  }
  function open(kind: "confirm" | "note", step: AdvisorStep) { reset(); setDrawer({ kind, step }); }
  function close() { setDrawer(null); reset(); }
  function markDone(id: string) { setJustDone((p) => new Set(p).add(id)); }

  function directConfirm(step: AdvisorStep) {
    setError(null);
    startTransition(async () => {
      try {
        await advisorConfirmStepAction(token, step.id, {});
        markDone(step.id);
        router.refresh();
      } catch (e) { setError(errMsg(e)); }
    });
  }

  function submitConfirm(step: AdvisorStep) {
    setError(null);
    startTransition(async () => {
      try {
        await advisorConfirmStepAction(token, step.id, {
          eventDate: step.code === "PM6" ? (vDate || null) : null,
          desktop: step.code === "PM6" ? desktop : false,
          valuerName: step.code === "PM6" ? (valuer || null) : null,
          offerExpiry: step.code === "PM11" ? (offerExpiry || null) : null,
          note: note || null,
        });
        markDone(step.id);
        close();
        router.refresh();
      } catch (e) { setError(errMsg(e)); }
    });
  }

  function submitNote(step: AdvisorStep) {
    setError(null);
    startTransition(async () => {
      try {
        await advisorUpdateStepAction(token, step.id, null, note);
        close();
        router.refresh();
      } catch (e) { setError(errMsg(e)); }
    });
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {steps.map((s) => {
          const done = s.status === "complete" || justDone.has(s.id);
          const current = !done && s.status === "current";
          return (
            <div key={s.code} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <StepDot status={done ? "complete" : current ? "current" : "upcoming"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: done || current ? P.textPrimary : P.textMuted }}>{s.label}</p>
                {done ? (
                  <p style={{ margin: "1px 0 0", fontSize: 12.5, color: P.success, fontWeight: 600 }}>
                    {justDone.has(s.id) ? "Confirmed. Thank you." : `Confirmed${fmtDate(s.date) ? ` · ${fmtDate(s.date)}` : ""}`}
                  </p>
                ) : current ? (
                  <>
                    <p style={{ margin: "1px 0 0", fontSize: 12.5, color: P.textSecondary }}>
                      {fmtDate(s.date) ? `In progress · expected ${fmtDate(s.date)}` : "Waiting on this"}
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        className="pbtn pbtn-primary pbtn-press"
                        disabled={pending}
                        onClick={() => (s.code === "PM5" ? directConfirm(s) : open("confirm", s))}
                        style={{ padding: "9px 14px", borderRadius: 11, fontSize: 13.5, fontWeight: 700, border: 0, color: "#fff", background: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)", cursor: "pointer" }}
                      >
                        {primaryLabel(s.code)}
                      </button>
                      <button
                        type="button"
                        className="pbtn pbtn-secondary pbtn-press"
                        disabled={pending}
                        onClick={() => open("note", s)}
                        style={{ padding: "9px 14px", borderRadius: 11, fontSize: 13.5, fontWeight: 600, background: "transparent", border: `1px solid ${P.border}`, color: P.textPrimary, cursor: "pointer" }}
                      >
                        Add a note
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ margin: "1px 0 0", fontSize: 12.5, color: P.textSecondary }}>Not yet</p>
                )}
                {error && (current) && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#c0392b" }}>{error}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {drawer && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 512, background: P.cardBg, borderRadius: "20px 20px 0 0", padding: "22px 20px calc(22px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 32px rgba(15,23,42,0.18)" }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: P.textPrimary }}>
              {drawer.kind === "note" ? "Add an update" : drawer.step.code === "PM6" ? "Confirm the valuation" : "Confirm the mortgage offer"}
            </p>
            <p style={{ margin: "2px 0 16px", fontSize: 13, color: P.textSecondary }}>{drawer.step.label}</p>

            {drawer.kind === "confirm" && drawer.step.code === "PM6" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: P.textSecondary }}>Valuation date{desktop ? "" : " *"}</span>
                  <input type="date" value={vDate} disabled={desktop} onChange={(e) => setVDate(e.target.value)} style={inputStyle(desktop)} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={desktop} onChange={(e) => setDesktop(e.target.checked)} style={{ width: 16, height: 16, accentColor: P.primary }} />
                  <span style={{ fontSize: 13.5, color: P.textPrimary }}>It&rsquo;s a desktop valuation, no visit needed</span>
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: P.textSecondary }}>Valuer / surveyor firm (optional)</span>
                  <input type="text" value={valuer} onChange={(e) => setValuer(e.target.value)} placeholder="e.g. Connells Survey & Valuation" style={inputStyle(false)} />
                </label>
              </div>
            )}

            {drawer.kind === "confirm" && drawer.step.code === "PM11" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: P.textSecondary }}>Offer expiry date (optional)</span>
                  <input type="date" value={offerExpiry} onChange={(e) => setOfferExpiry(e.target.value)} style={inputStyle(false)} />
                  <span style={{ display: "block", marginTop: 4, fontSize: 11.5, color: P.textMuted }}>If you know when the offer expires, adding it keeps our reminders accurate.</span>
                </label>
              </div>
            )}

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: P.textSecondary }}>{drawer.kind === "note" ? "Update" : "Note to the team (optional)"}</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="A short note for the team. Not shown to the buyer or seller." style={{ ...inputStyle(false), resize: "vertical", minHeight: 72 }} />
            </label>

            {error && <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#c0392b" }}>{error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={close} disabled={pending} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "transparent", border: `1px solid ${P.border}`, color: P.textPrimary, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                className="pbtn-press"
                disabled={pending}
                onClick={() => (drawer.kind === "note" ? submitNote(drawer.step) : submitConfirm(drawer.step))}
                style={{ flex: 2, padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: 0, color: "#fff", background: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)", cursor: "pointer" }}
              >
                {pending ? "Saving…" : drawer.kind === "note" ? "Send update" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    background: disabled ? "#f3f4f6" : "#fff",
    color: P.textPrimary,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}
