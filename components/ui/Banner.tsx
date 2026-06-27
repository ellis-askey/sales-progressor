// Canonical `Banner` alias of the existing `AgentBanner`.
//
// AgentBanner predates this catalog's naming convention but is already
// the canonical horizontal-alert primitive: 8 consumers across the agent
// app surfaces use it today (RelistBanner, OnHoldBanner, FileHealthBanner,
// ReconcileLaterBanner, ChainSetupFailedBanner, DirectorJoinedBanner,
// ChainDeclineBanner, OutsourcedBanner).
//
// Phase 2 Week 5-6 of the discipline migration acknowledges this and
// re-exports under the catalog-preferred name `Banner`. New code uses
// `import { Banner } from "@/components/ui/Banner"`. Existing
// `AgentBanner` imports keep working — no migration required (Law 16).
//
// 4 non-AgentBanner banners exist (ExchangeBanner, PaymentBlockBanner,
// TrialBannerWithModal, CookieConsentBanner). Each has its own catalog
// decision documented in COMPONENT_LIBRARY_CATALOG.md §2.3.

export { AgentBanner as Banner } from "./AgentBanner";
export type { BannerKind } from "./AgentBanner";
