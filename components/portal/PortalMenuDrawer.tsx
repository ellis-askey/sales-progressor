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
import { X, User, Buildings, Bell, CaretDown, Check, Wrench, ArrowRight, Camera } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";
import {
  getMyPortalDetailsAction,
  updateMyContactAction,
  updateMySolicitorContactAction,
  switchMySolicitorFirmAction,
  updateMyNotificationsAction,
  updateMyChainAgentAction,
  pauseMyChasesAction,
  resumeMyChasesAction,
  type MyPortalDetails,
} from "@/app/actions/portal-menu";
import { portalMarkRequiredAction, portalMarkNotRequiredAction } from "@/app/actions/portal";

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  contactName: string;
  contactRole: string;
  // Deep-link target (audit #16 phase 3): when the team card's "Add" opens
  // the drawer with "agents", scroll the Your-agents section into view.
  scrollToSection?: string | null;
};

export function PortalMenuDrawer({ open, onClose, token, contactName, contactRole, scrollToSection }: Props) {
  const agentsRef = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState<MyPortalDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Deep-link: scroll the Your-agents section into view once content settles.
  useEffect(() => {
    if (!open || !contentReady || !details) return;
    if (scrollToSection === "agents" && agentsRef.current) {
      agentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open, contentReady, details, scrollToSection]);

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

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(15, 23, 42, 0.30)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 220ms ease",
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
          transform: open ? "translateY(0)" : "translateY(100%)",
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
                background: "#fff", color: P.textSecondary, cursor: "pointer",
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

        {/* Body — fades in ~220ms after the drawer finishes sliding up. */}
        <div style={{
          flex: 1, overflow: "auto",
          padding: "20px 20px 32px",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)",
          opacity: contentReady ? 1 : 0,
          transform: contentReady ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 220ms ease-out, transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {loading && !details ? (
            <p style={{ textAlign: "center", padding: "40px 0", color: P.textMuted, fontSize: 13 }}>Loading…</p>
          ) : loadError ? (
            <p style={{ textAlign: "center", padding: "40px 0", color: P.warning, fontSize: 13 }}>{loadError}</p>
          ) : details ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <YourDetailsSection details={details} token={token} onSaved={reload} />
              <YourSolicitorSection details={details} token={token} onSaved={reload} />
              <div ref={agentsRef}>
                <YourAgentsSection details={details} token={token} onSaved={reload} />
              </div>
              {contactRole === "purchaser" && <ServicesSection token={token} survey={details.survey} onSaved={reload} />}
              <NotificationsSection details={details} token={token} onSaved={reload} />
              <p style={{ margin: "8px 0 0", fontSize: 11, color: P.textMuted, textAlign: "center" }}>
                Signed in as {contactName}.
              </p>
            </div>
          ) : null}
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
            background: "#fff", border: `1px solid ${P.border}`,
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
  details, token, onSaved,
}: { details: MyPortalDetails; token: string; onSaved: () => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]   = useState(details.contact.name);
  const [email, setEmail] = useState(details.contact.email ?? "");
  const [phone, setPhone] = useState(details.contact.phone ?? "");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!editing) {
      setName(details.contact.name);
      setEmail(details.contact.email ?? "");
      setPhone(details.contact.phone ?? "");
    }
  }, [editing, details]);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateMyContactAction({
        token, name, email: email || null, phone: phone || null,
      });
      if (res.ok) {
        setEditing(false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
        await onSaved();
      } else {
        setError(res.error ?? "Failed to save");
      }
    });
  }

  return (
    <SectionCard icon={<User size={16} weight="regular" />} title="Your details">
      {!editing ? (
        <>
          <ReadRow label="Name"  value={details.contact.name} />
          <ReadRow label="Email" value={details.contact.email ?? "—"} />
          <ReadRow label="Phone" value={details.contact.phone ?? "—"} />
          <SectionFooter>
            <button type="button" onClick={() => setEditing(true)} className="portal-menu-btn" style={btnPrimary}>Edit</button>
            {saved && <SavedFlash />}
          </SectionFooter>
        </>
      ) : (
        <>
          <Field label="Name"  value={name}  onChange={setName}  />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
          {error && <p style={{ margin: "6px 4px 0", color: P.warning, fontSize: 12 }}>{error}</p>}
          <SectionFooter>
            <button type="button" onClick={() => setEditing(false)} disabled={busy} className="portal-menu-btn" style={btnGhost}>Cancel</button>
            <button type="button" onClick={save} disabled={busy} className="portal-menu-btn" style={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
          </SectionFooter>
        </>
      )}
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Section — Your agents (the client's neighbour in the chain, audit #16 p3)
// ═══════════════════════════════════════════════════════════════════════

function YourAgentsSection({
  details, token, onSaved,
}: { details: MyPortalDetails; token: string; onSaved: () => void | Promise<void> }) {
  const ca = details.chainAgent;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const has = ca.present && !!(ca.agentName || ca.agencyName);

  function onSaveDone() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    setEditing(false);
    void onSaved();
  }

  // The other agent has joined the platform — their details are theirs now.
  if (ca.present && !ca.editable) {
    return (
      <SectionCard icon={<Buildings size={16} weight="regular" />} title={ca.label}>
        <ReadRow label="Agent"  value={ca.agentName ?? "—"} />
        <ReadRow label="Agency" value={ca.agencyName ?? "—"} />
        <p style={{ margin: "8px 4px 0", fontSize: 12, color: P.textMuted }}>
          They&apos;re on the platform now, so their details are kept up to date by them.
        </p>
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

  if (editing) {
    return (
      <SectionCard icon={<Buildings size={16} weight="regular" />} title={ca.label}>
        <AgentEditForm
          token={token}
          initialAgent={ca.agentName ?? ""}
          initialAgency={ca.agencyName ?? ""}
          initialEmail={ca.agentEmail ?? ""}
          initialPhone={ca.agentPhone ?? ""}
          initialAddress={ca.propertyAddress ?? ""}
          onCancel={() => setEditing(false)}
          onSaved={onSaveDone}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={<Buildings size={16} weight="regular" />} title={ca.label}>
      {has ? (
        <>
          <ReadRow label="Agent"  value={ca.agentName ?? "—"} />
          <ReadRow label="Agency" value={ca.agencyName ?? "—"} />
          <SectionFooter>
            <button type="button" onClick={() => setEditing(true)} className="portal-menu-btn" style={btnGhost}>Update</button>
            {saved && <SavedFlash />}
          </SectionFooter>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: P.textSecondary, padding: "2px 0 6px", lineHeight: 1.5 }}>
            {ca.direction === "below"
              ? "Selling somewhere too? Add the agent handling your sale so we can keep the chain moving."
              : "Buying onward? Add the agent for the place you're buying so we can keep the chain moving."}
          </p>
          <SectionFooter>
            <button type="button" onClick={() => setEditing(true)} className="portal-menu-btn" style={btnPrimary}>Add agent</button>
          </SectionFooter>
        </>
      )}
    </SectionCard>
  );
}

function AgentEditForm({
  token, initialAgent, initialAgency, initialEmail, initialPhone, initialAddress, onCancel, onSaved,
}: {
  token: string;
  initialAgent: string; initialAgency: string; initialEmail: string; initialPhone: string; initialAddress: string;
  onCancel: () => void; onSaved: () => void;
}) {
  const [agent, setAgent]     = useState(initialAgent);
  const [agency, setAgency]   = useState(initialAgency);
  const [email, setEmail]     = useState(initialEmail);
  const [phone, setPhone]     = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateMyChainAgentAction({
        token,
        agentName: agent || null,
        agencyName: agency || null,
        agentEmail: email || null,
        agentPhone: phone || null,
        propertyAddress: address || null,
      });
      if (res.ok) onSaved();
      else setError(res.error ?? "Failed to save");
    });
  }

  return (
    <>
      <Field label="Agent name" value={agent}  onChange={setAgent} />
      <Field label="Agency"     value={agency} onChange={setAgency} />
      <Field label="Email"      value={email}  onChange={setEmail} type="email" />
      <Field label="Phone"      value={phone}  onChange={setPhone} type="tel" />
      <Field label="Property address (optional)" value={address} onChange={setAddress} />
      <p style={{ margin: "6px 4px 0", fontSize: 11.5, color: P.textMuted, lineHeight: 1.5 }}>
        We won&apos;t contact them automatically. Your progressor will see this and decide the next step.
      </p>
      {error && <p style={{ margin: "6px 4px 0", color: P.warning, fontSize: 12 }}>{error}</p>}
      <SectionFooter>
        <button type="button" onClick={onCancel} disabled={busy} className="portal-menu-btn" style={btnGhost}>Cancel</button>
        <button type="button" onClick={save} disabled={busy} className="portal-menu-btn" style={btnPrimary}>{busy ? "Saving…" : "Save"}</button>
      </SectionFooter>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  Section 2 — Your solicitor
// ═══════════════════════════════════════════════════════════════════════

function YourSolicitorSection({
  details, token, onSaved,
}: { details: MyPortalDetails; token: string; onSaved: () => void | Promise<void> }) {
  type Mode = "read" | "update" | "switch";
  const [mode, setMode] = useState<Mode>("read");
  const [saved, setSaved] = useState(false);

  const sol = details.solicitor;

  function onSaveDone() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    setMode("read");
    void onSaved();
  }

  return (
    <SectionCard icon={<Buildings size={16} weight="regular" />} title="Your solicitor">
      {!sol ? (
        <p style={{ margin: 0, fontSize: 13, color: P.textMuted, padding: "4px 0" }}>
          No solicitor set for your file yet. Add one below.
        </p>
      ) : mode === "read" ? (
        <>
          <ReadRow label="Firm"    value={sol.firmName} />
          <ReadRow label="Handler" value={sol.contactName ?? "—"} />
          <ReadRow label="Email"   value={sol.email ?? "—"} />
          <ReadRow label="Phone"   value={sol.phone ?? "—"} />
          <SectionFooter>
            <button type="button" onClick={() => setMode("update")} className="portal-menu-btn" style={btnGhost}>Update details</button>
            <button type="button" onClick={() => setMode("switch")} className="portal-menu-btn" style={btnGhost}>Switch firm</button>
            {saved && <SavedFlash />}
          </SectionFooter>
        </>
      ) : null}

      {mode === "update" && sol && (
        <UpdateSolicitorForm
          token={token}
          initialName={sol.contactName ?? ""}
          initialEmail={sol.email ?? ""}
          initialPhone={sol.phone ?? ""}
          firmName={sol.firmName}
          onCancel={() => setMode("read")}
          onSaved={onSaveDone}
        />
      )}

      {(mode === "switch" || !sol) && (
        <SwitchFirmForm
          token={token}
          onCancel={() => setMode("read")}
          onSaved={onSaveDone}
          initialFirm=""
        />
      )}
    </SectionCard>
  );
}

function UpdateSolicitorForm({
  token, initialName, initialEmail, initialPhone, firmName, onCancel, onSaved,
}: {
  token: string; initialName: string; initialEmail: string; initialPhone: string;
  firmName: string;
  onCancel: () => void; onSaved: () => void;
}) {
  const [name, setName]   = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div style={{ padding: "8px 4px 4px" }}>
        <p style={{ margin: 0, fontSize: 12, color: P.textMuted, lineHeight: 1.4 }}>
          Updating details for <strong style={{ color: P.textSecondary }}>{firmName}</strong>. Other files with this firm aren&apos;t affected. We save your changes just for your sale.
        </p>
      </div>
      <Field label="Handler name" value={name}  onChange={setName}  />
      <Field label="Email"        value={email} onChange={setEmail} type="email" />
      <Field label="Phone"        value={phone} onChange={setPhone} type="tel"   />
      {error && <p style={{ margin: "6px 4px 0", color: P.warning, fontSize: 12 }}>{error}</p>}
      <SectionFooter>
        <button type="button" onClick={onCancel} disabled={busy} className="portal-menu-btn" style={btnGhost}>Cancel</button>
        <button
          type="button"
          disabled={busy}
          className="portal-menu-btn"
          style={btnPrimary}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await updateMySolicitorContactAction({ token, name, email: email || null, phone: phone || null });
              if (res.ok) onSaved(); else setError(res.error ?? "Failed to save");
            });
          }}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </SectionFooter>
    </>
  );
}

function SwitchFirmForm({
  token, initialFirm, onCancel, onSaved,
}: {
  token: string; initialFirm: string;
  onCancel: () => void; onSaved: () => void;
}) {
  const [firmName, setFirmName]       = useState(initialFirm);
  const [contactName, setContactName] = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div style={{ padding: "8px 4px 4px" }}>
        <p style={{ margin: 0, fontSize: 12, color: P.textMuted, lineHeight: 1.4 }}>
          Moving to a different firm entirely? Enter the new firm and your case handler.
        </p>
      </div>
      <Field label="Firm name"    value={firmName}    onChange={setFirmName}    />
      <Field label="Handler name" value={contactName} onChange={setContactName} />
      <Field label="Email"        value={email}       onChange={setEmail}       type="email" />
      <Field label="Phone"        value={phone}       onChange={setPhone}       type="tel"   />
      {error && <p style={{ margin: "6px 4px 0", color: P.warning, fontSize: 12 }}>{error}</p>}
      <SectionFooter>
        <button type="button" onClick={onCancel} disabled={busy} className="portal-menu-btn" style={btnGhost}>Cancel</button>
        <button
          type="button"
          disabled={busy}
          className="portal-menu-btn"
          style={btnPrimary}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await switchMySolicitorFirmAction({
                token, firmName, contactName, email: email || null, phone: phone || null,
              });
              if (res.ok) onSaved(); else setError(res.error ?? "Failed to switch firm");
            });
          }}
        >
          {busy ? "Switching…" : "Switch firm"}
        </button>
      </SectionFooter>
    </>
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
                Your enquiries have been answered, so to add a survey now please talk to your progressor{survey.progressorName ? ` (${survey.progressorName})` : ""}.
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
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>Mark no survey?</p>
              <p style={{ margin: "2px 0 12px", fontSize: 12, color: P.textMuted, lineHeight: 1.45 }}>
                This marks the survey as not required. We and the other side will see you&apos;re not getting a survey. You can turn it back on here until your enquiries are answered.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setConfirmingOff(false)} disabled={busy} className="portal-menu-btn" style={btnGhost}>Cancel</button>
                <button type="button" onClick={turnOff} disabled={busy} className="portal-menu-btn" style={btnPrimary}>{busy ? "Saving…" : "Yes, no survey"}</button>
              </div>
            </div>
          ) : (
            /* Toggle row. On → off asks to confirm; off → on re-enables directly. */
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.textPrimary }}>Getting a survey</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: P.textMuted, lineHeight: 1.45 }}>
                  {gettingSurvey
                    ? "Turn off if you're not getting a survey."
                    : "Turn back on to add the survey to your progress."}
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

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section style={{
      borderRadius: 14,
      border: `0.5px solid ${P.border}`,
      padding: "14px 16px 16px",
      background: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8,
          background: P.primaryBg, color: P.primary,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: P.textPrimary }}>{title}</h3>
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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label style={{ display: "block", padding: "8px 0" }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: P.textSecondary, marginBottom: 4 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 14,
          borderRadius: 10,
          border: `0.5px solid ${P.border}`,
          background: "#fff",
          color: P.textPrimary,
          outline: "none",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = P.primary; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = P.border; }}
      />
    </label>
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
  background: "#fff",
  color: P.textPrimary,
  cursor: "pointer",
};

// Unused CaretDown import silencer — kept for the potential accordion
// pass in a follow-up.
void CaretDown;
