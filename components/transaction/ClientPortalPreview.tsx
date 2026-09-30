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
// The switcher slides between each client on the file (correctly-phrased full
// names, no titles), swapping the framed portal to that person's view.

import { useState, useEffect, useRef } from "react";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";

export type PortalPreviewClient = {
  id: string;
  name: string;
  roleType: string;
  token: string;
};

function roleLabel(roleType: string): string {
  return roleType === "vendor" ? "Seller" : "Buyer";
}

export function ClientPortalPreview({ clients }: { clients: PortalPreviewClient[] }) {
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

  if (clients.length === 0) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px dashed var(--agent-border-default)",
          padding: "48px 24px",
          textAlign: "center",
          maxWidth: 520,
          margin: "8px auto 0",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          No client portal yet
        </p>
        <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
          Once a buyer or seller on this file has a portal, you&apos;ll see exactly what they see here, live.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Intro — sets the agent&apos;s expectation: this is a window, not a control panel. */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-muted)", maxWidth: 440, margin: "0 auto" }}>
          This is exactly what your client sees, live. You can tap around freely to explore it,
          but you&apos;re only looking, nothing here changes their file.
        </p>
      </div>

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
            maxWidth: 460,
            margin: "0 auto 18px",
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
              // Device bezel.
              padding: 12,
              borderRadius: 52,
              background: "linear-gradient(160deg, #16171b, #050506)",
              boxShadow: "0 28px 60px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            {/* Notch */}
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
              {/* Loading shimmer until the framed portal paints. */}
              {!loaded && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 2,
                    display: "grid",
                    placeItems: "center",
                    background: "#f6f8fc",
                  }}
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
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes cpp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
