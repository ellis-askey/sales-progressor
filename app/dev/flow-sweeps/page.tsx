"use client";

// /dev/flow-sweeps — feel the proposed "keep things moving" journeys (critique
// #2). Press Save / Confirm in each scene and you're swept to the natural next
// thing instead of being stranded.
//
// Scene 1 is the REAL production component (AppColourStudio) with the proposed
// Save-advances behaviour switched on via a new default-off prop — so pressing
// "Save & next" carries you through the real studio byte for byte. Scenes 2–7
// are faithful interactive prototypes of the same pattern; the production build
// wires the real components the same way. Nothing here writes to the database.

import { useState, useRef, type ReactNode } from "react";
import { AppColourStudio } from "@/components/account/v2/AppColourStudio";

const C = {
  page: "#eceef1", card: "#ffffff", ink: "#1A1D29", sub: "#4A5162", mut: "#8B91A3",
  line: "#E5E8EC", accent: "#FF6B4A", accentInk: "#CC4A2E", accentBg: "rgba(255,107,74,0.10)",
  good: "#1B7A3D", goodBg: "#E7F6EC", red: "#B4342B", redBg: "#FDECEC",
};

function Scene({ n, title, today, children }: { n: number; title: string; today: string; children: ReactNode }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", gap: 13 }}>
        <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: C.ink, color: "#fff", fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 720, color: C.ink, letterSpacing: -0.01 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: C.red, marginTop: 3 }}><b style={{ fontWeight: 700 }}>Today:</b> {today}</div>
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function Pill({ tone, children }: { tone: "good" | "accent" | "mut"; children: ReactNode }) {
  const m = { good: [C.good, C.goodBg], accent: [C.accentInk, C.accentBg], mut: [C.mut, "#F1F3F6"] }[tone];
  return <span style={{ fontSize: 11, fontWeight: 700, color: m[0], background: m[1], borderRadius: 999, padding: "3px 9px" }}>{children}</span>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: C.mut, marginBottom: 5 }}>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "9px 11px", border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink, outline: "none" }} />
    </label>
  );
}

function Btn({ onClick, children, kind = "primary", disabled }: { onClick?: () => void; children: ReactNode; kind?: "primary" | "ghost"; disabled?: boolean }) {
  const primary = kind === "primary";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontSize: 13.5, fontWeight: 650, padding: "9px 16px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
      border: primary ? "none" : `1px solid ${C.line}`, color: primary ? "#fff" : C.sub,
      background: primary ? (disabled ? "#D8C3BC" : C.accent) : "#fff", opacity: disabled ? 0.7 : 1, transition: "filter .14s",
    }}>{children}</button>
  );
}

// ── 2. Client emails — Save & next through the ordered set ───────────────────
function EmailsScene() {
  const emails = ["Welcome update", "Weekly chase", "Completion pack"];
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState("Hi {firstName}, a quick update on your move…");
  if (done) return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <Pill tone="good">All three emails saved ✓</Pill>
      <div style={{ marginTop: 12 }}><Btn kind="ghost" onClick={() => { setDone(false); setI(0); }}>Replay</Btn></div>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
        {emails.map((e, idx) => (
          <span key={e} style={{ fontSize: 12, fontWeight: 650, padding: "6px 11px", borderRadius: 8, color: idx === i ? "#fff" : idx < i ? C.good : C.mut, background: idx === i ? C.accent : idx < i ? C.goodBg : "#F1F3F6" }}>{idx < i ? "✓ " : ""}{e}</span>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{emails[i]}</div>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: 13.5, padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink, outline: "none", resize: "vertical", lineHeight: 1.5 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <Btn onClick={() => { if (i < emails.length - 1) { setI(i + 1); setDraft("Hi {firstName}, …"); } else setDone(true); }}>
          {i < emails.length - 1 ? "Save & next email →" : "Save & finish"}
        </Btn>
      </div>
    </div>
  );
}

// ── 3. Team invite — keep the form open, "add another" ───────────────────────
function TeamScene() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Negotiator");
  const [sent, setSent] = useState<{ name: string; role: string }[]>([]);
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", maxWidth: 520 }}>
      {sent.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {sent.map((s, k) => <Pill key={k} tone="good">✓ {s.name} — {s.role}</Pill>)}
        </div>
      )}
      <div style={{ display: "grid", gap: 11 }}>
        <Field label="Name" value={name} onChange={setName} placeholder="Jane Smith" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="jane@agency.co.uk" />
        <label>
          <span style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: C.mut, marginBottom: 5 }}>Role</span>
          <div style={{ display: "flex", gap: 7 }}>
            {["Director", "Negotiator"].map((r) => (
              <button key={r} onClick={() => setRole(r)} style={{ fontSize: 13, fontWeight: 650, padding: "8px 13px", borderRadius: 9, cursor: "pointer", border: `1px solid ${role === r ? C.accent : C.line}`, color: role === r ? C.accentInk : C.sub, background: role === r ? C.accentBg : "#fff" }}>{r}</button>
            ))}
          </div>
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Btn disabled={!name || !email} onClick={() => { setSent([...sent, { name, role }]); setName(""); setEmail(""); }}>Send invitation</Btn>
        {sent.length > 0 && <span style={{ fontSize: 12.5, color: C.good, fontWeight: 650 }}>Invited ✓ — the form stays, role kept. Add another.</span>}
      </div>
    </div>
  );
}

// ── 4. Add client — Save without a fee sweeps you to set it ───────────────────
function ClientScene() {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [stage, setStage] = useState<"form" | "needFee" | "ready">("form");
  const [setFeeVal, setSetFeeVal] = useState("");
  if (stage === "needFee") return (
    <div style={{ maxWidth: 460 }}>
      <Pill tone="good">Client &ldquo;{name}&rdquo; added, invite sent</Pill>
      <div style={{ marginTop: 14, padding: 16, background: "#FFF8F6", border: `1px solid ${C.accentBg}`, borderRadius: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>One more thing before you can add their first sale</div>
        <div style={{ fontSize: 12.5, color: C.sub, margin: "4px 0 12px" }}>A fee is needed before adding a sale. Set it now and you&rsquo;re ready to go.</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: "0 0 150px" }}><Field label="Fee per sale (£)" value={setFeeVal} onChange={setSetFeeVal} placeholder="50" /></div>
          <Btn disabled={!setFeeVal} onClick={() => setStage("ready")}>Save fee</Btn>
        </div>
      </div>
    </div>
  );
  if (stage === "ready") return (
    <div style={{ maxWidth: 460, textAlign: "center" }}>
      <Pill tone="good">Fee set ✓ — ready to add sales</Pill>
      <div style={{ marginTop: 14 }}><Btn onClick={() => { setStage("form"); setName(""); setFee(""); setSetFeeVal(""); }}>Add a sale for {name} →</Btn></div>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 11, maxWidth: 460 }}>
      <Field label="Client agency name" value={name} onChange={setName} placeholder="Akeman Residential" />
      <Field label="Fee per sale (£) — optional" value={fee} onChange={setFee} placeholder="leave blank to see the sweep" />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn disabled={!name} onClick={() => setStage(fee ? "ready" : "needFee")}>Add client</Btn>
      </div>
    </div>
  );
}

// ── 5. Confirm a step — the next step rises to you ───────────────────────────
function StepsScene() {
  const steps = ["ID & AML checks", "Draft contract pack issued", "Enquiries raised", "Enquiries satisfied", "Contracts exchanged"];
  const [edge, setEdge] = useState(0);
  const liveRef = useRef<HTMLDivElement>(null);
  return (
    <div style={{ maxWidth: 480, display: "grid", gap: 8 }}>
      {steps.map((s, idx) => {
        const done = idx < edge, live = idx === edge, locked = idx > edge;
        return (
          <div key={s} ref={live ? liveRef : null} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderRadius: 11, border: `1px solid ${live ? C.accent : C.line}`, background: live ? "#FFF8F6" : done ? C.goodBg : "#fff", opacity: locked ? 0.55 : 1, transition: "all .25s" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "#fff", background: done ? C.good : live ? C.accent : "#C9CED6" }}>{done ? "✓" : idx + 1}</span>
            <span style={{ fontSize: 13.5, fontWeight: live ? 700 : 600, color: done ? C.good : live ? C.ink : C.mut, flex: 1 }}>{s}</span>
            {live && (
              <Btn onClick={() => { const n = Math.min(edge + 1, steps.length); setEdge(n); setTimeout(() => liveRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }}>
                {idx === steps.length - 1 ? "Confirm" : "Confirm & next →"}
              </Btn>
            )}
          </div>
        );
      })}
      {edge >= steps.length && <div style={{ textAlign: "center", marginTop: 4 }}><Pill tone="good">All steps confirmed ✓</Pill> <Btn kind="ghost" onClick={() => setEdge(0)}>Replay</Btn></div>}
    </div>
  );
}

// ── 6. Finish a file — Next file rises ───────────────────────────────────────
function FileScene() {
  const [tasks, setTasks] = useState([{ t: "Chase seller's solicitor", done: false }, { t: "Confirm searches received", done: false }]);
  const left = tasks.filter((x) => !x.done).length;
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>24 Emerton Garth</div>
      <div style={{ fontSize: 12, color: C.mut, marginBottom: 12 }}>From your work queue · file 3 of 11</div>
      <div style={{ display: "grid", gap: 8 }}>
        {tasks.map((x, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", border: `1px solid ${C.line}`, borderRadius: 10, background: x.done ? C.goodBg : "#fff" }}>
            <span style={{ fontSize: 13.5, color: x.done ? C.good : C.ink, textDecoration: x.done ? "line-through" : "none", flex: 1 }}>{x.t}</span>
            {!x.done && <Btn kind="ghost" onClick={() => setTasks(tasks.map((y, j) => j === idx ? { ...y, done: true } : y))}>Mark done</Btn>}
          </div>
        ))}
      </div>
      {left === 0 && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", background: C.ink, borderRadius: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>This file&rsquo;s done. Next in your queue:</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>8 Chapel Lane</div>
          </div>
          <Btn onClick={() => setTasks(tasks.map((y) => ({ ...y, done: false })))}>Next file →</Btn>
        </div>
      )}
    </div>
  );
}

// ── 7. Confirm exchange — carry to completion ────────────────────────────────
function ExchangeScene() {
  const [celebrating, setCelebrating] = useState(false);
  const [doneStage, setDoneStage] = useState(false);
  if (doneStage) return <div style={{ textAlign: "center" }}><Pill tone="good">Completion date step opened ✓</Pill> <Btn kind="ghost" onClick={() => { setDoneStage(false); setCelebrating(false); }}>Replay</Btn></div>;
  if (celebrating) return (
    <div style={{ maxWidth: 420, textAlign: "center", padding: "22px 20px", background: "linear-gradient(135deg,#FFF3EC,#FFF8F6)", border: `1px solid ${C.accentBg}`, borderRadius: 16 }}>
      <div style={{ fontSize: 30 }}>🎉</div>
      <div style={{ fontSize: 16, fontWeight: 740, color: C.ink, margin: "6px 0 3px" }}>Contracts exchanged</div>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>The sale is legally committed. Next: lock in the completion date.</div>
      <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
        <Btn onClick={() => setDoneStage(true)}>Add completion date →</Btn>
        <Btn kind="ghost" onClick={() => setCelebrating(false)}>Later</Btn>
      </div>
    </div>
  );
  return <Btn onClick={() => setCelebrating(true)}>Confirm exchange</Btn>;
}

export default function FlowSweepsPage() {
  return (
    <div style={{ minHeight: "100vh", background: C.page, padding: "0 0 90px" }}>
      <div style={{ background: "#fff", borderBottom: `1px solid ${C.line}`, padding: "22px 28px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ fontSize: 20, fontWeight: 760, color: C.ink, letterSpacing: -0.02 }}>Keep things moving — feel the journeys</div>
          <p style={{ fontSize: 13.5, color: C.sub, margin: "7px 0 0", lineHeight: 1.55 }}>
            Press <b>Save</b> / <b>Confirm</b> in each scene and you&rsquo;re carried to the natural next thing instead of being stranded. <b>Scene 1 is the real production colour studio</b> with the proposed &ldquo;Save sweeps you on&rdquo; behaviour switched on (nothing is saved to your account). Scenes 2–7 are faithful prototypes of the same pattern — the production build wires the real components the same way.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "26px 28px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        <Scene n={1} title="Your app colour — the real studio (your example)" today="Save greys out and leaves you on step 1; the button-designer steps you were meant to walk through are never entered.">
          <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14 }}>This is the exact production component. Pick a colour, press <b>Save &amp; next</b> — it carries you Colours → Primary button → Secondary.</div>
          <AppColourStudio advanceOnSave onSave={async () => { await new Promise((r) => setTimeout(r, 350)); }} />
        </Scene>

        <Scene n={2} title="Customising your client emails" today="Each save just toasts; you stay put on one editor and have to hunt for the next, so the rest get left on default.">
          <EmailsScene />
        </Scene>

        <Scene n={3} title="Inviting your team" today="The form slams shut after every send; to add the next person you reopen it and re-pick the role each time.">
          <TeamScene />
        </Scene>

        <Scene n={4} title="Adding a client" today="You land back on the list, silently in a can't-add-a-sale state (a fee is required first), with nothing pointing you to fix it.">
          <ClientScene />
        </Scene>

        <Scene n={5} title="Confirming a step on a file" today="The step collapses in place; a freshly-unlocked next step below the fold gets no handoff — you re-scan the file every time.">
          <StepsScene />
        </Scene>

        <Scene n={6} title="Finishing a file" today="You're stranded on the file; the queue you came from is only a back link, so you navigate back and re-find your place by hand.">
          <FileScene />
        </Scene>

        <Scene n={7} title="Confirming exchange" today="The celebration drops you back to the step list to hunt for the completion step, even though the file already worked out that's next.">
          <ExchangeScene />
        </Scene>
      </div>
    </div>
  );
}
