"use client";

import { createContext, useContext, type ReactNode } from "react";

// Client-side mirror of the AI master switch (#291). A server component reads
// aiEnabled() once and provides it here; client AI-trigger components read it
// via useAiEnabled() and hide their button/panel when AI is off, so the switch
// both stops AI running (server-side) and removes the dead controls.
//
// Default is TRUE: a component rendered outside any provider never wrongly
// hides itself — the server guard still makes it safe either way.
const AiEnabledContext = createContext<boolean>(true);

export function AiEnabledProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <AiEnabledContext.Provider value={enabled}>{children}</AiEnabledContext.Provider>;
}

export function useAiEnabled(): boolean {
  return useContext(AiEnabledContext);
}
