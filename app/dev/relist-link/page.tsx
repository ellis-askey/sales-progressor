"use client";

// /dev/relist-link — design review for the "Add sale catches an existing
// on-hold / fallen-through file and routes to Add new buyer" feature.
//
// Polished MOCKUP for sign-off, not wired to any server. Three screens of the
// flow with the real agent-app chrome: the canonical coral band header
// (SheetBandHeader), PropertyThumb (its own light/dark fallback), glass surfaces
// and tokens, so it reads light AND dark. The keep/replace toggles are live and
// use the same primary-button gradient as the rest of the app. Dev-only.

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Check, CurrencyGbp, Scales, UserCircle, LinkSimpleHorizontal, HouseLine,
  NotePencil, Image as ImageIcon, UserGear, ArrowUDownLeft, X, Sun, Moon,
} from "@phosphor-icons/react";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { PropertyThumb } from "@/components/ui/PropertyThumb";

// ─── Shared mock chrome ──────────────────────────────────────────────────────

// Mimics the real <Modal> card inline so every screen can sit on one review page
// instead of portalling over it. The coral band header owns the top treatment.
function PreviewModal({ maxWidth = 512, children }: { maxWidth?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
        background: "var(--agent-surface-elevated, #fff)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// Canonical coral band header + a (decorative) close glyph, matching every
// drawer/modal top section in the app.
function BandHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ ...SHEET_BAND_STYLE, position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <SheetBandHeader title={title} subtitle={subtitle} />
      <span aria-hidden style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.85)" }}>
        <X size={16} weight="bold" />
      </span>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flexShrink: 0, padding: "16px 24px", display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--agent-border-subtle)" }}>
      {children}
    </div>
  );
}

// Eyebrow / section label — sentence case, first letter only.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-secondary)", marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ─── Segmented keep / replace control (primary-button gradient when active) ───

function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 3, borderRadius: 10, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)" }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              transition: "background 140ms ease, color 140ms ease, box-shadow 140ms ease",
              color: active ? "var(--agent-text-on-coral, #fff)" : "var(--agent-text-secondary)",
              background: active ? "var(--agent-btn-bg, linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)))" : "transparent",
              boxShadow: active ? "0 2px 8px rgba(var(--agent-coral-rgb), 0.26)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Readback of a pre-filled buyer field ────────────────────────────────────

function ReadField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 4 }}>{label}</div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 13.5, fontWeight: 500, color: "var(--agent-text-primary)",
          padding: "9px 12px", borderRadius: 9,
          background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)",
        }}
      >
        {icon && <span style={{ color: "var(--agent-text-muted)", display: "inline-flex" }} aria-hidden>{icon}</span>}
        {value}
      </div>
    </div>
  );
}

// ─── A safe, additive file update (just gets written, no decision) ───────────

function SafeUpdate({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <span style={{ color: "var(--agent-success, #0f766e)", display: "inline-flex", flexShrink: 0 }} aria-hidden>
        <Check size={15} weight="bold" />
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--agent-text-secondary)" }}>
        <span style={{ color: "var(--agent-text-muted)", display: "inline-flex" }} aria-hidden>{icon}</span>
        {label}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ─── A conflict row: file value | entered value (divided) + keep/replace ─────

function ConflictCard({
  icon, title, fileLabel, enteredLabel, note, options, value, onChange,
}: {
  icon: React.ReactNode;
  title: string;
  fileLabel: string;
  enteredLabel: string;
  note?: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "0.5px solid var(--agent-border-default)",
        borderLeft: "3px solid var(--agent-warning, #D08700)",
        background: "var(--agent-surface-glass)",
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color: "var(--agent-warning, #D08700)", display: "inline-flex" }} aria-hidden>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "stretch", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--agent-text-muted)" }}>On the file</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 3 }}>{fileLabel}</div>
        </div>
        <div aria-hidden style={{ width: 1, background: "var(--agent-border-default)", margin: "0 14px", alignSelf: "stretch" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--agent-text-muted)" }}>You entered</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 3 }}>{enteredLabel}</div>
        </div>
      </div>
      <Segmented options={options} value={value} onChange={onChange} />
      {note && <p style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>{note}</p>}
    </div>
  );
}

// ─── Screen 1: the catch dialog ──────────────────────────────────────────────

function CatchDialog() {
  return (
    <PreviewModal maxWidth={468}>
      <BandHeader title="You already have a file for this address" subtitle="We found an existing file for this property." />
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Existing file summary */}
        <div
          style={{
            display: "flex", gap: 12, alignItems: "center",
            padding: "12px 14px", borderRadius: 12,
            background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-default)",
          }}
        >
          <PropertyThumb photoUrl={null} size={44} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>2 Magnolia Way, Cheshunt</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, color: "#fff", background: "linear-gradient(180deg, #E8A020, var(--agent-warning, #D08700))", boxShadow: "0 2px 7px rgba(var(--agent-warning-rgb, 208,135,0), 0.35), inset 0 1px 0 rgba(255,255,255,0.28)" }}>On hold</span>
              <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>£385k</span>
              <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>Buyer: Tara and Billy Leonard</span>
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
          You can add the new buyer to the existing file or create a separate one. Adding them to the existing file keeps
          the property&rsquo;s history together, including the previous buyer, and carries over everything you&rsquo;ve
          entered so far.
        </p>
      </div>
      <ModalFooter>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-secondary">No, create a separate file</button>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowUDownLeft size={14} weight="bold" /> Add new buyer to this file
        </button>
      </ModalFooter>
    </PreviewModal>
  );
}

// ─── Screen 2: the review step ───────────────────────────────────────────────

function ReviewStep({ withConflicts }: { withConflicts: boolean }) {
  const [tenure, setTenure] = useState("keep");
  const [seller, setSeller] = useState("keep");
  const [sellerOnward, setSellerOnward] = useState("keep");

  return (
    <PreviewModal maxWidth={560}>
      <BandHeader
        title="Add new buyer to 2 Magnolia Way"
        subtitle="The previous buyer moves to this file's history."
      />
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* A: new buyer, pre-filled */}
        <div>
          <SectionLabel>New buyer (from what you entered)</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ReadField label="Buyer" value="Mark and Lucy Powell" icon={<UserCircle size={15} />} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <ReadField label="Agreed price" value="£395,000" icon={<CurrencyGbp size={15} />} />
              <ReadField label="Purchase method" value="Mortgage" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <ReadField label="Buyer's solicitor" value="Bright Solicitors" />
              <ReadField label="Buyer's broker" value="Crest Mortgages" />
            </div>
            <ReadField label="Related sale" value="Selling 7 Elm Road (in a chain)" icon={<HouseLine size={15} />} />
            <p style={{ margin: "2px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
              The previous buyer and their related sale move to this file&rsquo;s history.
            </p>
          </div>
        </div>

        {/* B: safe updates */}
        <div>
          <SectionLabel>We&rsquo;ll update the file</SectionLabel>
          <div style={{ borderRadius: 12, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", padding: "4px 14px" }}>
            <SafeUpdate icon={<CurrencyGbp size={14} />} label="Agent fee" value="£5,750 inc. VAT" />
            <SafeUpdate icon={<NotePencil size={14} />} label="Your sale note" value="Added to the file" />
            <SafeUpdate icon={<ImageIcon size={14} />} label="Property photo" value="Added" />
            <SafeUpdate icon={<UserGear size={14} />} label="Assigned to" value="You (Emily Hartwell)" />
          </div>
        </div>

        {/* C: conflicts (only when they differ from the file) */}
        <div>
          <SectionLabel>{withConflicts ? "Needs your confirmation" : "Nothing to confirm"}</SectionLabel>
          {withConflicts ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ConflictCard
                icon={<Scales size={15} weight="fill" />}
                title="Tenure differs"
                fileLabel="Leasehold"
                enteredLabel="Freehold"
                note="Changing tenure reshuffles the legal steps on the file, so we never flip it without you."
                options={[{ id: "keep", label: "Keep leasehold" }, { id: "replace", label: "Use freehold" }]}
                value={tenure}
                onChange={setTenure}
              />
              <ConflictCard
                icon={<UserCircle size={15} weight="fill" />}
                title="Seller differs"
                fileLabel="Jane Smith"
                enteredLabel="Mark Powell (snr)"
                note="Keeping avoids a duplicate seller on the file. The seller rarely changes when only the buyer does."
                options={[{ id: "keep", label: "Keep Jane Smith" }, { id: "replace", label: "Replace" }]}
                value={seller}
                onChange={setSeller}
              />
              <ConflictCard
                icon={<LinkSimpleHorizontal size={15} weight="bold" />}
                title="Seller's onward purchase"
                fileLabel="Buying 14 Oak Avenue"
                enteredLabel="Buying 9 Pine Close"
                note="The seller usually keeps their onward purchase, so we keep the file's unless you say otherwise. This is the chain above the property, not the new buyer's related sale."
                options={[{ id: "keep", label: "Keep file's" }, { id: "replace", label: "Use what you entered" }]}
                value={sellerOnward}
                onChange={setSellerOnward}
              />
            </div>
          ) : (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12,
                background: "linear-gradient(180deg, #27A75D, var(--agent-success, #1F8A4A))",
                border: "none",
                boxShadow: "0 4px 16px rgba(var(--agent-success-rgb, 31, 138, 74), 0.28)",
              }}
            >
              <span style={{ color: "#fff", display: "inline-flex", flexShrink: 0 }} aria-hidden><Check size={18} weight="bold" /></span>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.96)", lineHeight: 1.45 }}>
                Tenure, seller and the seller&rsquo;s onward purchase match the file, so nothing you entered clashes. We&rsquo;ll just add the new buyer.
              </span>
            </div>
          )}
        </div>
      </div>
      <ModalFooter>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-secondary">Cancel</button>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Check size={14} weight="bold" /> Add new buyer
        </button>
      </ModalFooter>
    </PreviewModal>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Specimen = { name: string; when: string; node: React.ReactNode };

const SPECIMENS: Specimen[] = [
  {
    name: "1 · The catch (on Create)",
    when: "The agent finished the usual Add sale flow and pressed Create. The address matches an existing on-hold / fallen-through file, so we offer to add the buyer to it instead of making a duplicate.",
    node: <CatchDialog />,
  },
  {
    name: "2 · Review and confirm (with conflicts)",
    when: "Everything they typed is kept: buyer details pre-fill the top, the safe fields just update the file, and the three things that could clash (tenure, seller, chain) ask keep-or-replace. Try the toggles.",
    node: <ReviewStep withConflicts />,
  },
  {
    name: "3 · Review and confirm (nothing clashes)",
    when: "The common, clean case: what they entered matches the file, so there's nothing to confirm. One tap adds the new buyer.",
    node: <ReviewStep withConflicts={false} />,
  },
];

export default function DevRelistLinkPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 96px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>
            Add sale, routed to Add new buyer
          </h1>
          <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", margin: "6px 0 0", lineHeight: 1.55 }}>
            Mockup for sign-off. Not wired up; the keep/replace toggles are live so you can feel the interaction.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="agent-btn agent-btn-sm agent-btn-secondary"
          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {dark ? <Sun size={14} weight="bold" /> : <Moon size={14} weight="bold" />}
          {dark ? "Light" : "Dark"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 34, marginTop: 30 }}>
        {SPECIMENS.map((s) => (
          <section key={s.name}>
            <h2 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)", margin: "0 0 2px" }}>{s.name}</h2>
            <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 14px", lineHeight: 1.55 }}>{s.when}</p>
            {/* data-night makes the dark-mode drawer/modal token overrides apply
                (dark coral-wash band + dark surfaces), matching real portaled
                modals. It only takes effect under html[data-theme="dark"], so
                light mode is unchanged. */}
            <div data-night="" style={{ display: "flex", justifyContent: "center" }}>{s.node}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
