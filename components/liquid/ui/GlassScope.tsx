"use client";
// GlassScope — opt-in theme scope. Remaps the agent app's --agent-* tokens to
// Liquid-Glass values WITHIN this subtree only (see GLASS_SCOPE_CSS), so a
// well-tokenised production component rendered inside it inherits the new palette
// with zero code change. Note: it does NOT reach React-portalled content (portals
// escape the subtree) — portalled overlays use this system's own overlays, and the
// portalled Compose/Add-Note modals need a shared-file change (identified for
// approval), not this scope.
import type { ReactNode } from "react";
import { cn } from "./primitives";

export function GlassScope({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("lg-glass-scope", className)}>{children}</div>;
}
