"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { P } from "@/components/portal/portal-ui";
import { usePortalPick } from "@/lib/glass/portal-context";
import { classFor } from "@/lib/glass/variants";

type State = "idle" | "open" | "loading" | "result" | "error";

// The API always answers in these four fixed sections (see the system prompt in
// app/api/portal/explain-email/route.ts). We parse them out so each renders in
// its own style — the summary reads calmly, the to-dos stand out, dates become
// a chip, and the flag only draws the eye when there's something in it.
const SECTION_DEFS = [
  { key: "saying", label: "What they're saying" },
  { key: "todo",   label: "What you need to do" },
  { key: "dates",  label: "Deadlines or dates" },
  { key: "flag",   label: "Worth flagging" },
] as const;

type SectionKey = (typeof SECTION_DEFS)[number]["key"];

// The sentinel phrases the prompt uses for an empty section — rendered quietly.
function isEmptySection(text: string): boolean {
  return /^(nothing right now|none mentioned|nothing unusual)\.?$/i.test(text.trim());
}

function parseExplanation(raw: string): Record<SectionKey, string> | null {
  const md = raw.replace(/[’]/g, "'"); // normalise curly apostrophes
  const hits = SECTION_DEFS
    .map((d) => ({ key: d.key, label: d.label, idx: md.indexOf(d.label) }))
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (hits.length < 2) return null; // not the expected shape — fall back to markdown

  const out = {} as Record<SectionKey, string>;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    // Skip the label and any trailing ":" / "**" markers before the content.
    let start = h.idx + h.label.length;
    const lead = md.slice(start).match(/^\s*:?\s*\*{0,2}\s*/);
    if (lead) start += lead[0].length;
    const end = i + 1 < hits.length ? hits[i + 1].idx : md.length;
    // Trim the trailing "**" that opens the next label.
    const content = md.slice(start, end).replace(/\s*\*+\s*$/, "").trim();
    out[h.key] = content;
  }
  return out;
}

function toLines(text: string): { bullets: string[]; paras: string[] } {
  const bullets: string[] = [];
  const paras: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^[-*•]\s+(.*)$/);
    if (m) bullets.push(m[1].trim());
    else paras.push(line.replace(/^\*+|\*+$/g, "").trim());
  }
  return { bullets, paras };
}

function SectionIcon({ kind }: { kind: SectionKey }) {
  const common = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "saying") return <svg {...common}><path d="M4 4h16v12H8l-4 4z" /></svg>;
  if (kind === "todo") return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
  if (kind === "dates") return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
  return <svg {...common}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>;
}

const AMBER = "#a86212";
const AMBER_BG = "#fdf8ee";
const AMBER_TEXT = "#7a5a1e";

export function ExplainEmailCard({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const glassPick = usePortalPick("explain-email");
  const [emailBody, setEmailBody] = useState("");
  const [explanation, setExplanation] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    if (emailBody.trim().length < 20) return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/portal/explain-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, emailBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setExplanation(data.explanation);
      setState("result");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  function handleReset() {
    setState("open");
    setEmailBody("");
    setExplanation("");
    setErrorMsg("");
  }

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("open")}
        className={glassPick ? classFor(glassPick) : undefined}
        data-glass-id="explain-email"
        data-glass-label="Explain a solicitor email"
        data-glass-variant={glassPick ?? "v00"}
        style={{
          width: "100%",
          ...(glassPick
            ? { borderRadius: P.radiusLg }
            : {
                background: `linear-gradient(180deg, ${P.primaryBg}, ${P.cardBg})`,
                border: `1px solid ${P.primaryBg}`,
                borderRadius: P.radiusLg,
                boxShadow: P.shadowSm,
              }),
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: P.radiusSm,
            background: P.primary,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary, lineHeight: 1.3 }}>
            Confused by an email from your solicitor?
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: P.textMuted, lineHeight: 1.4 }}>
            Paste it in and we&apos;ll break it down into what it means and what to do.
          </p>
        </span>
      </button>
    );
  }

  if (state === "result") {
    const parsed = parseExplanation(explanation);

    return (
      <div style={{ background: P.cardBg, borderRadius: P.radiusLg, overflow: "hidden", boxShadow: P.shadowSm }}>
        <div style={{ padding: "15px 20px", borderBottom: `1px solid ${P.border}` }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.textPrimary }}>Here&apos;s what this means</p>
        </div>

        {parsed ? (
          <div>
            {SECTION_DEFS.map((def) => {
              const content = parsed[def.key];
              if (content === undefined) return null;
              const empty = isEmptySection(content);
              const { bullets, paras } = toLines(content);

              // Per-section colour treatment. Empty sections stay quiet.
              const isTodo = def.key === "todo" && !empty;
              const isDates = def.key === "dates" && !empty;
              const isFlag = def.key === "flag" && !empty;

              const labelColor = empty
                ? P.textMuted
                : def.key === "todo"
                  ? P.primary
                  : def.key === "flag"
                    ? AMBER
                    : def.key === "dates"
                      ? P.accent
                      : P.textSecondary;
              const iconBg = empty
                ? P.pageBg
                : def.key === "todo"
                  ? P.primary
                  : def.key === "flag"
                    ? AMBER
                    : P.accentBg;
              const iconColor = empty
                ? P.textMuted
                : def.key === "todo" || def.key === "flag"
                  ? "#fff"
                  : P.accent;
              const sectionBg = isTodo ? P.primaryBg : isFlag ? AMBER_BG : "transparent";

              return (
                <div key={def.key} style={{ padding: "14px 20px", borderTop: `1px solid ${P.border}`, background: sectionBg }}>
                  <p style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: labelColor }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: iconBg, color: iconColor, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <SectionIcon kind={def.key} />
                    </span>
                    {def.label}
                  </p>

                  {empty ? (
                    <p style={{ margin: 0, fontSize: 13.5, color: P.textMuted, lineHeight: 1.55 }}>{content}</p>
                  ) : isTodo ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(bullets.length ? bullets : paras).map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: P.textPrimary, lineHeight: 1.5 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.6px solid ${P.primary}`, flexShrink: 0, marginTop: 1 }} />
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  ) : isDates ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: P.accentBg, color: P.accent, fontWeight: 600, fontSize: 12.5, padding: "5px 11px", borderRadius: 999 }}>
                      {bullets.length ? bullets.join(" · ") : paras.join(" ")}
                    </span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {paras.map((t, i) => (
                        <p key={`p${i}`} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: isFlag ? AMBER_TEXT : P.textSecondary }}>{t}</p>
                      ))}
                      {bullets.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {bullets.map((t, i) => (
                            <div key={`b${i}`} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.55, color: isFlag ? AMBER_TEXT : P.textSecondary }}>
                              <span style={{ color: isFlag ? AMBER : P.primary, fontWeight: 700, flexShrink: 0 }}>–</span>
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Fallback: the response wasn't in the expected four-section shape.
          <div style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: P.textSecondary }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.65, color: P.textSecondary }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ fontWeight: 700, color: P.textPrimary }}>{children}</strong>,
                  ul: ({ children }) => <ul style={{ margin: "4px 0 10px", padding: 0, listStyle: "none" }}>{children}</ul>,
                  li: ({ children }) => (
                    <li style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
                      <span style={{ color: P.primary, fontWeight: 700, flexShrink: 0, lineHeight: 1.65 }}>–</span>
                      <span>{children}</span>
                    </li>
                  ),
                }}
              >
                {explanation}
              </ReactMarkdown>
            </div>
          </div>
        )}

        <div style={{ padding: "12px 20px 16px" }}>
          <div
            style={{
              padding: "10px 14px",
              background: P.accentBg,
              borderRadius: P.radiusSm,
              fontSize: 12,
              color: P.textMuted,
              lineHeight: 1.5,
            }}
          >
            This is a plain-English summary. Always rely on your solicitor for legal advice.
          </div>
          <button
            onClick={handleReset}
            style={{
              marginTop: 14,
              padding: "8px 16px",
              borderRadius: P.radiusSm,
              background: "transparent",
              border: `1px solid ${P.border}`,
              fontSize: 13,
              color: P.textMuted,
              cursor: "pointer",
            }}
          >
            Explain another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: P.cardBg, borderRadius: P.radiusLg, overflow: "hidden", boxShadow: P.shadowSm }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: `1px solid ${P.border}`,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.textPrimary }}>Explain a solicitor email</p>
        <button
          onClick={() => setState("idle")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: P.textMuted,
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: P.textSecondary, lineHeight: 1.5 }}>
          Paste the email from your solicitor below. We&apos;ll explain what they&apos;re saying in simple terms.
        </p>
        <textarea
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          placeholder="Paste solicitor email here…"
          rows={6}
          disabled={state === "loading"}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            borderRadius: P.radiusSm,
            border: `1px solid ${P.border}`,
            background: P.pageBg,
            fontSize: 13,
            lineHeight: 1.55,
            color: P.textPrimary,
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            opacity: state === "loading" ? 0.6 : 1,
          }}
        />
        {state === "error" && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#ef4444" }}>{errorMsg}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={state === "loading" || emailBody.trim().length < 20}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "11px 0",
            borderRadius: P.radiusSm,
            background:
              state === "loading" || emailBody.trim().length < 20
                ? "#E5E7EB"
                : P.primary,
            color:
              state === "loading" || emailBody.trim().length < 20
                ? P.textMuted
                : "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: state === "loading" || emailBody.trim().length < 20 ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {state === "loading" ? "Explaining…" : "Explain this email"}
        </button>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: P.textMuted, textAlign: "center", lineHeight: 1.4 }}>
          Your email text is not stored. We only log that you used this feature.
        </p>
      </div>
    </div>
  );
}
