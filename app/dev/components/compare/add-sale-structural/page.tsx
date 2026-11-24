"use client";

// Add New Sale — STRUCTURAL compare. The six items the coverage audit flagged as
// "need their own harness": modals, map + pin, collapsible header, submission overlay,
// draft launcher, populated party card. Same Current-vs-Proposed format. Left is the
// shipped markup reproduced byte-for-byte; right is the canonical / proposed treatment.
// Dev-only, read-only. Nothing changes production.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { CaretDown, Buildings, X, CheckCircle, MagnifyingGlass } from "@phosphor-icons/react";
import { LabelInput } from "@/components/ui/LabelInput";
import { Pill } from "@/components/ui/Pill";
import { CollapsibleSection } from "@/components/transactions-v2/form/CollapsibleSection";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";
type VW = "desktop" | "tablet" | "mobile";
const VW_W: Record<VW, number | undefined> = { desktop: undefined, tablet: 720, mobile: 380 };
type TagKind = "apply" | "new" | "decision";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  apply: { label: "Migrate — canonical exists", fg: "#8a5a00", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  new:   { label: "New canonical", fg: "#7E22CE", bg: "rgba(126,34,206,0.12)", bd: "rgba(126,34,206,0.30)" },
  decision: { label: "Decision required", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
};
function Tag({ kind }: { kind: TagKind }) {
  const t = TAG[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Pane({ side, vw, children }: { side: "current" | "proposed"; vw: VW; children: ReactNode }) {
  const isP = side === "proposed";
  const w = VW_W[vw];
  return (
    <div style={{ flex: "1 1 340px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed" : "Current (shipped)"}</span>
      <div style={{ borderRadius: 16, padding: 18, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", justifyContent: "center" }}>
        <div style={{ width: w ? `min(${w}px, 100%)` : "100%", minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
function Block({ n, title, tags, note, source, vw, current, proposed }: { n: string; title: string; tags: TagKind[]; note: ReactNode; source?: string; vw: VW; current: ReactNode; proposed: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "28px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 860 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current" vw={vw}>{current}</Pane>
        <Pane side="proposed" vw={vw}>{proposed}</Pane>
      </div>
      {source && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--compare-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CaretDown size={11} weight="bold" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} /> Source
          </button>
          {open && <div style={{ marginTop: 8, fontSize: 12, color: "var(--compare-body)", background: "var(--compare-pane)", border: "1px solid var(--compare-line)", borderRadius: 10, padding: "10px 12px" }}><code>{source}</code></div>}
        </div>
      )}
    </section>
  );
}

/* A faithful dark map placeholder behind the location pin. */
function MapStub({ pinColor }: { pinColor: string }) {
  return (
    <div style={{ position: "relative", width: "100%", height: 150, borderRadius: 12, overflow: "hidden", background: "repeating-linear-gradient(45deg,#e9e6e1,#e9e6e1 10px,#eeebe6 10px,#eeebe6 20px)" }}>
      <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 34, height: 34, borderRadius: "50%", background: `color-mix(in srgb, ${pinColor} 22%, transparent)` }} />
      <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", background: pinColor, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
    </div>
  );
}

/* The populated solicitor party card, byte-for-byte (current) or proposed. */
function PartyCard({ proposed }: { proposed?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {proposed
          ? <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 8, boxShadow: `inset 0 0 0 1.5px ${CORAL}`, flexShrink: 0 }}><Buildings size={14} weight="bold" color={CORAL} /></span>
          : <Buildings size={18} weight="bold" color={CORAL} style={{ flexShrink: 0 }} />}
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Hartley &amp; Wren LLP</p>
        <button type="button" style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: proposed ? 600 : 400, color: proposed ? CORAL : "var(--nv2-text-ghost)", padding: 0 }}>Change</button>
      </div>
      <div style={{ background: proposed ? "var(--agent-surface-muted, rgba(45,24,16,0.035))" : "var(--nv2-surface-glass)", border: proposed ? "1px solid var(--agent-border-default)" : "0.5px solid var(--nv2-border-dark)", borderRadius: 8, padding: "8px 10px" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)" }}>Jane Powell</p>
        <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--agent-text-muted)" }}>01892 555 014 · jane@hartleywren.co.uk</p>
      </div>
    </div>
  );
}

/* The whole "Solicitors & Broker" card the header + party card live inside — the REAL
   CollapsibleSection, with the two-column solicitor content reproduced byte-for-byte. */
function SolCard({ proposed, defaultOpen = true }: { proposed?: boolean; defaultOpen?: boolean }) {
  return (
    <CollapsibleSection title="Solicitors & Broker" summary="Seller’s solicitor added" defaultOpen={defaultOpen}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv2-text-secondary)" }}>Seller’s solicitor</span>
            <CheckCircle size={13} weight="fill" color="var(--agent-success)" />
          </div>
          <PartyCard proposed={proposed} />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: "var(--nv2-text-secondary)" }}>Buyer’s solicitor</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-muted)", fontSize: 13 }}><MagnifyingGlass size={15} /> Search firm name…</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

export default function AddSaleStructuralPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const [vw, setVw] = useState<VW>("desktop");
  const restore = useRef<string | null>(null);
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const pageVars = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-pane" as string]: theme === "dark" ? "rgba(255,255,255,0.03)" : "#faf8f5",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
  } as CSSProperties;
  const toggleBtn = (active: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: active ? CORAL : "transparent", color: active ? "#fff" : "var(--compare-body)" });

  // Shared bits for the modal block.
  const modalFooter = (canonical: boolean) => (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
      <button style={{ fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: canonical ? 12 : 10, border: "1px solid var(--agent-border-default)", background: "transparent", color: "var(--agent-text-secondary)", cursor: "pointer" }}>Keep editing</button>
      <button style={{ fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: canonical ? 12 : 10, border: "none", background: canonical ? CORAL : "linear-gradient(180deg,#FF8A65,#FF6B4A)", color: "#fff", cursor: "pointer" }}>Discard</button>
    </div>
  );

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Add New Sale — structural compare</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggleBtn(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggleBtn(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{(["desktop", "tablet", "mobile"] as VW[]).map((v) => <button key={v} type="button" style={toggleBtn(vw === v)} onClick={() => setVw(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · coverage · structural</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Add New Sale — the structural bits</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 820 }}>
            The six items that needed their own render. Left is the shipped markup reproduced byte-for-byte; right is the canonical / proposed treatment. Nothing here changes production.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["apply", "new"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        {/* S1 — Collapsible section header, shown in its real card (collapsed vs open) */}
        <Block n="S1" title="Collapsible section — the real card, collapsed vs open" tags={["new"]} vw={vw}
          source="components/transactions-v2/form/CollapsibleSection.tsx (imported real component)"
          note={<>The <strong>real <code>CollapsibleSection</code></strong> (not a mock) — the whole “Solicitors &amp; Broker” card the header sits in, with the two-column solicitor content inside, reproduced byte-for-byte. Left is collapsed (header + summary), right is open. No change proposed — this is the full context, to confirm cataloguing the card + header/chevron pattern as-is. Click either header.</>}
          current={<SolCard defaultOpen={false} />}
          proposed={<SolCard defaultOpen />}
        />

        {/* S2 — Populated party card, in its real card context */}
        <Block n="S2" title="Populated firm card — in its real card" tags={["new"]} vw={vw}
          source="SolicitorSection.PopulatedCard, inside the real CollapsibleSection"
          note={<>The populated seller’s-solicitor card shown <strong>inside the real “Solicitors &amp; Broker” card</strong>, beside the buyer’s-solicitor search — its true surrounding. Left is shipped (plain Buildings icon, nv2 glass sub-card); right is the proposed canonical party card (ring icon tile, agent surfaces). The <em>same</em> card also appears in the broker section.</>}
          current={<SolCard proposed={false} />}
          proposed={<SolCard proposed />}
        />

        {/* S3 — Submission overlay */}
        <Block n="S3" title="Submission overlay" tags={["new"]} vw={vw}
          source="components/transactions-v2/SubmissionOverlay.tsx"
          note={<>Byte-for-byte the shipped full-screen submit overlay — the canonical <code>agent-spinner-lg</code> (coral arc) + a rotating message, on a frosted backdrop. Only the spinner is catalogued; the overlay shell isn’t. Proposed: catalogue as-is.</>}
          current={
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, height: 180, borderRadius: 12, background: "var(--nv2-surface-raised)", backdropFilter: "blur(18px)" }}>
              <span className="agent-spinner agent-spinner-lg" style={{ borderColor: "rgba(255,107,74,0.18)", borderTopColor: CORAL }} />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nv2-text-primary)" }}>Creating your sale…</p>
            </div>
          }
          proposed={
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, height: 180, borderRadius: 12, background: "var(--nv2-surface-raised)", backdropFilter: "blur(18px)" }}>
              <span className="agent-spinner agent-spinner-lg" style={{ borderColor: "rgba(255,107,74,0.18)", borderTopColor: CORAL }} />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nv2-text-primary)" }}>Creating your sale…</p>
            </div>
          }
        />

        {/* S4 — Location map pin */}
        <Block n="S4" title="Location map + “you are here” pin — retoken" tags={["apply"]} vw={vw}
          source="components/transaction/PropertyLocationMap.tsx (pin hardcodes #2563eb)"
          note={<>The pin hardcodes <code>#2563eb</code> — the Command-Centre blue — rather than an agent token, so it won’t follow a themed accent. Proposed: the same pin on <code>--agent-info</code> (the agent app’s own blue). The keyless map backdrop would also get a gallery entry.</>}
          current={<MapStub pinColor="#2563eb" />}
          proposed={<MapStub pinColor="var(--agent-info, #3D7AB8)" />}
        />

        {/* S5 — Modal shell */}
        <Block n="S5" title="Hand-rolled modal shell → canonical Modal" tags={["apply"]} vw={vw}
          source="NavAwayModal · DuplicateAddressModal · ChangeFileModal vs components/ui/Modal"
          note={<>Three modals reimplement the portal/backdrop/card by hand while <code>RelistCatchModal</code> in the same flow uses the canonical <code>Modal</code>. Representative card shells shown (not the live portal): the canonical adds the standard radius, close affordance and footer button family.</>}
          current={
            <div style={{ borderRadius: 14, background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)", padding: "18px 18px", boxShadow: "0 18px 50px rgba(15,23,42,0.18)" }}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Leave without saving?</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>You’ve started this sale. Leaving now discards what you’ve entered.</p>
              {modalFooter(false)}
            </div>
          }
          proposed={
            <div style={{ position: "relative", borderRadius: 20, background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)", padding: "18px 18px", boxShadow: "0 24px 64px rgba(15,23,42,0.22)" }}>
              <button style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999, border: "none", background: "transparent", color: "var(--agent-text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={15} weight="bold" /></button>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Leave without saving?</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>You’ve started this sale. Leaving now discards what you’ve entered.</p>
              {modalFooter(true)}
            </div>
          }
        />

        {/* S6 — Add-firm fields */}
        <Block n="S6" title="Add-firm / add-solicitor fields → LabelInput" tags={["apply"]} vw={vw}
          source="AddFirmModal / AddSolicitorForm (glass-input · .pf-input · hand-rolled valid tick)"
          note={<>The add-firm + add-solicitor forms use legacy <code>glass-input</code> / <code>.pf-input</code> fields with a bespoke per-field valid tick, instead of the canonical floating-label field. Proposed: <code>LabelInput</code> (with its outline + lifted label).</>}
          current={
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 300 }}>
              <div><p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 500, color: "var(--agent-text-muted)" }}>Firm name</p><input className="glass-input" placeholder="e.g. Hartley & Wren LLP" style={{ width: "100%", height: 40, padding: "0 12px", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "rgba(255,255,255,0.5)", outline: "none" }} /></div>
            </div>
          }
          proposed={
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 300, ["--lbi-top" as string]: "0px" } as CSSProperties}>
              <LabelInput field="firm" label="Firm name" type="text" accent="#FF6B4A" fullWidth />
            </div>
          }
        />

        {/* ── The two deferred decisions ──────────────────────────────────────── */}
        <h2 style={{ margin: "36px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>The two that need your call</h2>

        <Block n="M4" title="Company person field → LabelInput (the trade-off)" tags={["decision"]} vw={vw}
          source="ContactsSection.tsx:158-181 (.agent-input + label row)"
          note={<>Why I paused this one: the shipped field has a <strong>label row with a “Not a company” action</strong> and an <strong>example placeholder</strong>. The canonical <code>LabelInput</code> floats its own label, so the example goes away and the action has to be rehomed (right). Left = shipped; right = the LabelInput version. Your call: adopt the floating field (right), or keep the label row and just restyle the input.</>}
          current={
            <div style={{ width: 300 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--nv2-text-secondary)", marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Who should we address? <span style={{ color: "var(--nv2-text-muted)", fontWeight: 400 }}>(optional)</span></span>
                <button type="button" style={{ fontSize: 11, color: "var(--nv2-text-ghost)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>Not a company</button>
              </label>
              <input className="agent-input" placeholder="e.g. the director or signatory" style={{ width: "100%", height: 40, padding: "0 12px", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "rgba(255,255,255,0.5)", outline: "none" }} />
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--nv2-text-muted)" }}>Looks like a company. We’ll greet this person in emails, or keep it general if you leave it blank.</p>
            </div>
          }
          proposed={
            <div style={{ width: 300 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}><button type="button" style={{ fontSize: 11, color: "var(--nv2-text-ghost)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>Not a company</button></div>
              <div style={{ ["--lbi-top" as string]: "0px" } as CSSProperties}><LabelInput field="person" label="Who should we address?" type="text" accent="#FF6B4A" fullWidth /></div>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--nv2-text-muted)" }}>Looks like a company. We’ll greet this person in emails, or keep it general if you leave it blank.</p>
            </div>
          }
        />

        <Block n="M7" title="Relist status pill → canonical Pill (in its row)" tags={["decision"]} vw={vw}
          source="RelistCatchModal.tsx:66-73 (property row + gradient pill)"
          note={<>Why I paused this one: the pill’s colour is <strong>status-driven</strong> (a different gradient per matched-sale status). Shown in its real modal row. Proposed: the canonical <code>Pill</code> with a <strong>warning</strong> tone for “fell through”. Your call: confirm the tone map (fell-through = warning, withdrawn = danger, etc.) and I’ll wire it.</>}
          current={
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)" }}>
              <span style={{ width: 44, height: 44, borderRadius: 10, background: "repeating-linear-gradient(45deg,#e9e6e1,#e9e6e1 6px,#eeebe6 6px,#eeebe6 12px)", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>14 Mill Road</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, color: "#fff", background: "linear-gradient(180deg,#FF8A65,#FF6B4A)", boxShadow: "0 2px 7px rgba(255,107,74,0.35)" }}>Previously fell through</span>
                  <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>£340,000</span>
                </div>
              </div>
            </div>
          }
          proposed={
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)" }}>
              <span style={{ width: 44, height: 44, borderRadius: 10, background: "repeating-linear-gradient(45deg,#e9e6e1,#e9e6e1 6px,#eeebe6 6px,#eeebe6 12px)", flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>14 Mill Road</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <Pill tone="warning" size="sm">Previously fell through</Pill>
                  <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>£340,000</span>
                </div>
              </div>
            </div>
          }
        />

        <section style={{ borderTop: "1px solid var(--compare-line)", paddingTop: 22, marginTop: 8 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--compare-body)", maxWidth: 820, lineHeight: 1.6 }}>
            Not shown as a pane: the <strong>draft launcher</strong> (fixed bottom-left pill + popover) — it’s a positioned overlay, best reviewed live. It’s a clear new-canonical candidate alongside the submission overlay.
          </p>
        </section>
      </div>
    </div>
  );
}
