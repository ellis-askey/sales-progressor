// TSP Liquid Glass — barrel. Import approved kit pieces from here.
//   import { GlassButton, GlassCard, LiquidGlass } from "@/components/liquid";
//
// EXPERIMENTAL / forward design language. See README.md. Not for production
// imports until the owning page is approved for migration.

export { LiquidGlass, type LiquidGlassProps } from "./LiquidGlass";
export * from "./components";
// The avatar is the real production component, reused unchanged (photo → branded
// side-tinted SVG fallback). Re-exported so Liquid Glass pages use one avatar.
export { UserAvatar, ActorAvatar, ContactAvatar, AvatarStack, type ActorRole } from "@/components/ui/Avatar";
