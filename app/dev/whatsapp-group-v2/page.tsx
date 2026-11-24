"use client";

// /dev/whatsapp-group-v2 — proposed redesign of the "Set up WhatsApp group"
// drawer. Goal: make the logic self-evident and un-scary — you create the group
// in WhatsApp, clients join by a link you send them one at a time, nothing fires
// automatically. Two models to compare: per-side groups (seller / buyer kept
// apart) vs one group for the whole sale. Light + dark. Fully interactive mock,
// no backend.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

// ── Mock data ──────────────────────────────────────────────────────────────
const ADDRESS = "5 The Crescent";
type Person = { id: string; name: string; phone: string; side: "seller" | "buyer" };
const PEOPLE: Person[] = [
  { id: "p1", name: "Mrs Williams", phone: "+44 7989 961298", side: "seller" },
  { id: "p2", name: "Mrs Castle", phone: "+44 7958 053575", side: "buyer" },
  { id: "p3", name: "Mr Todd", phone: "+44 7905 050153", side: "buyer" },
];
const SAMPLE_LINK = "https://chat.whatsapp.com/L59BgnkX8iElwNRJbB4saM";

type Model = "per-side" | "one-group";
type Side = "seller" | "buyer";
type Stage = "create" | "invite";

// ── Inline glyphs (self-contained — no icon imports in /dev) ────────────────
function WaGlyph({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color} aria-hidden>
      <path d="M128 24a104 104 0 0 0-91 154L25 220a8 8 0 0 0 10 10l42-12A104 104 0 1 0 128 24Zm0 192a88 88 0 0 1-44-12 8 8 0 0 0-6-1l-32 9 9-32a8 8 0 0 0-1-6 88 88 0 1 1 74 42Zm49-62c-3-2-17-9-20-10s-5-1-6 2-7 9-9 11-3 2-6 1a72 72 0 0 1-21-13 79 79 0 0 1-15-18c-1-3 0-4 1-6l4-5a19 19 0 0 0 3-5 5 5 0 0 0 0-5c0-1-6-16-9-22s-5-5-6-5h-6a11 11 0 0 0-8 4 33 33 0 0 0-10 25c0 15 11 29 12 31s21 34 53 47a177 177 0 0 0 18 7 42 42 0 0 0 19 1c6-1 17-7 20-14s3-13 2-14-2-2-5-4Z" />
    </svg>
  );
}
function UserGlyph({ size = 17, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color} aria-hidden>
      <path d="M128 24a56 56 0 1 0 56 56 56 56 0 0 0-56-56Zm0 96a40 40 0 1 1 40-40 40 40 0 0 1-40 40Zm96 104a8 8 0 0 1-14 0 72 72 0 0 0-124 0 8 8 0 0 1-14-8 88 88 0 0 1 152 0 8 8 0 0 1 0 8Z" />
    </svg>
  );
}
function CheckGlyph({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color} aria-hidden>
      <path d="M232 56 104 184a8 8 0 0 1-11 0l-56-56a8 8 0 0 1 11-11l50 50L221 45a8 8 0 0 1 11 11Z" />
    </svg>
  );
}
function CopyGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <path d="M216 32H88a8 8 0 0 0-8 8v40H40a8 8 0 0 0-8 8v128a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8v-40h40a8 8 0 0 0 8-8V40a8 8 0 0 0-8-8Zm-56 176H48V96h112Zm48-48h-32V88a8 8 0 0 0-8-8H96V48h112Z" />
    </svg>
  );
}

// ── Small UI atoms ──────────────────────────────────────────────────────────
function firstName(name: string): string {
  return name.trim().split(/\s+/).filter((w) => !/^(mr|mrs|ms|miss|mx|dr)\.?$/i.test(w))[0] ?? name;
}

function StepCircle({ n, done }: { n: number; done?: boolean }) {
  return (
    <span style={{
      width: 30, height: 30, borderRadius: 999, flexShrink: 0,
      border: `1.5px solid ${done ? "var(--agent-success)" : "var(--agent-coral)"}`,
      color: done ? "var(--agent-success)" : "var(--agent-coral-deep)",
      background: done ? "rgba(var(--agent-success-rgb),0.12)" : "var(--agent-coral-bg-tint)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700,
    }}>
      {done ? <CheckGlyph size={15} /> : n}
    </span>
  );
}

function CopyBtn({ label = "Copy" }: { label?: string }) {
  const [hit, setHit] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { setHit(true); setTimeout(() => setHit(false), 1200); }}
      className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
    >
      {hit ? <CheckGlyph /> : <CopyGlyph />} {hit ? "Copied" : label}
    </button>
  );
}

// ── Person row (invite stage) ───────────────────────────────────────────────
function InviteRow({ person, invited, onInvite }: { person: Person; invited: boolean; onInvite: () => void }) {
  const tint = person.side === "seller"
    ? { bg: "rgba(var(--agent-coral-rgb),0.12)", fg: "var(--agent-coral-deep)" }
    : { bg: "rgba(59,130,246,0.14)", fg: "#2f74e0" };
  const role = person.side === "seller" ? "Seller" : "Buyer";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 12px",
      borderRadius: 12, border: "0.5px solid var(--agent-border-default)",
      background: "var(--agent-surface-elevated)",
    }}>
      <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: tint.bg, color: tint.fg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <UserGlyph />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{person.name}</span>
          <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>· {role}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 1 }}>
          {invited
            ? <span style={{ color: "var(--agent-success)", fontWeight: 600 }}>Invite opened in WhatsApp · you still press send</span>
            : <>Opens WhatsApp to {firstName(person.name)} with the join link</>}
        </div>
      </div>
      {invited ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--agent-success)" }}>
            <CheckGlyph size={13} /> Invited
          </span>
          <button type="button" onClick={onInvite} className="agent-link" style={{ fontSize: 12 }}>Resend</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onInvite}
          className="agent-btn agent-btn-sm"
          style={{ background: "#25D366", color: "#fff", borderColor: "#25D366", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, fontWeight: 600 }}
        >
          <WaGlyph size={14} color="#fff" /> Send invite
        </button>
      )}
    </div>
  );
}

// ── The drawer ───────────────────────────────────────────────────────────────
function Drawer({ model, side, stage, setSide, setStage }: {
  model: Model; side: Side; stage: Stage;
  setSide: (s: Side) => void; setStage: (s: Stage) => void;
}) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [link, setLink] = useState("");

  const title = model === "one-group"
    ? "Set up the WhatsApp group for this sale"
    : side === "seller" ? "Set up the seller's WhatsApp group" : "Set up the buyer's WhatsApp group";

  // Who this group's invite list covers.
  const listed = model === "one-group" ? PEOPLE : PEOPLE.filter((p) => p.side === side);
  const sideWord = model === "one-group" ? "everyone on this sale" : side === "seller" ? "the seller" : "the buyer";
  const groupName = model === "one-group"
    ? `Sale of ${ADDRESS}`
    : `${side === "seller" ? "Sale" : "Purchase"} of ${ADDRESS}`;

  function toggleInvite(id: string) {
    setInvited((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const invitedCount = listed.filter((p) => invited.has(p.id)).length;

  return (
    <div style={{
      width: "min(560px, 100%)", borderRadius: 18, overflow: "hidden",
      background: "var(--agent-surface-elevated)",
      border: "0.5px solid var(--agent-border-default)",
      boxShadow: "0 24px 60px -12px rgba(0,0,0,0.30)",
    }}>
      {/* Coral band header */}
      <div style={{ background: "linear-gradient(135deg, #ff6a3d 0%, #f5512e 100%)", padding: "18px 20px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#fff", flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
            <WaGlyph size={30} color="#fff" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>{ADDRESS}</div>
          </div>
          {model === "per-side" && (
            <button
              type="button"
              onClick={() => setSide(side === "seller" ? "buyer" : "seller")}
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.22)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {side === "seller" ? "Seller group" : "Buyer group"} · switch
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "60vh", overflowY: "auto" }}>
        {stage === "create" ? (
          <>
            {/* How-it-works framing */}
            <div style={{ display: "flex", gap: 11, padding: "12px 14px", borderRadius: 12, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)" }}>
              <span style={{ color: "var(--agent-coral-deep)", flexShrink: 0, marginTop: 1 }}><WaGlyph size={18} /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
                <strong style={{ color: "var(--agent-text-primary)" }}>How this works.</strong> You make the group in WhatsApp — it starts with just you. {sideWord === "everyone on this sale" ? "Your clients" : sideWord[0].toUpperCase() + sideWord.slice(1)} joins by tapping a link you send them, one at a time. Nothing is created or sent until you do it yourself.
              </p>
            </div>

            <Step n={1} title="Name the group">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input readOnly value={groupName} className="agent-input" style={{ flex: 1, height: 40, fontSize: 13, border: "0.5px solid var(--agent-border-default)" }} />
                <CopyBtn />
              </div>
            </Step>

            <Step n={2} title="Create it in WhatsApp">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5, flex: 1, minWidth: 180 }}>
                  Make a new group with just you in it. You&rsquo;ll bring clients in with a link next — no need to add their numbers.
                </p>
                <button type="button" className="agent-btn agent-btn-sm" style={{ background: "#fff", color: "#1FA855", border: "1.5px solid #25D366", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, flexShrink: 0 }}>
                  <WaGlyph size={15} color="#25D366" /> Open WhatsApp
                </button>
              </div>
            </Step>

            <Step n={3} title="Paste the group's invite link" last>
              <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                In WhatsApp: tap the group name → <strong style={{ color: "var(--agent-text-secondary)" }}>Invite to group via link</strong> → Copy link. Paste it here so this sale knows which chat is which.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/…" className="agent-input" style={{ flex: 1, height: 40, fontSize: 13 }} />
                <button type="button" onClick={() => setStage("invite")} disabled={!link.trim()} className="agent-btn agent-btn-sm agent-btn-primary" style={{ flexShrink: 0 }}>Save</button>
              </div>
              <button type="button" onClick={() => setStage("invite")} className="agent-link" style={{ fontSize: 11.5, marginTop: 8 }}>
                (prototype: skip to the invite step →)
              </button>
            </Step>
          </>
        ) : (
          <>
            {/* Saved group link */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--agent-text-muted)", marginBottom: 6 }}>Group set up</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "var(--agent-text-secondary)", textDecoration: "underline", wordBreak: "break-all" }}>{SAMPLE_LINK}</a>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <CopyBtn label="" />
                  <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Open</button>
                </div>
              </div>
            </div>

            {/* Reassurance banner — the fear-killer, built into structure */}
            <div style={{ display: "flex", gap: 10, padding: "11px 13px", borderRadius: 11, background: "rgba(37,211,102,0.08)", border: "0.5px solid rgba(37,211,102,0.3)" }}>
              <span style={{ color: "#1FA855", flexShrink: 0, marginTop: 1 }}><WaGlyph size={16} color="#1FA855" /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--agent-text-primary)" }}>Invites are sent individually.</strong> Select a client to open WhatsApp with their invitation ready to send. You&rsquo;ll need to press send yourself. Nothing is sent automatically, and clients won&rsquo;t be added to the group until they join using the link.
              </p>
            </div>

            {/* One-group confidentiality warning */}
            {model === "one-group" && (
              <div style={{ display: "flex", gap: 10, padding: "11px 13px", borderRadius: 11, background: "rgba(217,119,6,0.09)", border: "0.5px solid rgba(217,119,6,0.3)" }}>
                <span style={{ color: "#b45309", flexShrink: 0, fontSize: 15, lineHeight: 1 }}>⚠</span>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--agent-text-primary)" }}>Buyer and seller share this group.</strong> They&rsquo;ll see each other&rsquo;s names and phone numbers. Only invite both sides if you mean to.
                </p>
              </div>
            )}

            {/* Invite list */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--agent-text-muted)" }}>
                  Invite {model === "one-group" ? "everyone on this sale" : side === "seller" ? "the seller" : "the buyer"}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{invitedCount} of {listed.length} invited</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {listed.map((p) => (
                  <InviteRow key={p.id} person={p} invited={invited.has(p.id)} onInvite={() => toggleInvite(p.id)} />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setStage("create")} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Replace link</button>
              <button type="button" onClick={() => setStage("create")} className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ color: "var(--agent-danger)" }}>Remove link</button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 20px", borderTop: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--agent-text-muted)" }}>
          <svg width={15} height={15} viewBox="0 0 256 256" fill="currentColor" aria-hidden><path d="M208 40H48a16 16 0 0 0-16 16v58c0 90 76 120 92 125a16 16 0 0 0 10 0c16-5 92-35 92-125V56a16 16 0 0 0-16-16Zm-37 71-40 48a8 8 0 0 1-12 0l-24-28a8 8 0 0 1 12-10l18 21 34-41a8 8 0 0 1 12 10Z" /></svg>
          Only people with access to this sale can see this group.
        </span>
        <button type="button" className="agent-btn agent-btn-sm" style={{ background: "transparent", color: "var(--agent-coral-deep)", border: "1px solid var(--agent-coral)", fontWeight: 600 }}>Done</button>
      </div>
    </div>
  );
}

function Step({ n, title, last, children }: { n: number; title: string; last?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 13 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <StepCircle n={n} />
        {!last && <span aria-hidden style={{ flex: 1, borderLeft: "1.5px dashed var(--agent-coral)", opacity: 0.35, margin: "4px 0", minHeight: 14 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 6 }}>
        <h3 style={{ margin: "5px 0 10px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ── Showroom chrome ──────────────────────────────────────────────────────────
function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${active ? "var(--agent-coral)" : "var(--agent-border-default)"}`,
        background: active ? "var(--agent-coral-bg-tint)" : "var(--agent-surface-elevated)",
        color: active ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const [dark, setDark] = useState(false);
  const [model, setModel] = useState<Model>("per-side");
  const [side, setSide] = useState<Side>("seller");
  const [stage, setStage] = useState<Stage>("invite");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "custom";
    return () => { document.documentElement.dataset.theme = "custom"; };
  }, [dark]);

  return (
    <div style={{ minHeight: "100vh", padding: "32px 20px 80px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: "0 0 4px" }}>WhatsApp group drawer — redesign</h1>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
          Make the logic obvious and un-scary. Flip the controls to compare models and stages; the invite buttons toggle an <strong>Invited</strong> state so you can feel the one-at-a-time flow.
        </p>

        {/* Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "14px 16px", borderRadius: 12, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)", marginBottom: 22 }}>
          <ControlGroup label="Model">
            <SegBtn active={model === "per-side"} onClick={() => setModel("per-side")}>Separate groups (recommended)</SegBtn>
            <SegBtn active={model === "one-group"} onClick={() => setModel("one-group")}>One group for the sale</SegBtn>
          </ControlGroup>
          <ControlGroup label="Stage">
            <SegBtn active={stage === "create"} onClick={() => setStage("create")}>Create</SegBtn>
            <SegBtn active={stage === "invite"} onClick={() => setStage("invite")}>Invite</SegBtn>
          </ControlGroup>
          {model === "per-side" && (
            <ControlGroup label="Side">
              <SegBtn active={side === "seller"} onClick={() => setSide("seller")}>Seller</SegBtn>
              <SegBtn active={side === "buyer"} onClick={() => setSide("buyer")}>Buyer</SegBtn>
            </ControlGroup>
          )}
          <ControlGroup label="Theme">
            <SegBtn active={!dark} onClick={() => setDark(false)}>Light</SegBtn>
            <SegBtn active={dark} onClick={() => setDark(true)}>Dark</SegBtn>
          </ControlGroup>
        </div>

        {/* The drawer */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Drawer model={model} side={side} stage={stage} setSide={setSide} setStage={setStage} />
        </div>
      </div>
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agent-text-muted)" }}>{label}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
