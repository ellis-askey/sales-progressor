"use client";

// Live wrapper around AppColourStudio for the real settings pages (agent +
// external sales-prog). Two jobs the sandbox doesn't need:
//   • onChange → recolour the WHOLE settings surface instantly, no save. We
//     append a <style> at the end of <body> (so it wins over the layout's
//     server-injected App Colour CSS by source order) and rewrite it on every
//     tweak. Removed on leave, so an unsaved preview never persists.
//   • onSave   → persist via updateAppColour, toast, refresh so the server
//     re-renders with the saved config as the new baseline.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppColourStudio, type AppColourConfig } from "@/components/account/v2/AppColourStudio";
import { appColourCss } from "@/lib/agent/brand-theme";
import { updateAppColour } from "@/app/actions/agent-preferences";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function AppColourStudioLive({ initial }: { initial: AppColourConfig }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Mount a dedicated live-preview <style> at the end of <body>.
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "sp-live-appcolour";
    document.body.appendChild(el);
    styleRef.current = el;
    return () => { el.remove(); styleRef.current = null; };
  }, []);

  return (
    <AppColourStudio
      initial={initial}
      hideHead
      onChange={(cfg) => { if (styleRef.current) styleRef.current.textContent = appColourCss(cfg); }}
      onSave={async (cfg) => {
        const r = await updateAppColour(cfg);
        if (r.ok) { toast.success("App colour updated"); router.refresh(); }
        else toast.error(r.error);
      }}
    />
  );
}
