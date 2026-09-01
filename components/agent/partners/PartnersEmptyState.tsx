"use client";

// Partners onboarding empty state (director, brand-new agency). Mirrors the
// other empty states — gradient + HeroArt hero, glass cards — plus an add flow
// that opens in a popup (centred on desktop, bottom sheet on mobile) instead of
// sitting on the page. Cards fill in as the director adds a broker / solicitor;
// they stay on this screen (no page jump). The full directory page takes over
// only once real firms appear from the agency's sales. 2026-08-31.

import { useState } from "react";
import Link from "next/link";
import { Plus, UserCircle, Bank, LinkSimple, UsersThree, ArrowRight, Check, PencilSimple, Trash } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { HeroArt } from "@/components/agent/HeroArt";
import { GlassCard } from "@/components/glass/GlassCard";
import { PartnerPopup } from "@/components/agent/partners/PartnerPopup";
import { BrokerForm, type PreferredBroker } from "@/components/agent/PreferredBrokerSettings";
import { AddSolicitorForm, type AddedSolicitor } from "@/components/agent/partners/AddSolicitorForm";
import { removePreferredBrokerAction } from "@/app/actions/brokers";
import { removeRecommendedSolicitorAction } from "@/app/actions/solicitors";

type RecommendedFirm = { firmId: string; firmName: string; defaultReferralFeePence: number | null };
type AllFirm = { id: string; name: string };
type PopupMode = "chooser" | "broker" | "solicitor";

function Arrow() {
  return <ArrowRight size={14} weight="bold" className="agent-arrow-i" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />;
}

// A card matching the SetupCard shell, but able to fill in once a partner is
// added. Pass glassId + label to make it a Design Lab surface (like SetupCard).
function PartnerCard({
  tint, icon, title, desc, footer, glassId, label,
}: {
  tint: { bg: string; fg: string };
  icon: React.ReactNode;
  title: string;
  desc: string;
  footer?: React.ReactNode;
  glassId?: string;
  label?: string;
}) {
  const cardStyle: React.CSSProperties = { padding: "18px 18px 16px", borderRadius: "var(--agent-radius-lg)", display: "flex", flexDirection: "column", gap: 14, height: "100%" };
  const body = (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
        <span style={{ color: tint.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>{title}</p>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{desc}</p>
        </div>
      </div>
      {footer}
    </>
  );
  if (glassId) {
    return <GlassCard glassId={glassId} label={label ?? title} style={cardStyle}>{body}</GlassCard>;
  }
  return <div className="agent-glass" style={cardStyle}>{body}</div>;
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="agent-btn agent-btn-secondary agent-btn-sm" style={{ width: "100%", justifyContent: "space-between" }}>
      {label}<Arrow />
    </button>
  );
}

function DoneRow({ name, tone }: { name: string; tone?: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <Check size={14} weight="bold" style={{ color: tone ? `rgb(${tone})` : "var(--agent-coral-deep)", flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </span>
  );
}

// Small square icon button used for edit / remove on the filled partner rows.
function CardIconButton({ title, onClick, danger, disabled, children }: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const color = disabled
    ? "var(--agent-text-disabled, rgba(15,23,42,0.3))"
    : hover
      ? (danger ? "#f05252" : "var(--agent-coral-deep)")
      : "var(--agent-text-muted)";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        border: "none", cursor: disabled ? "default" : "pointer", color,
        background: hover && !disabled ? (danger ? "rgba(240,82,82,0.1)" : "rgba(var(--agent-coral-rgb),0.1)") : "transparent",
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

export function PartnersEmptyState({
  initialBroker,
  initialRecommended,
  allFirms,
  canCreateSale,
}: {
  initialBroker: PreferredBroker | null;
  initialRecommended: RecommendedFirm[];
  allFirms: AllFirm[];
  canCreateSale: boolean;
}) {
  const [broker, setBroker] = useState<PreferredBroker | null>(initialBroker);
  const [recommended, setRecommended] = useState<RecommendedFirm[]>(initialRecommended);
  const [popupOpen, setPopupOpen] = useState(false);
  const [mode, setMode] = useState<PopupMode>("chooser");
  // The recommended firm being edited (null = adding a fresh one).
  const [editingSolicitor, setEditingSolicitor] = useState<RecommendedFirm | null>(null);
  const [removingBroker, setRemovingBroker] = useState(false);
  const [removingFirmId, setRemovingFirmId] = useState<string | null>(null);

  function open(m: PopupMode) { setEditingSolicitor(null); setMode(m); setPopupOpen(true); }
  function editSolicitor(r: RecommendedFirm) { setEditingSolicitor(r); setMode("solicitor"); setPopupOpen(true); }
  const close = () => setPopupOpen(false);

  async function removeBroker() {
    setRemovingBroker(true);
    try { await removePreferredBrokerAction(); setBroker(null); }
    finally { setRemovingBroker(false); }
  }
  async function removeSolicitor(firmId: string) {
    setRemovingFirmId(firmId);
    try {
      await removeRecommendedSolicitorAction(firmId);
      setRecommended((prev) => prev.filter((r) => r.firmId !== firmId));
    } finally { setRemovingFirmId(null); }
  }

  const title = mode === "broker" ? (broker ? "Edit mortgage broker" : "Add mortgage broker")
    : mode === "solicitor" ? (editingSolicitor ? "Edit solicitor firm" : "Add solicitor firm")
    : "Add a preferred partner";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)", minHeight: 240, padding: "30px 32px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        <HeroArt light="/partners-hero.png" dark="/partners-hero-dark.png" maxWidth="50%" maskStart="40%" />
        <div style={{ position: "relative", maxWidth: 460 }}>
          <Pill tone="brand" size="sm" glass style={{ marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            Your partner network
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: 27, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Set up the partners you work with
          </p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 400 }}>
            Choose your preferred mortgage broker and the solicitor firms you recommend. We&apos;ll also build your partner list automatically as they appear on your sales.
          </p>
          <button type="button" onClick={() => open("chooser")} className="agent-btn agent-btn-primary agent-btn-md" style={{ width: "fit-content" }}>
            <Plus size={16} weight="bold" />
            Add a preferred partner
          </button>
        </div>
      </div>

      {/* Three cards */}
      <div className="setup-cards-3">
        {/* Mortgage broker */}
        <PartnerCard
          glassId="empty-partners-broker"
          label="Partners empty · Mortgage broker"
          tint={{ bg: "rgba(var(--agent-coral-rgb), 0.12)", fg: "var(--agent-coral-deep)" }}
          icon={<UserCircle size={20} weight="regular" />}
          title="Set your mortgage broker"
          desc="Choose the broker your agency works with. We'll make them easy to select on new sales and track any referral fees in your analytics."
          footer={broker
            ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 6px 5px 12px", borderRadius: 9, background: "rgba(var(--agent-coral-rgb),0.08)", border: "1px solid rgba(var(--agent-coral-rgb),0.20)" }}>
                <DoneRow name={broker.firmName} />
                <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <CardIconButton title="Edit" onClick={() => open("broker")}><PencilSimple size={15} /></CardIconButton>
                  <CardIconButton title="Remove" danger disabled={removingBroker} onClick={removeBroker}><Trash size={15} /></CardIconButton>
                </span>
              </div>
            )
            : <AddButton label="Add mortgage broker" onClick={() => open("broker")} />}
        />

        {/* Solicitor firms */}
        <PartnerCard
          glassId="empty-partners-solicitor"
          label="Partners empty · Solicitor firms"
          tint={{ bg: "rgba(59,130,246,0.12)", fg: "#2f74e0" }}
          icon={<Bank size={20} weight="regular" />}
          title="Recommend solicitor firms"
          desc="Add the firms you recommend to clients and set a default referral fee for each one."
          footer={recommended.length > 0
            ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recommended.map((r) => (
                  <div key={r.firmId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 6px 4px 12px", borderRadius: 9, background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.18)" }}>
                    <DoneRow name={r.firmName} tone="59,130,246" />
                    <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <CardIconButton title="Edit" onClick={() => editSolicitor(r)}><PencilSimple size={15} /></CardIconButton>
                      <CardIconButton title="Remove" danger disabled={removingFirmId === r.firmId} onClick={() => removeSolicitor(r.firmId)}><Trash size={15} /></CardIconButton>
                    </span>
                  </div>
                ))}
                <AddButton label="Add another firm" onClick={() => open("solicitor")} />
              </div>
            )
            : <AddButton label="Add solicitor firm" onClick={() => open("solicitor")} />}
        />

        {/* Network builds itself — info only, no CTA */}
        <PartnerCard
          glassId="empty-partners-network"
          label="Partners empty · Network builds itself"
          tint={{ bg: "rgba(16,185,129,0.14)", fg: "#0f9d6b" }}
          icon={<LinkSimple size={20} weight="regular" />}
          title="Your network builds itself"
          desc="Solicitors and brokers involved in your sales automatically appear here, giving you one place to keep track of them."
        />
      </div>

      {/* No partners from sales yet */}
      <GlassCard glassId="empty-partners-nosales" label="Partners empty · No sales yet" style={{ padding: "16px 20px", borderRadius: "var(--agent-radius-lg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <UsersThree size={20} weight="regular" />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>No partners from your sales yet</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Solicitors, brokers and other professionals will appear here automatically as your pipeline grows.</p>
          </div>
        </div>
        {canCreateSale && (
          <Link href="/agent/transactions/new" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ textDecoration: "none", flexShrink: 0, gap: 8 }}>
            Add your first sale<Arrow />
          </Link>
        )}
      </GlassCard>

      {/* Add popup — chooser → the matching form */}
      <PartnerPopup open={popupOpen} onClose={close} ariaLabel={title} title={title}>
        {mode === "chooser" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, color: "var(--agent-text-secondary)" }}>Who would you like to add?</p>
            <ChooserOption
              tint={{ bg: "rgba(var(--agent-coral-rgb),0.12)", fg: "var(--agent-coral-deep)" }}
              icon={<UserCircle size={24} weight="regular" />}
              title="Mortgage broker"
              desc="The broker your agency works with"
              onClick={() => setMode("broker")}
            />
            <ChooserOption
              tint={{ bg: "rgba(59,130,246,0.12)", fg: "#2f74e0" }}
              icon={<Bank size={24} weight="regular" />}
              title="Solicitor firm"
              desc="A firm you recommend to clients"
              onClick={() => setMode("solicitor")}
            />
          </div>
        )}

        {mode === "broker" && (
          <BrokerForm
            initial={broker}
            isEdit={!!broker}
            onCancel={close}
            onSaved={(b) => { setBroker(b); close(); }}
          />
        )}

        {mode === "solicitor" && (
          <AddSolicitorForm
            allFirms={allFirms}
            // Exclude firms already recommended, except the one being edited.
            excludeFirmIds={recommended.map((r) => r.firmId).filter((id) => id !== editingSolicitor?.firmId)}
            initialFirm={editingSolicitor ? { id: editingSolicitor.firmId, name: editingSolicitor.firmName } : undefined}
            initialFee={editingSolicitor?.defaultReferralFeePence ?? null}
            isEdit={!!editingSolicitor}
            onAdded={(f: AddedSolicitor) => {
              setRecommended((prev) => {
                const exists = prev.some((r) => r.firmId === f.firmId);
                return exists ? prev.map((r) => (r.firmId === f.firmId ? f : r)) : [...prev, f];
              });
              close();
            }}
            onCancel={close}
          />
        )}
      </PartnerPopup>
    </div>
  );
}

function ChooserOption({
  tint, icon, title, desc, onClick,
}: {
  tint: { bg: string; fg: string };
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        // stretch so the icon circle spans the full text height (title top → subtext bottom).
        display: "flex", alignItems: "stretch", gap: 18, width: "100%", textAlign: "left",
        padding: "14px 16px", borderRadius: 12, cursor: "pointer",
        background: hover ? "rgba(var(--agent-coral-rgb),0.04)" : "var(--agent-surface-glass)",
        // Fixed 1.5px border so the coral hover doesn't shift the layout.
        border: `1.5px solid ${hover ? "var(--agent-coral-deep)" : "var(--agent-border-default)"}`,
        transition: "border-color 150ms ease, background 150ms ease",
      }}
    >
      {/* Circle tracks the row height and stays round. The outer span stretches
          to the row height (a flex item); the inner takes height:100% +
          aspect-ratio:1 in a plain block context, where height→width transfers
          (it doesn't for a flex item on the main axis, which gave an oval). */}
      <span style={{ alignSelf: "stretch", flexShrink: 0 }}>
        <span style={{ height: "100%", aspectRatio: "1", borderRadius: "50%", background: tint.bg, color: tint.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.3 }}>{desc}</span>
      </span>
      <ArrowRight
        size={16}
        weight="bold"
        style={{
          alignSelf: "center",
          color: hover ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
          flexShrink: 0,
          transform: hover ? "translateX(4px)" : "translateX(0)",
          transition: "transform 150ms ease, color 150ms ease",
        }}
      />
    </button>
  );
}
