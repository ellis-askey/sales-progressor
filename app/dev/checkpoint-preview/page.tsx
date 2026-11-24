"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE — "See what you're sending" for Checkpoints.
// Live-as-you-tick preview of exactly what the client will see in their portal
// ("Things to confirm"), so the agent never sends blind. Desktop stacks the
// preview cards bottom-right (cap 3 + "+N"); mobile shows a slim bottom bar that
// opens a sheet. Send (per-card + "Send all" per the party rule) → cards fade up
// and out → a final confirmation toast. Mock data + local state only.
//
// Strings are marked // STRING: for us to polish together.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";

// Portal-faithful palette (mirrors components/portal/portal-ui P + the real
// PortalThingsToConfirm card), so the preview reads true-to-inbox.
const P = {
  primary: "#F04E2C",
  primaryGrad: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)",
  cardBg: "#FFFDFB",
  pageBg: "#F6F1EA",
  border: "rgba(45,24,16,0.10)",
  textPrimary: "#2A2320",
  textSecondary: "#5C544C",
  textMuted: "#8A8178",
  success: "#2E9E6B",
  vendorDot: "#4F46E5",
  purchaserDot: "#BE185D",
};

type Side = "vendor" | "purchaser";
type Audience = "vendor" | "purchaser" | "both";

const CLIENTS: Record<Side, { name: string }[]> = {
  vendor: [{ name: "Helen Carter" }],
  purchaser: [{ name: "Tom Whitfield" }],
};

const PICKLIST = [
  "Probate granted",
  "Indemnity policy in place",
  "Signed transfer deed (TR1) returned",
  "Source of funds provided",
  "Buildings insurance arranged",
];

type Staged = { key: string; label: string; audience: Audience; leaving?: boolean };

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

function peopleFor(audience: Audience): { name: string; side: Side }[] {
  return [
    ...(audience === "vendor" || audience === "both" ? CLIENTS.vendor.map((c) => ({ name: c.name, side: "vendor" as const })) : []),
    ...(audience === "purchaser" || audience === "both" ? CLIENTS.purchaser.map((c) => ({ name: c.name, side: "purchaser" as const })) : []),
  ];
}

// "A", "A & B", "A, B & C"
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

// ── the portal-styled preview card (one checkpoint, as the client sees it) ──
function PreviewCard({ s, onSend, showSend }: { s: Staged; onSend?: () => void; showSend: boolean }) {
  return (
    <div
      className={`cpp-card${s.leaving ? " cpp-leaving" : ""}`}
      style={{ background: P.cardBg, border: `1px solid ${P.border}`, borderRadius: 16, boxShadow: "0 10px 30px rgba(30,20,12,0.14)", overflow: "hidden" }}
    >
      <div style={{ padding: "11px 14px 8px" }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: P.primary }}>
          {/* STRING: portal frame label */}Things to confirm
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 14px", borderTop: `1px solid ${P.border}` }}>
        <span style={{ flex: "none", marginTop: 1, width: 22, height: 22, borderRadius: "50%", background: "#fff", border: `2px solid ${P.primary}`, display: "grid", placeItems: "center" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: P.primary }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: P.textPrimary }}>{s.label}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: P.primary }}>
            {/* STRING */}Action needed from you
          </p>
        </div>
        {showSend && (
          <button
            onClick={onSend}
            style={{ flex: "none", padding: "7px 13px", borderRadius: 11, fontSize: 12.5, fontWeight: 700, color: "#fff", background: P.primaryGrad, border: "none", boxShadow: "0 1px 0 #C63E20, 0 3px 8px rgba(240,78,44,0.28)", cursor: "pointer" }}
          >
            {/* STRING */}Send
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px 11px" }}>
        {peopleFor(s.audience).map((pp) => (
          <span key={pp.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: P.textSecondary, background: "#fff", border: `1px solid ${P.border}`, borderRadius: 999, padding: "2px 9px 2px 3px" }}>
            <span style={{ width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 8.5, fontWeight: 700, color: "#fff", background: pp.side === "purchaser" ? P.purchaserDot : P.vendorDot }}>{initials(pp.name)}</span>
            {pp.name.split(" ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CheckpointPreviewPrototype() {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Distinct parties across everything staged — drives the send-button rule.
  const parties = useMemo(() => {
    const set = new Set<string>();
    for (const s of staged) for (const p of peopleFor(s.audience)) set.add(p.name);
    return set.size;
  }, [staged]);
  // Your rule: ≤2 parties → per-card Send + Send all; >2 → Send all only.
  const perCardSend = parties <= 2;

  function stageKey(label: string, audience: Audience) { return `${label}::${audience}`; }

  function toggle(label: string, audience: Audience) {
    setStaged((prev) => {
      const k = stageKey(label, audience);
      const existing = prev.find((s) => s.label === label);
      if (existing && existing.audience === audience) return prev.filter((s) => s.label !== label); // untick
      const without = prev.filter((s) => s.label !== label);
      return [...without, { key: k, label, audience }];
    });
  }

  function currentAudience(label: string): Audience | null {
    return staged.find((s) => s.label === label)?.audience ?? null;
  }

  function send(keys: string[]) {
    // Mark leaving → fade up/out → remove → confirmation toast.
    setStaged((prev) => prev.map((s) => (keys.includes(s.key) ? { ...s, leaving: true } : s)));
    const names = Array.from(new Set(staged.filter((s) => keys.includes(s.key)).flatMap((s) => peopleFor(s.audience).map((p) => p.name.split(" ")[0]))));
    const count = keys.length;
    setTimeout(() => {
      setStaged((prev) => prev.filter((s) => !keys.includes(s.key)));
      // STRING: final confirmation
      setToast(`On ${joinNames(names)}'s portal now — ${count === 1 ? "1 thing" : `${count} things`} to confirm.`);
      setTimeout(() => setToast(null), 3200);
    }, 420);
    setSheetOpen(false);
  }

  const live = staged.filter((s) => !s.leaving);
  const visibleDesktop = live.slice(0, 3);
  const overflow = live.length - visibleDesktop.length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--agent-bg, #F3EEE6)", padding: "28px 20px 140px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted,#8A8178)" }}>Prototype · /dev</p>
        <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary,#2A2320)" }}>See what you&apos;re sending</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--agent-text-secondary,#5C544C)", lineHeight: 1.5 }}>
          Tick a checkpoint onto a client and watch the exact portal card build up. Send one, or send all. {/* STRING */}
        </p>

        {/* composer — tick checkpoints onto a client */}
        <div style={{ background: "var(--agent-surface-elevated,#fff)", border: "1px solid var(--agent-border-default,rgba(45,24,16,0.12))", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary,#2A2320)" }}>Checkpoints</p>
          {PICKLIST.map((label) => {
            const aud = currentAudience(label);
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--agent-border-subtle,rgba(45,24,16,0.07))" }}>
                <span style={{ fontSize: 13.5, color: "var(--agent-text-primary,#2A2320)" }}>{label}</span>
                <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                  {([["vendor", "Seller"], ["purchaser", "Buyer"], ["both", "Both"]] as [Audience, string][]).map(([v, lbl]) => {
                    const on = aud === v;
                    return (
                      <button
                        key={v}
                        onClick={() => toggle(label, v)}
                        style={{ padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
                          background: on ? "var(--agent-surface-elevated,#fff)" : "var(--agent-surface-glass,rgba(255,255,255,0.5))",
                          border: on ? "1px solid var(--agent-coral-deep,#F04E2C)" : "1px solid var(--agent-border-default,rgba(45,24,16,0.14))",
                          color: on ? "var(--agent-coral-deep,#F04E2C)" : "var(--agent-text-muted,#8A8178)",
                          boxShadow: on ? "0 2px 8px rgba(15,23,42,0.10)" : "none", transform: on ? "translateY(-1px)" : "none",
                          transition: "border-color 160ms, color 160ms, transform 160ms, box-shadow 160ms" }}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--agent-text-muted,#8A8178)", lineHeight: 1.5 }}>
            {parties > 2
              ? `${parties} people will see these — use Send all.` /* STRING */
              : "Send each on its own, or all together." /* STRING */}
          </p>
        </div>
      </div>

      {/* ── DESKTOP preview stack (bottom-right) ── */}
      {live.length > 0 && (
        <div className="cpp-desktop" style={{ position: "fixed", right: 24, bottom: 24, width: 340, display: "flex", flexDirection: "column", gap: 12, zIndex: 50 }}>
          {overflow > 0 && (
            <button onClick={() => setSheetOpen(true)} className="cpp-more" style={{ alignSelf: "center", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "1px solid var(--agent-border-default,rgba(45,24,16,0.14))", background: "var(--agent-surface-elevated,#fff)", color: "var(--agent-text-secondary,#5C544C)", cursor: "pointer" }}>
              +{overflow} more{/* STRING */}
            </button>
          )}
          {visibleDesktop.map((s) => (
            <PreviewCard key={s.key} s={s} showSend={perCardSend} onSend={() => send([s.key])} />
          ))}
          <button onClick={() => send(live.map((s) => s.key))} className="cpp-sendall" style={{ padding: "11px 16px", borderRadius: 13, fontSize: 14, fontWeight: 700, color: "#fff", background: P.primaryGrad, border: "none", boxShadow: "0 3px 10px rgba(240,78,44,0.30)", cursor: "pointer" }}>
            {/* STRING */}Send all to their portal ({live.length})
          </button>
        </div>
      )}

      {/* ── MOBILE bottom bar ── */}
      {live.length > 0 && (
        <button onClick={() => setSheetOpen(true)} className="cpp-bar" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 50, display: "none", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderRadius: 15, border: "none", background: P.primaryGrad, color: "#fff", boxShadow: "0 8px 24px rgba(240,78,44,0.34)", cursor: "pointer" }}>
          <span className="cpp-bar-count" style={{ fontSize: 14, fontWeight: 700 }}>👁 {live.length} ready to send{/* STRING */}</span>
          <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.92 }}>Preview ▲</span>
        </button>
      )}

      {/* ── Sheet (overflow on desktop, the surface on mobile) ── */}
      {sheetOpen && (
        <div onClick={() => setSheetOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(20,14,8,0.42)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} className="cpp-sheet" style={{ width: "100%", maxWidth: 440, background: P.pageBg, borderRadius: "20px 20px 0 0", padding: "10px 14px 18px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(45,24,16,0.18)", margin: "2px auto 12px" }} />
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: P.textPrimary }}>What they&apos;ll see{/* STRING */}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {live.map((s) => (
                <PreviewCard key={s.key} s={s} showSend={perCardSend} onSend={() => send([s.key])} />
              ))}
            </div>
            <button onClick={() => send(live.map((s) => s.key))} style={{ width: "100%", marginTop: 14, padding: "13px 16px", borderRadius: 14, fontSize: 15, fontWeight: 700, color: "#fff", background: P.primaryGrad, border: "none", cursor: "pointer" }}>
              {/* STRING */}Send all ({live.length})
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmation toast ── */}
      {toast && (
        <div className="cpp-toast" style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 70, display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 14, background: "#1F2A22", color: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", maxWidth: "90vw" }}>
          <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", background: P.success, display: "grid", placeItems: "center" }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{toast}</span>
        </div>
      )}

      <style>{`
        .cpp-card{animation:cppIn 320ms cubic-bezier(0.22,1,0.36,1)}
        .cpp-card.cpp-leaving{animation:cppOut 400ms cubic-bezier(0.4,0,0.6,1) forwards}
        @keyframes cppIn{from{opacity:0;transform:translateY(14px) scale(0.98)}to{opacity:1;transform:none}}
        @keyframes cppOut{to{opacity:0;transform:translateY(-22px) scale(0.98)}}
        .cpp-sendall{animation:cppIn 320ms cubic-bezier(0.22,1,0.36,1)}
        .cpp-toast{animation:cppToast 240ms cubic-bezier(0.22,1,0.36,1)}
        @keyframes cppToast{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .cpp-sheet{animation:cppSheet 280ms cubic-bezier(0.22,1,0.36,1)}
        @keyframes cppSheet{from{transform:translateY(100%)}to{transform:none}}
        @media (max-width:767px){
          .cpp-desktop{display:none !important}
          .cpp-bar{display:flex !important}
        }
      `}</style>
    </div>
  );
}
