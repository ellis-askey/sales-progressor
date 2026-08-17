"use client";

import { useEffect } from "react";

// Fire-and-forget PWA adoption signal (Command Centre → App adoption). On load,
// if the portal is running in standalone display-mode (added to home screen),
// tell the server. Also catch the browser "appinstalled" event. Renders nothing.
export function PortalPwaPing({ token }: { token: string }) {
  useEffect(() => {
    function ping(payload: { standalone?: boolean; installed?: boolean }) {
      fetch(`/api/portal/${token}/pwa`, {
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
  }, [token]);

  return null;
}
