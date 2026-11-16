"use client";

// /dev/compose-spacing — PREVIEW for critique #300 (email composer line spacing).
// Two live editors seeded with identical content. "Before" = the old rules
// (10px paragraph gap, no fixed Enter behaviour). "After" = the shipped fix
// (16px gap matching the sent email + Enter always makes a paragraph). Click into
// each, press Enter a few times and type: the left mixes gap sizes, the right is
// uniform. Mock only; the real fix lives in ComposeEmailModal / ChaseComposer.

import { useRef, useState } from "react";
import { notFound } from "next/navigation";

// A realistic seeded body, same shape the real composer builds: greeting, blank
// lines to type into, a sign-off and a two-line signature.
const SEED = `<p>Hi James,</p><p><br></p><p><br></p><p>Thanks for your patience on this.</p><p>Kind regards,</p><p>Ellis</p>`;

export default function ComposeSpacingPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const dark = theme === "dark";

  function reseed() {
    if (beforeRef.current) beforeRef.current.innerHTML = SEED;
    if (afterRef.current) afterRef.current.innerHTML = SEED;
  }

  return (
    <div className={`csr ${dark ? "t-dark" : "t-light"}`} data-theme={theme}>
      <style>{CSS}</style>
      <div className="wrap">
        <header>
          <h1>Email composer &mdash; line spacing</h1>
          <p>
            Critique #300. Click into each box, press Enter a few times and type a few lines. The <b>Before</b> box
            mixes gap sizes (some wide, some tight); the <b>After</b> box is uniform and matches what actually sends.
          </p>
        </header>

        <div className="ctrls">
          <div className="seg">
            <button className={!dark ? "on" : ""} onClick={() => setTheme("light")}>Light</button>
            <button className={dark ? "on" : ""} onClick={() => setTheme("dark")}>Dark</button>
          </div>
          <button className="reseed" onClick={reseed}>Reset text</button>
        </div>

        <div className="cols">
          <section>
            <div className="lbl lbl--before">Before</div>
            <div
              ref={beforeRef}
              className="ed ed-before"
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: SEED }}
            />
            <p className="note">Paragraphs 10px; a line from Enter/paste can land with no gap &rarr; uneven.</p>
          </section>

          <section>
            <div className="lbl lbl--after">After</div>
            <div
              ref={afterRef}
              className="ed ed-after"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* unsupported */ } }}
              dangerouslySetInnerHTML={{ __html: SEED }}
            />
            <p className="note">Every paragraph 16px (matches the sent email); Enter always makes a paragraph.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.csr { min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; transition: background 180ms ease, color 180ms ease; }
.t-light { --bg:#F3EEE6; --card:#fff; --txt:#2A2320; --txt2:#5C544C; --mut:#8A8178; --line:rgba(45,24,16,0.12); --coral:#F04E2C; background: var(--bg); color: var(--txt); }
.t-dark { --bg:#0e131a; --card:#1a2029; --txt:#e8edf3; --txt2:#b4bcc8; --mut:#8a93a1; --line:rgba(255,255,255,0.13); --coral:#FF6B4A; background: var(--bg); color: var(--txt); }
.wrap { max-width: 860px; margin: 0 auto; padding: 40px 20px 100px; }
header h1 { font-size: 22px; font-weight: 650; letter-spacing: -0.02em; margin: 0 0 8px; }
header p { font-size: 13.5px; line-height: 1.55; color: var(--txt2); margin: 0 0 20px; max-width: 70ch; }
.ctrls { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.seg { display: inline-flex; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 3px; gap: 2px; }
.seg button { appearance: none; border: none; background: none; font: inherit; font-size: 12.5px; font-weight: 550; color: var(--txt2); padding: 6px 13px; border-radius: 7px; cursor: pointer; }
.seg button.on { background: rgba(240,78,44,0.14); color: var(--coral); }
.reseed { appearance: none; border: 1px solid var(--line); background: var(--card); color: var(--txt2); font: inherit; font-size: 12.5px; font-weight: 550; padding: 7px 13px; border-radius: 9px; cursor: pointer; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
.lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 2px 8px; }
.lbl--before { color: var(--mut); }
.lbl--after { color: var(--coral); }
.ed { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 13px 14px; font-size: 13px; line-height: 1.6; color: var(--txt); outline: none; min-height: 220px; }
.ed:focus { border-color: var(--coral); }
/* Before: old rules — only <p> gets a small gap; <div>/<br> lines get none. */
.ed-before p { margin: 0 0 10px; }
/* After: shipped rules — 16px to match the sent email, no trailing gap. */
.ed-after p { margin: 0 0 16px; }
.ed-after p:last-child { margin-bottom: 0; }
.note { font-size: 11.5px; color: var(--mut); line-height: 1.45; margin: 9px 2px 0; }
`;
