"use client";

// Records the last non-settings app page you were on, so the settings-area Back
// links can return you there (critique #187). Renders nothing; mounted once in
// AgentShell, which wraps every main app page.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordAppPath } from "@/lib/agent/return-path";

export function AppPathRecorder() {
  const pathname = usePathname();
  useEffect(() => {
    recordAppPath(pathname);
  }, [pathname]);
  return null;
}
