"use client";

// Agent file tab → "Client portal".
//
// A read-only window onto exactly what each client sees in their own portal,
// rendered inch-for-inch inside a phone frame via an iframe pointing at the real
// /portal/{token} route. Because the agent has a session, the portal renders in
// its read-only mode (see lib/portal/preview.ts): the agent can navigate freely
// and every tap animates, but nothing writes and no visit/engagement is logged —
// they're looking through the glass, not stepping into the house.
//
// Beside the preview sits the invite card: add a client (which side they're on,
// name, email) and send them their portal link in one press — the normal
// add-contact-and-invite flow, surfaced where the agent can see the portal. When
// the file has no portal clients yet (e.g. a just-claimed sale), the card leads.

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { inviteNewClientToPortalAction, resendPortalInviteAction } from "@/app/actions/portal-invite";

export type PortalPreviewClient = {
  id: string;
  name: string;
  roleType: string;
  token: string;
};

function roleLabel(roleType: string): string {
  return roleType === "vendor" ? "Seller" : "Buyer";
}

export function ClientPortalPreview({
  clients,
  transactionId,
}: {
  clients: PortalPreviewClient[];
  transactionId: string;
}) {
  const [active, setActive] = useState(0);
  const activeClient = clients[active] ?? null;

  // Sliding pill across the client names (the app's measured-indicator pattern —
  // no framer-motion). Re-measures when the client list changes.
  const { btnRefs, ind } = useTabIndicator(active, clients.length);

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Loading shimmer while the framed portal boots / switches client.
  const [loaded, setLoaded] = useState(false);
  const lastToken = useRef<string | null>(null);
  useEffect(() => {
    if (activeClient && lastToken.current !== activeClient.token) {
      lastToken.current = activeClient.token;
      setLoaded(false);
    }
  }, [activeClient]);

  // ── Empty: no portal clients yet. Lead with the invite card. ──
  if (clients.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "8px auto 0" }}>
        <p style={{ textAlign: "center", fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-muted)", margin: "0 0 16px" }}>
          No one&apos;s on the portal for this file yet. Add your client and send them their link — they&apos;ll get a live view of
          their {" "}sale, and can confirm their own steps.
        </p>
        <InviteCard transactionId={transactionId} lead />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 940, margin: "0 auto" }}>
      {/* Intro — sets the agent's expectation: this is a window, not a control panel. */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-muted)", maxWidth: 480, margin: "0 auto" }}>
          This is exactly what your client sees, live. You can tap around freely to explore it,
          but you&apos;re only looking, nothing here changes their file.
        </p>
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        {/* ── Left: switcher + framed portal ── */}
        <div style={{ flex: "0 0 auto", maxWidth: "100%" }}>
          {/* Client switcher — sliding pill across correctly-phrased names. */}
          {clients.length > 1 && (
            <div
              role="tablist"
              aria-label="Choose a client"
              style={{
                position: "relative",
                display: "flex",
                gap: 2,
                padding: 4,
                borderRadius: 999,
                background: "var(--agent-surface-sunken, rgba(120,120,130,0.10))",
                border: "1px solid var(--agent-border-subtle)",
                maxWidth: 390,
                margin: "0 auto 16px",
              }}
            >
              {ind && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 4,
                    bottom: 4,
                    left: ind.left,
                    width: ind.width,
                    borderRadius: 999,
                    background: "var(--agent-surface-elevated, #fff)",
                    boxShadow: "0 1px 3px rgba(15,23,42,0.16)",
                    transition: reduced ? "none" : "left 260ms cubic-bezier(0.16,1,0.3,1), width 260ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              )}
              {clients.map((c, i) => {
                const on = i === active;
                return (
                  <button
                    key={c.id}
                    ref={(el) => { btnRefs.current[i] = el; }}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActive(i)}
                    style={{
                      position: "relative",
                      zIndex: 1,
                      flex: 1,
                      minWidth: 0,
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontFamily: "inherit",
                      fontSize: 13.5,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: on ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
                      transition: "color 180ms ease",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Role caption for the framed client. */}
          {activeClient && (
            <p
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--agent-text-muted)",
                marginBottom: 12,
              }}
            >
              {roleLabel(activeClient.roleType)}
              {clients.length === 1 ? ` · ${activeClient.name}` : ""}
            </p>
          )}

          {/* Phone frame — the real portal in an iframe, sized like a handset. */}
          {activeClient && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  position: "relative",
                  width: 390,
                  maxWidth: "100%",
                  padding: 12,
                  borderRadius: 52,
                  background: "linear-gradient(160deg, #16171b, #050506)",
                  boxShadow: "0 28px 60px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 128,
                    height: 26,
                    borderRadius: 999,
                    background: "#050506",
                    zIndex: 3,
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    borderRadius: 40,
                    overflow: "hidden",
                    background: "#f6f8fc",
                    height: "min(78vh, 812px)",
                  }}
                >
                  {!loaded && (
                    <div
                      aria-hidden
                      style={{ position: "absolute", inset: 0, zIndex: 2, display: "grid", placeItems: "center", background: "#f6f8fc" }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          border: "3px solid rgba(15,23,42,0.14)",
                          borderTopColor: "rgba(15,23,42,0.45)",
                          animation: reduced ? "none" : "cpp-spin 0.8s linear infinite",
                        }}
                      />
                    </div>
                  )}
                  <iframe
                    key={activeClient.token}
                    src={`/portal/${activeClient.token}`}
                    title={`Client portal preview for ${activeClient.name}`}
                    onLoad={() => setLoaded(true)}
                    style={{ display: "block", width: "100%", height: "100%", border: 0 }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: invite / manage access ── */}
        <div style={{ flex: "1 1 300px", minWidth: 280, maxWidth: 380 }}>
          <InviteCard transactionId={transactionId} />
          {clients.length > 0 && <ResendList clients={clients} />}
        </div>
      </div>

      <style>{`@keyframes cpp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Invite a new client (role + name + email → create contact + send link) ──
function InviteCard({ transactionId, lead = false }: { transactionId: string; lead?: boolean }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await inviteNewClientToPortalAction({ transactionId, name, email, role });
      if (res.ok) {
        toast.success("Client added, portal link sent");
        setName("");
        setEmail("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div
      style={{
        border: "1px solid rgba(var(--agent-coral-rgb), 0.35)",
        background: "linear-gradient(180deg, rgba(var(--agent-coral-rgb),0.05), var(--agent-surface-elevated, #fff))",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-coral-deep)" }}>
        Portal access
      </span>
      <h3 style={{ margin: "7px 0 6px", fontSize: 17, fontWeight: 740, color: "var(--agent-text-primary)" }}>
        {lead ? "Give your client their portal" : "Add another client"}
      </h3>
      <p style={{ margin: "0 0 15px", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
        A live view of their {role === "seller" ? "sale" : "purchase"} — progress, updates, and the option to confirm their own steps.
        Sent from you, stays on your file, never shared with other agents.
      </p>

      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--agent-text-secondary)", marginBottom: 5 }}>
        They&apos;re the…
      </label>
      <div
        role="tablist"
        aria-label="Client side"
        style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "rgba(var(--agent-text-muted-rgb, 120,120,130),0.10)", border: "1px solid var(--agent-border-default)", marginBottom: 12 }}
      >
        {(["seller", "buyer"] as const).map((r) => {
          const on = role === r;
          return (
            <button
              key={r}
              role="tab"
              aria-selected={on}
              onClick={() => setRole(r)}
              style={{
                border: 0,
                cursor: "pointer",
                padding: "7px 20px",
                borderRadius: 8,
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 700,
                background: on ? "var(--agent-surface-elevated, #fff)" : "transparent",
                boxShadow: on ? "0 1px 3px rgba(15,23,42,0.14)" : "none",
                color: on ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
                textTransform: "capitalize",
              }}
            >
              {r}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <input
          className="agent-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client name"
          style={{ fontSize: 13.5, padding: "9px 11px" }}
        />
        <input
          className="agent-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ fontSize: 13.5, padding: "9px 11px" }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
      </div>

      {error && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--agent-danger)" }}>{error}</p>}

      <button
        onClick={submit}
        disabled={pending || !name.trim() || !email.trim()}
        style={{
          marginTop: 14,
          width: "100%",
          border: "1px solid transparent",
          borderRadius: 10,
          padding: "11px 18px",
          fontFamily: "inherit",
          fontSize: 13.5,
          fontWeight: 700,
          color: "#fff",
          background: "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
          cursor: pending || !name.trim() || !email.trim() ? "default" : "pointer",
          opacity: pending || !name.trim() || !email.trim() ? 0.6 : 1,
        }}
      >
        {pending ? "Sending…" : "Add & send portal invite"}
      </button>
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--agent-success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <span aria-hidden>✓</span> Saves them to this file&apos;s contacts and sends their portal link
      </p>
    </div>
  );
}

// ── Resend an existing client their portal link ──
function ResendList({ clients }: { clients: PortalPreviewClient[] }) {
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function resend(c: PortalPreviewClient) {
    setBusy(c.token);
    const res = await resendPortalInviteAction(c.token);
    if (res.ok) toast.success(`Portal link resent to ${c.name}`);
    else toast.error(res.error ?? "Couldn't resend. Try again.");
    setBusy(null);
  }

  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 7px" }}>
        On the portal
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {clients.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 2px", borderTop: "0.5px solid var(--agent-border-subtle)" }}>
            <span style={{ fontSize: 13, color: "var(--agent-text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.name} <span style={{ color: "var(--agent-text-muted)", fontSize: 11.5 }}>· {roleLabel(c.roleType)}</span>
            </span>
            <button
              onClick={() => resend(c)}
              disabled={busy === c.token}
              className="agent-link"
              style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-coral-deep)", flexShrink: 0, cursor: busy === c.token ? "wait" : "pointer", background: "none", border: 0 }}
            >
              {busy === c.token ? "Sending…" : "Resend link"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
