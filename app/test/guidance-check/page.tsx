"use client";

// DISPOSABLE PREVIEW — /test/* convention. Mirrors the exact help-sheet layout
// from components/portal/PortalMilestoneList.tsx (the "?" next to Confirm) so
// the "Learn more" guidance link can be checked without a real portal token.
// Delete after review. Not committed.

import { P } from "@/components/portal/portal-ui";
import { getMilestoneGuidance } from "@/lib/portal/milestone-guidance";

// One representative step per source, with its real client-facing description.
const SAMPLES: { code: string; who: "you" | "them"; whoLabel: string; label: string; description: string }[] = [
  {
    code: "VM5", who: "you", whoLabel: "You",
    label: "Property information forms received",
    description: "Your solicitor will send you forms about the property, including the TA6 Property Information Form and TA10 Fittings and Contents Form. These cover things such as boundaries, alterations, disputes and what's included in the sale.",
  },
  {
    code: "PM9", who: "you", whoLabel: "You",
    label: "Book your survey",
    description: "Arrange a Level 2 or Level 3 survey so you know the condition of the property before you commit. Your surveyor inspects it and reports back on anything worth knowing.",
  },
  {
    code: "VM8", who: "them", whoLabel: "Your solicitor",
    label: "Management pack requested",
    description: "If the property is leasehold or managed, your solicitor will request a management pack from the freeholder or managing agent. It sets out the charges and rules that come with the property.",
  },
  {
    code: "PM27", who: "you", whoLabel: "You",
    label: "Sale completed",
    description: "The money has moved and the property is yours. Your solicitor now registers you as the new owner with HM Land Registry and deals with any stamp duty due.",
  },
  {
    code: "PM11", who: "them", whoLabel: "Your solicitor",
    label: "Mortgage offer received",
    description: "Your lender has issued a formal mortgage offer to your solicitor. This confirms the amount, the rate and the conditions of your loan.",
  },
];

export default function GuidanceCheckPage() {
  return (
    <main style={{ minHeight: "100vh", background: P.pageBg, padding: "40px 20px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <p style={{ fontSize: 12, color: P.textMuted, marginBottom: 4, fontFamily: "ui-monospace, monospace" }}>
          disposable preview · mirrors the live help sheet
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: P.textPrimary, margin: "0 0 6px" }}>
          Milestone help sheet — guidance links
        </h1>
        <p style={{ fontSize: 13.5, color: P.textSecondary, margin: "0 0 24px", lineHeight: 1.5 }}>
          Each card is what a buyer or seller sees after tapping the &quot;?&quot; next to a step. Hover the
          &quot;Learn more&quot; link to see the arrow square up and glide. Every link opens the real
          authoritative page in a new tab.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {SAMPLES.map((m) => {
            const guidance = getMilestoneGuidance(m.code);
            return (
              <div
                key={m.code}
                style={{
                  background: P.cardBg,
                  border: `1px solid ${P.border}`,
                  borderRadius: P.radiusLg,
                  padding: "20px 22px",
                  boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                }}
              >
                <span
                  className="inline-block text-[11px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full mb-3"
                  style={
                    m.who === "you"
                      ? { background: P.primaryBg, color: P.primaryText }
                      : { background: P.accentBg, color: P.accent }
                  }
                >
                  {m.whoLabel}
                </span>
                <p className="text-[18px] font-semibold leading-snug mb-3" style={{ color: P.textPrimary }}>
                  {m.label}
                </p>
                <p className="text-[14px] leading-relaxed" style={{ color: P.textSecondary }}>
                  {m.description}
                </p>
                {guidance && (
                  <div className="mt-4 flex items-center gap-2">
                    <a
                      href={guidance.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="portal-guidance-link inline-flex items-center gap-1.5 text-[13.5px] font-semibold"
                      style={{ color: P.accent }}
                    >
                      Learn more
                      <span className="pgl-glide inline-flex">
                        <span className="pgl-spin inline-flex">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                          </svg>
                        </span>
                      </span>
                    </a>
                    <span className="text-[11.5px]" style={{ color: P.textMuted }}>{guidance.source}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .portal-guidance-link .pgl-spin {
          transform: rotate(-45deg);
          transition: transform 170ms cubic-bezier(0.16,1,0.3,1);
        }
        .portal-guidance-link .pgl-glide {
          transform: translateX(0);
          transition: transform 220ms cubic-bezier(0.16,1,0.3,1) 150ms;
        }
        .portal-guidance-link:hover .pgl-spin { transform: rotate(0deg); }
        .portal-guidance-link:hover .pgl-glide { transform: translateX(3px); }
        @media (prefers-reduced-motion: reduce) {
          .portal-guidance-link .pgl-spin,
          .portal-guidance-link .pgl-glide { transition: none; }
        }
      `}</style>
    </main>
  );
}
