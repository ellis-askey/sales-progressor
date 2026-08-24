"use client";
// Portal menu drawer — bottom-sheet with three sections:
//   1. Your details        — Contact name / email / phone
//   2. Your solicitor      — read view + "Update details" / "Switch firm"
//   3. Notifications       — email opt-out toggle
//
// Data loads on open (getMyPortalDetailsAction). Every edit calls a
// server action that logs an internal_note on the transaction so the
// agent sees the change. Solicitor edits are copy-on-write inside the
// server action — this drawer just gathers the fields.
//
// 2026-08-09.

import { useEffect, useRef, useState, useTransition } from "react";
import { X, User, Buildings, Bell, CaretDown, Check, Wrench, ArrowRight, Camera, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { EditDrawerConfig } from "./PortalEditDrawer";

function openEditDrawer(config: EditDrawerConfig) {
  window.dispatchEvent(new CustomEvent("portal:open-edit-drawer", { detail: config }));
}

function EditPencil({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: "var(--portal-textMuted, #8B91A3)", display: "inline-flex", alignItems: "center" }}
    >
      <PencilSimple size={16} weight="regular" />
    </button>
  );
}
import { P } from "./portal-ui";
import {
  getMyPortalDetailsAction,
  updateMyNotificationsAction,
  pauseMyChasesAction,
  resumeMyChasesAction,
  type MyPortalDetails,
} from "@/app/actions/portal-menu";
import { portalMarkRequiredAction, portalMarkNotRequiredAction, getMyMoveInfoAction, getMyPortalDocumentsAction } from "@/app/actions/portal";
import type { MoveInfo, MoveInfoContext } from "@/lib/services/portal-info";
import type { PortalDocumentsData } from "@/lib/services/portal-documents";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";
import { PortalDocumentsTab } from "./PortalDocumentsTab";
import { PortalInformationTab } from "./PortalInformationTab";
import { PortalAppearanceSettings } from "./PortalAppearanceSettings";

const MENU_TABS = [
  { key: "documents", label: "Documents" },
  { key: "information", label: "Information" },
  { key: "settings", label: "Settings" },
  { key: "customisation", label: "Customisation" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  contactName: string;
  contactRole: string;
  // Deep-link target (audit #16 phase 3): when the team card's "Add" opens
  // the drawer with "agents", scroll the Your-agents section into view.
  scrollToSection?: string | null;
  // When deep-linking to the solicitor, open its edit form straight away
  // (the "add your conveyancer's email" prompt uses this).
  editSolicitor?: boolean;
  // When the add-agent drawer stacks on top, slide this one down but keep it
  // logically open, so it restores to exactly where it was on return.
  pushedDown?: boolean;
};

export function PortalMenuDrawer({ open, onClose, token, contactName, contactRole, scrollToSection, editSolicitor, pushedDown }: Props) {
  const agentsRef = useRef<HTMLDivElement>(null);
  const solicitorRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState<MyPortalDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"documents" | "information" | "settings" | "customisation">("documents");
  const { btnRefs, ind } = useTabIndicator(activeTab === "documents" ? 0 : activeTab === "information" ? 1 : activeTab === "settings" ? 2 : 3);
  // Move-info prefetched on open so the Information tab shows instantly.
  const [moveInfo, setMoveInfo] = useState<{ context: MoveInfoContext; info: MoveInfo } | null | undefined>(undefined);
  // Documents prefetched on open too — Documents is the default tab, so this
  // removes its first-open "Loading…" flash.
  const [docs, setDocs] = useState<PortalDocumentsData | null | undefined>(undefined);
  // Dynamic left/right fade on the (now-scrolling) tab row.
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [tabFade, setTabFade] = useState({ left: false, right: false });
  function updateTabFade() {
    const el = tabScrollRef.current;
    if (!el) return;
    setTabFade({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }
  // Body-content fade-in: after the drawer slides up (260ms), the
  // inner content transitions from opacity 0 → 1 over 220ms so it
  // feels like it "settles" once the drawer has arrived. Reset on
  // close so the next open re-animates.
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    if (!open) { setContentReady(false); return; }
    // Match the drawer's slide-in (260ms) so the content fade-in
    // starts exactly as the slide finishes.
    const t = window.setTimeout(() => setContentReady(true), 260);
    return () => window.clearTimeout(t);
  }, [open]);

  // Deep-link: scroll the requested section into view once content settles.
  // The team card routes here — "agents" from the selling-agent row, "solicitor"
  // from the conveyancer row.
  // The solicitor / agents sections live under the Settings tab, so a deep-link
  // must switch there first (it used to land on Documents and show nothing).
  useEffect(() => {
    if (open && (scrollToSection === "solicitor" || scrollToSection === "agents")) setActiveTab("settings");
  }, [open, scrollToSection]);

  // Switching tabs starts you back at the top of the new tab (not where the
  // last one was left). Runs before the deep-link section-scroll below, so a
  // "scroll to my solicitor" link still wins.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [activeTab]);

  useEffect(() => {
    if (!open || !contentReady || !details || activeTab !== "settings") return;
    if (scrollToSection === "agents" && agentsRef.current) {
      agentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (scrollToSection === "solicitor" && solicitorRef.current) {
      solicitorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open, contentReady, details, scrollToSection, activeTab]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body-scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Fetch on first open. Cached in state — reopens use the same snapshot
  // until an edit refreshes it via reload().
  useEffect(() => {
    if (!open || details || loading) return;
    setLoading(true);
    setLoadError(null);
    getMyPortalDetailsAction(token)
      .then((d) => setDetails(d))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, details, loading, token]);

  // Prefetch the Information-tab data on open so switching to it is instant.
  useEffect(() => {
    if (!open || moveInfo !== undefined) return;
    getMyMoveInfoAction(token).then((d) => setMoveInfo(d)).catch(() => setMoveInfo(null));
  }, [open, moveInfo, token]);

  // Prefetch the Documents tab (the default) on open so it's there immediately.
  useEffect(() => {
    if (!open || docs !== undefined) return;
    getMyPortalDocumentsAction(token).then((d) => setDocs(d)).catch(() => setDocs(null));
  }, [open, docs, token]);

  // Measure the tab-row overflow (for the edge fade) after open + on resize.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(updateTabFade, 320);
    window.addEventListener("resize", updateTabFade);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", updateTabFade); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function reload() {
    setLoading(true);
    try {
      const d = await getMyPortalDetailsAction(token);
      setDetails(d);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to reload");
    } finally {
      setLoading(false);
    }
  }

  // The stacked edit drawer fires this after saving, so the Settings view
  // refreshes (details / agent / solicitor) when it slides back up.
  useEffect(() => {
    const onUpdated = () => { if (details) void reload(); };
    window.addEventListener("portal:details-updated", onUpdated);
    return () => window.removeEventListener("portal:details-updated", onUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, token]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(15, 23, 42, 0.30)",
          backdropFilter: open && !pushedDown ? "blur(4px)" : "blur(0px)",
          WebkitBackdropFilter: open && !pushedDown ? "blur(4px)" : "blur(0px)",
          opacity: open && !pushedDown ? 1 : 0,
          pointerEvents: open && !pushedDown ? "auto" : "none",
          transition: "opacity 220ms ease, backdrop-filter 260ms ease",
        }}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Menu"
        aria-hidden={!open}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 41,
          maxHeight: "85vh",
          background: P.cardBg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.12)",
          transform: open && !pushedDown ? "translateY(0)" : "translateY(100%)",
          transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Grabber */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div aria-hidden style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(15, 23, 42, 0.12)" }} />
        </div>

        {/* Header — kicker + close, then the profile block (photo the client
            can change, name, role · address). Audit #16 phase 2. */}
        <header style={{
          padding: "8px 20px 14px",
          borderBottom: `0.5px solid ${P.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: P.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {contactRole === "vendor" ? "Your sale" : "Your purchase"}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 10,
                border: `0.5px solid ${P.border}`,
                background: P.cardBg, color: P.textSecondary, cursor: "pointer",
              }}
            >
              <X size={16} weight="bold" />
            </button>
          </div>
          <ProfileHeader
            token={token}
            name={details?.contact.name ?? contactName}
            image={details?.contact.image ?? null}
            roleLabel={contactRole === "vendor" ? "Seller" : "Buyer"}
            address={details?.propertyAddress ?? ""}
            onUploaded={reload}
          />
        </header>

        {/* Tabs — Documents | Settings. The underline slides with a little
            overshoot; a faint underline previews on hover (no icons). */}
        <div style={{ padding: "10px 20px 0", borderBottom: `0.5px solid ${P.border}` }}>
          <div
            ref={tabScrollRef}
            onScroll={updateTabFade}
            className="scrollbar-hide"
            style={{
              overflowX: "auto", overflowY: "hidden",
              // Fade only the edge that has more tabs off-screen, so text is never
              // clipped when scrolled fully to that side.
              maskImage:
                tabFade.left && tabFade.right ? "linear-gradient(to right, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%)"
                : tabFade.left ? "linear-gradient(to right, transparent 0, #000 22px, #000 100%)"
                : tabFade.right ? "linear-gradient(to right, #000 calc(100% - 22px), transparent 100%)"
                : "none",
              WebkitMaskImage:
                tabFade.left && tabFade.right ? "linear-gradient(to right, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%)"
                : tabFade.left ? "linear-gradient(to right, transparent 0, #000 22px, #000 100%)"
                : tabFade.right ? "linear-gradient(to right, #000 calc(100% - 22px), transparent 100%)"
                : "none",
            }}
          >
            <div style={{ position: "relative", display: "flex", gap: 26, width: "max-content" }}>
              {ind && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute", bottom: 0, left: ind.left, width: ind.width, height: 2,
                    background: P.primary, borderRadius: "1px 1px 0 0", pointerEvents: "none",
                    transition: "left 320ms cubic-bezier(0.34,1.5,0.6,1), width 320ms cubic-bezier(0.34,1.5,0.6,1)",
                  }}
                />
              )}
              {MENU_TABS.map((t, i) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    ref={(el) => { btnRefs.current[i] = el; }}
                    data-active={isActive ? "true" : undefined}
                    onClick={() => setActiveTab(t.key)}
                    className="portal-menu-tab"
                    style={{
                      background: "transparent", border: 0, cursor: "pointer",
                      padding: "6px 2px 12px", fontSize: 14, fontWeight: 700,
                      color: isActive ? P.textPrimary : P.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body — fades in ~220ms after the drawer finishes sliding up. */}
        <div ref={bodyRef} style={{
          flex: 1, overflow: "auto",
          padding: "20px 20px 32px",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)",
          opacity: contentReady ? 1 : 0,
          transform: contentReady ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 220ms ease-out, transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {activeTab === "documents" ? (
            <PortalDocumentsTab token={token} initialData={docs} />
          ) : activeTab === "information" ? (
            <PortalInformationTab token={token} initialData={moveInfo} />
          ) : activeTab === "customisation" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <PortalAppearanceSettings />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {loading && !details ? (
                <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="portal-shimmer" style={{ height: 11, width: "38%", borderRadius: 6 }} />
                      <div className="portal-shimmer" style={{ height: 44, width: "100%", borderRadius: 12 }} />
                    </div>
                  ))}
                </div>
              ) : loadError ? (
                <p style={{ textAlign: "center", padding: "40px 0", color: P.warning, fontSize: 13 }}>{loadError}</p>
              ) : details ? (
                <>
                  <YourDetailsSection details={details} token={token} onSaved={reload} />
                  <div ref={solicitorRef}>
                    <YourSolicitorSection details={details} token={token} onSaved={reload} autoEdit={scrollToSection === "solicitor" && !!editSolicitor} />
                  </div>
                  <div ref={agentsRef}>
                    <YourAgentsSection details={details} token={token} onSaved={reload} />
                  </div>
                  {/* Buyers: survey nudge while getting a survey is still an open
                      decision; the general "Request a quote" once it's resolved
                      (booked, already requested, or marked not required). Sellers
                      always get the general entry. */}
                  {contactRole === "purchaser" &&
                    (details.survey.applicable &&
                    !details.survey.skipped &&
                    !details.survey.booked &&
                    !details.survey.requested ? (
                      <ServicesSection token={token} survey={details.survey} onSaved={reload} />
                    ) : (
                      <RequestQuoteSection token={token} />
                    ))}
                  {contactRole === "vendor" && <RequestQuoteSection token={token} />}
                  <NotificationsSection details={details} token={token} onSaved={reload} />
                </>
              ) : null}
              <p style={{ margin: "8px 0 0", fontSize: 11, color: P.textMuted, textAlign: "center" }}>
                Signed in as {contactName}.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Profile header — photo the client can change (audit #16 phase 2)
// ═══════════════════════════════════════════════════════════════════════

function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const two = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return two.toUpperCase() || "?";
}

function ProfileHeader({
  token, name, image, roleLabel, address, onUploaded,
}: {
  token: string;
  name: string;
  image: string | null;
  roleLabel: string;
  address: string;
  onUploaded: () => void | Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/portal/${token}/upload-avatar`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed. Please try again.");
      }
      await onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 22, color: "#fff",
            background: image ? "#eee" : P.heroGradient,
            boxShadow: "0 2px 8px rgba(255,107,74,0.28)",
            overflow: "hidden",
            opacity: busy ? 0.6 : 1,
            transition: "opacity 150ms ease",
          }}
        >
          {image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={image} alt={name} width={64} height={64} style={{ width: 64, height: 64, objectFit: "cover" }} />
            : contactInitials(name)}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Change your photo"
          style={{
            position: "absolute", right: -2, bottom: -2,
            width: 26, height: 26, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: P.cardBg, border: `1px solid ${P.border}`,
            color: P.primaryText, cursor: busy ? "wait" : "pointer",
            boxShadow: P.shadowSm,
          }}
        >
          <Camera size={13} weight="fill" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPick}
          style={{ display: "none" }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: P.textPrimary, lineHeight: 1.2 }}>{name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: P.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {roleLabel}{address ? ` · ${address}` : ""}
        </p>
        {error && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: P.warning }}>{error}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Section 1 — Your details
// ═══════════════════════════════════════════════════════════════════════

function YourDetailsSection({
  details,
}: { details: MyPortalDetails; token: string; onSaved: () => void | Promise<void> }) {
  const c = details.contact;
  return (
    <SectionCard
      icon={<User size={16} weight="regular" />}
      title="Your details"
      action={<EditPencil label="Edit your details" onClick={() => openEditDrawer({ kind: "details", mode: "edit", initial: { name: c.name, email: c.email ?? "", phone: c.phone ?? "" } })} />}
    >
      <ReadRow label="Name"  value={c.name} />
      <ReadRow label="Email" value={c.email ?? "—"} />
      <ReadRow label="Phone" value={c.phone ?? "—"} />
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Section — Your agents (the client's neighbour in the chain, audit #16 p3)
// ═══════════════════════════════════════════════════════════════════════

function YourAgentsSection({
  details,
}: { details: MyPortalDetails; token: string; onSaved: () => void | Promise<void> }) {
  const ca = details.chainAgent;
  const has = ca.present && !!(ca.agentName || ca.agencyName);

  // A pure cash buyer has no related sale, so no selling agent to record.
  if (!ca.applicable) return null;

  // Add / edit now happens in the stacked edit drawer (PortalShell handles
  // sliding this settings drawer down and restoring it).
  const direction = ca.direction === "below" ? ("below" as const) : ("above" as const);
  const openAgent = (mode: "add" | "edit") =>
    openEditDrawer({
      kind: "agent",
      mode,
      direction,
      initial: {
        agency: ca.agencyName ?? "",
        agentName: ca.agentName ?? "",
        email: ca.agentEmail ?? "",
        phone: ca.agentPhone ?? "",
        propertyAddress: ca.propertyAddress ?? "",
      },
    });

  // Read-only: either the agent has joined (claimed) or we've sent a live invite
  // (invited). Claimed → theirs to keep current. Invited → locked while the
  // invite is out, with an "email us to correct" fallback.
  if (ca.present && !ca.editable) {
    return (
      <SectionCard icon={<Buildings size={16} weight="regular" />} title={ca.label}>
        <ReadRow label="Agent"  value={ca.agentName ?? "—"} />
        <ReadRow label="Agency" value={ca.agencyName ?? "—"} />
        {ca.editState === "claimed" ? (
          <p style={{ margin: "8px 4px 0", fontSize: 12, color: P.textMuted }}>
            They&apos;re on the platform now, so their details are kept up to date by them.
          </p>
        ) : (
          <>
            <p style={{ margin: "8px 4px 0", fontSize: 12, color: P.textMuted, lineHeight: 1.5 }}>
              We&apos;ve sent them an invite, so these are locked for now. If they&apos;re wrong, let us know and we&apos;ll sort it.
            </p>
            {ca.correctionMailto && (
              <SectionFooter>
                <a href={ca.correctionMailto} className="portal-menu-btn" style={btnGhost}>Email us to correct</a>
              </SectionFooter>
            )}
          </>
        )}
      </SectionCard>
    );
  }

  // Nobody to attribute a chain change to on this file yet.
  if (!ca.canManage) {
    return (
      <SectionCard icon={<Buildings size={16} weight="regular" />} title={ca.label}>
        <p style={{ margin: 0, fontSize: 13, color: P.textMuted, padding: "4px 0" }}>
          Your agent will add this for you.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={<Buildings size={16} weight="regular" />}
      title={ca.label}
      action={has ? <EditPencil label="Edit your agent" onClick={() => openAgent("edit")} /> : undefined}
    >
      {has ? (
        <>
          <ReadRow label="Agent"  value={ca.agentName ?? "—"} />
          <ReadRow label="Agency" value={ca.agencyName ?? "—"} />
          {direction === "above" && (
            <SectionFooter>
              <button type="button" onClick={() => openEditDrawer({ kind: "onward-change", mode: "change", direction: "above", initial: {} })} className="portal-menu-btn" style={btnGhost}>Change to a different place</button>
              <button type="button" onClick={() => openEditDrawer({ kind: "onward-stop", mode: "stop", initial: {} })} className="portal-menu-btn" style={btnGhost}>No longer buying onward</button>
            </SectionFooter>
          )}
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: P.textSecondary, padding: "2px 0 6px", lineHeight: 1.5 }}>
            {ca.direction === "below"
              ? "Selling somewhere too? Add the agent handling your sale so we can keep the chain moving."
              : "Buying onward? Add the agent for the place you're buying so we can keep the chain moving."}
          </p>
          <SectionFooter>
            <button type="button" onClick={() => openAgent("add")} className="portal-menu-btn" style={btnPrimary}>Add agent</button>
          </SectionFooter>
        </>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Section 2 — Your solicitor
// ═══════════════════════════════════════════════════════════════════════

function YourSolicitorSection({
  details, autoEdit,
}: { details: MyPortalDetails; token: string; onSaved: () => void | Promise<void>; autoEdit?: boolean }) {
  const sol = details.solicitor;

  const openSolicitor = (mode: "add" | "edit" | "switch") =>
    openEditDrawer({
      kind: "solicitor",
      mode,
      initial: mode === "switch"
        ? {}
        : {
            firmName: sol?.firmName ?? "",
            contactName: sol?.contactName ?? "",
            email: sol?.email ?? "",
            phone: sol?.phone ?? "",
          },
    });

  // Deep-link (the "add your conveyancer's email" prompt) opens edit straight away.
  useEffect(() => {
    if (autoEdit && sol) openSolicitor("edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  return (
    <SectionCard
      icon={<Buildings size={16} weight="regular" />}
      title="Your solicitor"
      action={sol ? <EditPencil label="Edit your solicitor" onClick={() => openSolicitor("edit")} /> : undefined}
    >
      {!sol ? (
        <>
          <p style={{ margin: 0, fontSize: 13, color: P.textMuted, padding: "2px 0 6px" }}>
            No solicitor set for your file yet.
          </p>
          <SectionFooter>
            <button type="button" onClick={() => openSolicitor("add")} className="portal-menu-btn" style={btnPrimary}>Add solicitor</button>
          </SectionFooter>
        </>
      ) : (
        <>
          <ReadRow label="Firm"    value={sol.firmName} />
          <ReadRow label="Handler" value={sol.contactName ?? "—"} />
          <ReadRow label="Email"   value={sol.email ?? "—"} />
          <ReadRow label="Phone"   value={sol.phone ?? "—"} />
          <SectionFooter>
            <button type="button" onClick={() => openSolicitor("switch")} className="portal-menu-btn" style={btnGhost}>Switch firm</button>
          </SectionFooter>
        </>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Section 3 — Notifications
// ═══════════════════════════════════════════════════════════════════════

function NotificationsSection({
  details, token, onSaved,
}: { details: MyPortalDetails; token: string; onSaved: () => void | Promise<void> }) {
  const [busy, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const emailOn = !details.contact.emailOptedOut;

  const pausedUntil = details.contact.chasesPausedUntil ? new Date(details.contact.chasesPausedUntil) : null;
  const isPaused = pausedUntil != null && pausedUntil.getTime() > Date.now();
  const pausedLabel = pausedUntil?.toLocaleDateString("en-GB", { day: "numeric", month: "long" });

  function flashSaved() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }
  function pause(weeks: number) {
    startTransition(async () => {
      const res = await pauseMyChasesAction({ token, weeks });
      if (res.ok) { flashSaved(); await onSaved(); }
    });
  }
  function resume() {
    startTransition(async () => {
      const res = await resumeMyChasesAction({ token });
      if (res.ok) { flashSaved(); await onSaved(); }
    });
  }

  return (
    <SectionCard icon={<Bell size={16} weight="regular" />} title="Notifications">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 0",
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>Update emails</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: P.textMuted }}>
            Occasional emails when there&apos;s something to know.
          </p>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", cursor: busy ? "wait" : "pointer" }}>
          <input
            type="checkbox"
            checked={emailOn}
            disabled={busy}
            onChange={(e) => {
              const nextOn = e.target.checked;
              startTransition(async () => {
                const res = await updateMyNotificationsAction({ token, emailOptedOut: !nextOn });
                if (res.ok) {
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 1600);
                  await onSaved();
                }
              });
            }}
            style={{ appearance: "none", width: 44, height: 26, borderRadius: 999, background: emailOn ? P.primary : "rgba(15,23,42,0.15)", position: "relative", cursor: "inherit", transition: "background 150ms ease", flexShrink: 0 }}
          />
          <span aria-hidden style={{
            width: 20, height: 20, borderRadius: 999,
            background: "#fff",
            marginLeft: -42, marginRight: 22,
            transform: emailOn ? "translateX(20px)" : "translateX(2px)",
            transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 1px 3px rgba(15,23,42,0.2)",
            pointerEvents: "none",
          }} />
        </label>
      </div>

      {/* Pause chase reminders (audit #11 / #15). Only chases pause; the
          important updates keep coming, and it lifts itself when the time's up. */}
      <div style={{ borderTop: `1px solid ${P.borderSubtle}`, marginTop: 4, paddingTop: 12 }}>
        {isPaused ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>Reminders paused</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: P.textMuted }}>
                Until {pausedLabel}. Your other updates still come through.
              </p>
            </div>
            <button type="button" onClick={resume} disabled={busy} className="portal-menu-btn" style={btnGhost}>Turn back on</button>
          </div>
        ) : (
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>Pause reminders</p>
            <p style={{ margin: "2px 0 8px", fontSize: 12, color: P.textMuted }}>
              Going away? Pause chase reminders. Your important updates still come through.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => pause(1)} disabled={busy} className="portal-menu-btn" style={btnGhost}>Pause 1 week</button>
              <button type="button" onClick={() => pause(2)} disabled={busy} className="portal-menu-btn" style={btnGhost}>Pause 2 weeks</button>
            </div>
          </div>
        )}
      </div>

      {saved && (
        <div style={{ paddingTop: 4 }}>
          <SavedFlash />
        </div>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Request a quote — sellers' entry to /quote/[token]. Buyers reach the same
//  picker via their survey prompt; this gives sellers a general entry so they
//  can request a structural engineer, surveyor or mortgage broker too.
// ═══════════════════════════════════════════════════════════════════════

function RequestQuoteSection({ token }: { token: string }) {
  return (
    <SectionCard icon={<Wrench size={16} weight="regular" />} title="Request a quote">
      <p style={{ margin: "0 0 10px", fontSize: 13, color: P.textSecondary, lineHeight: 1.5 }}>
        Need a surveyor, structural engineer or mortgage broker? Tell us what you need and we&apos;ll match you with firms that cover your area.
      </p>
      <a
        href={`/quote/${token}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "10px 12px", borderRadius: 10, border: `1px solid ${P.border}`,
          background: P.primaryBg, color: P.primary, textDecoration: "none", fontSize: 13, fontWeight: 600,
        }}
      >
        <span>Request a quote</span>
        <ArrowRight size={14} weight="bold" />
      </a>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Section 4 — Services (buyers only, links to /quote/[token])
// ═══════════════════════════════════════════════════════════════════════

function ServicesSection({
  token, survey, onSaved,
}: { token: string; survey: MyPortalDetails["survey"]; onSaved: () => void | Promise<void> }) {
  const [busy, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const gettingSurvey = !survey.skipped;
  // Skipped late (enquiries answered) — no self re-enable, must email progressor.
  const lockedOff = survey.skipped && !survey.canReenable;

  function flashSaved() { setSaved(true); window.setTimeout(() => setSaved(false), 1600); }

  function turnOff() {
    if (!survey.definitionId || busy) return;
    const defId = survey.definitionId;
    startTransition(async () => {
      await portalMarkNotRequiredAction({ token, milestoneDefinitionId: defId });
      setConfirmingOff(false);
      flashSaved();
      await onSaved();
    });
  }
  function turnOn() {
    if (!survey.definitionId || busy) return;
    const defId = survey.definitionId;
    startTransition(async () => {
      await portalMarkRequiredAction({ token, milestoneDefinitionId: defId });
      flashSaved();
      await onSaved();
    });
  }

  const mailto = survey.progressorEmail
    ? `mailto:${survey.progressorEmail}?subject=${encodeURIComponent("I'd like to add a survey")}`
    : null;

  return (
    <SectionCard icon={<Wrench size={16} weight="regular" />} title="Services">
      {survey.applicable && (
        <div style={{ paddingBottom: 12 }}>
          {lockedOff ? (
            /* Late: enquiries answered, can't quietly re-add — email the progressor. */
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>No survey on your file</p>
              <p style={{ margin: "2px 0 10px", fontSize: 12, color: P.textMuted, lineHeight: 1.45 }}>
                Your solicitor&apos;s enquiries have already been satisfied. If you&apos;d now like to add a survey, please speak to your progressor{survey.progressorName ? `, ${survey.progressorName}` : ""}.
              </p>
              {mailto && (
                <a
                  href={mailto}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.primaryBg, color: P.primary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}
                >
                  <span>Email your progressor</span>
                  <ArrowRight size={14} weight="bold" />
                </a>
              )}
            </div>
          ) : confirmingOff ? (
            /* Confirm turning the survey off. */
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>Not getting a survey?</p>
              <p style={{ margin: "2px 0 12px", fontSize: 12, color: P.textMuted, lineHeight: 1.45 }}>
                This will confirm to us and the other side that you&apos;re not getting a survey. You can change this at any time until your solicitor&apos;s enquiries have been satisfied.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setConfirmingOff(false)} disabled={busy} className="portal-menu-btn" style={btnGhost}>Cancel</button>
                <button type="button" onClick={turnOff} disabled={busy} className="portal-menu-btn" style={btnPrimary}>{busy ? "Saving…" : "Yes, I'm not getting a survey"}</button>
              </div>
            </div>
          ) : (
            /* Toggle row. On → off asks to confirm; off → on re-enables directly. */
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>Getting a survey</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: P.textMuted, lineHeight: 1.45 }}>
                  {gettingSurvey
                    ? "Turn this off if you're not getting a survey."
                    : "Turn this back on if you decide to get a survey."}
                </p>
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", cursor: busy ? "wait" : "pointer", flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={gettingSurvey}
                  disabled={busy}
                  onChange={(e) => (e.target.checked ? turnOn() : setConfirmingOff(true))}
                  style={{ appearance: "none", width: 44, height: 26, borderRadius: 999, background: gettingSurvey ? P.primary : "rgba(15,23,42,0.15)", position: "relative", cursor: "inherit", transition: "background 150ms ease", flexShrink: 0 }}
                />
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: 999, background: "#fff", marginLeft: -42, marginRight: 22, transform: gettingSurvey ? "translateX(20px)" : "translateX(2px)", transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 1px 3px rgba(15,23,42,0.2)", pointerEvents: "none" }} />
              </label>
            </div>
          )}
        </div>
      )}

      {gettingSurvey && !confirmingOff && (
        <div style={{ borderTop: survey.applicable ? `0.5px solid ${P.borderSubtle}` : undefined, paddingTop: survey.applicable ? 12 : 0 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: P.textSecondary, lineHeight: 1.5 }}>
            Getting a survey is worth it for most purchases. We&apos;ll match you with local firms that cover your area.
          </p>
          <a
            href={`/quote/${token}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              padding: "10px 12px", borderRadius: 10, border: `1px solid ${P.border}`,
              background: P.primaryBg, color: P.primary, textDecoration: "none", fontSize: 13, fontWeight: 600,
            }}
          >
            <span>Get a survey quote</span>
            <ArrowRight size={14} weight="bold" />
          </a>
        </div>
      )}

      {saved && <div style={{ paddingTop: 10 }}><SavedFlash /></div>}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Shared primitives
// ═══════════════════════════════════════════════════════════════════════

function SectionCard({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{
      borderRadius: 14,
      border: `0.5px solid ${P.border}`,
      padding: "14px 16px 16px",
      background: P.cardBg,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8,
          background: P.primaryBg, color: P.primary,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: P.textPrimary, flex: 1 }}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `0.5px solid ${P.borderSubtle}` }}>
      <span style={{ fontSize: 12, color: P.textMuted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: P.textPrimary, fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}


function SectionFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
      {children}
    </div>
  );
}

function SavedFlash() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: P.success }}>
      <Check size={13} weight="bold" /> Saved
    </span>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 10,
  border: "none",
  background: P.primary,
  color: "#fff",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 500,
  borderRadius: 10,
  border: `0.5px solid ${P.border}`,
  background: P.cardBg,
  color: P.textPrimary,
  cursor: "pointer",
};

// Unused CaretDown import silencer — kept for the potential accordion
// pass in a follow-up.
void CaretDown;
