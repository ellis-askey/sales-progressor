// Canonical Toast aliases of the existing AgentToaster + useAgentToast.
//
// AgentToaster predates this catalog's naming convention but is the
// canonical toast renderer — it provides the Context provider, the
// stacking behaviour, the duration logic per toast type, the success /
// info / warning / error variants, the dismiss callback, and the
// auto-dismiss timers. New code uses `Toast` namespace; existing
// AgentToaster imports keep working — no migration required per Law 16.
//
// Phase 2 Week 8-9 of the discipline migration.
//
// See docs/reference/COMPONENT_LIBRARY_CATALOG.md §2.8 for the catalog
// entry. Gallery story at app/dev/gallery/toast/page.tsx.

export {
  AgentToaster as ToastProvider,
  useAgentToast as useToast,
} from "@/components/agent/AgentToaster";
export type {
  AgentToastType as ToastType,
  AgentToastOptions as ToastOptions,
} from "@/components/agent/AgentToaster";
