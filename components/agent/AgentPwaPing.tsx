"use client";

import { useEffect } from "react";

// Fire-and-forget staff PWA adoption signal — the agent-app mirror of
// PortalPwaPing. On load, if the app is running in standalone display-mode
// (added to home screen), tell the server; also catch the browser "appinstalled"
// event. Session-scoped endpoint (no token). Renders nothing.
export function AgentPwaPing() {
  useEffect(() => {
    function ping(payload: { standalone?: boolean; installed?: boolean }) {
      fetch("/api/agent/pwa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (standalone) ping({ standalone: true });

    const onInstalled = () => ping({ installed: true });
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  return null;
}
