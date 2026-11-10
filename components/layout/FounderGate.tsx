"use client";

// Founder flag for the agent app, provided once by AgentShell (which already
// holds the session). Lets client components deep in the tree — the header
// "New note" / "New email" buttons — self-hide for the founder, who gets the
// app-wide quick-action dock instead. Non-founders get the default (false) and
// are completely unaffected.

import { createContext, useContext, type ReactNode } from "react";

const FounderContext = createContext(false);

export function FounderProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <FounderContext.Provider value={value}>{children}</FounderContext.Provider>;
}

export function useIsFounder(): boolean {
  return useContext(FounderContext);
}
