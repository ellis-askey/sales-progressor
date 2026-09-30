"use client";

// Client-side companion to lib/portal/preview.ts (isAgentPortalView).
//
// The portal layout resolves ONCE, on the server, whether the viewer is an
// internal agent looking through the window (they have a session) or the real
// client. It passes that truth down here so every interactive portal component
// can render its press animation but skip the actual server call — the client
// sees a live, tappable app; the agent sees a faithful, inert replica.
//
// Defaults to false (NOT read-only) so any component using the hook outside a
// provider — or a real client, who is never wrapped as read-only — behaves
// exactly as before.

import { createContext, useContext, type ReactNode } from "react";

const PortalReadOnlyContext = createContext<boolean>(false);

/**
 * True when an agent is viewing the portal as a read-only window. Interactive
 * components should keep their optimistic/animation path and skip the server
 * call when this is true.
 */
export function usePortalReadOnly(): boolean {
  return useContext(PortalReadOnlyContext);
}

export function PortalReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: ReactNode;
}) {
  return (
    <PortalReadOnlyContext.Provider value={readOnly}>
      {children}
    </PortalReadOnlyContext.Provider>
  );
}
