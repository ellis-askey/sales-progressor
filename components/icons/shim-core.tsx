"use client";

// Icon migration core. An `IconMode` context (default "current") gates whether the
// in-scope icon shims render Solar Bold Duotone or the original Phosphor/Lucide
// icon. Only the three dashboard layout roots wrap their tree in
// <IconModeProvider mode="solar">, so excluded areas (portals, Command Centre,
// auth, marketing) — including SHARED components rendered there — always get the
// original icon. That makes the migration leak-proof and instantly reversible:
// remove the provider and everything renders the current icon again.
//
// The wrapper preserves everything the brief requires: rendered size (incl.
// Phosphor's 1em default), colour + colour inheritance (currentColor), className
// (so Tailwind text-* colour and sizing still apply), inline style, click/tap
// handlers, and aria semantics. Solar's two-tone character comes from the icon's
// own currentColor-driven duotone — no background, circle, tile or gradient is
// ever added.

import * as React from "react";
import { SOLAR } from "./solar-map.generated";

export type IconMode = "current" | "solar";
const IconModeCtx = React.createContext<IconMode>("current");

export function IconModeProvider({ mode = "solar", children }: { mode?: IconMode; children: React.ReactNode }) {
  return <IconModeCtx.Provider value={mode}>{children}</IconModeCtx.Provider>;
}
export function useIconMode(): IconMode {
  return React.useContext(IconModeCtx);
}

type AnyProps = Record<string, unknown>;

const SolarSvg = React.forwardRef<SVGSVGElement, { iconKey: string; props: AnyProps; defaultSize: number | string }>(
  function SolarSvg({ iconKey, props, defaultSize }, ref) {
    const b = SOLAR[iconKey];
    const { size, color, className, style } = props as { size?: number | string; color?: string; className?: string; style?: React.CSSProperties };
    // Forward everything except the props we consume / Phosphor-only props Solar ignores.
    const rest: AnyProps = {};
    for (const k in props) {
      if (["size", "color", "className", "style", "weight", "mirrored", "alt"].includes(k)) continue;
      rest[k] = props[k];
    }
    const dim = size == null ? defaultSize : size;
    const hasLabel = rest["aria-label"] != null || rest["aria-labelledby"] != null;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        {...rest}
        width={dim}
        height={dim}
        viewBox={`0 0 ${b.w} ${b.h}`}
        className={className}
        style={{ ...(style || {}), color: color ?? (style?.color as string | undefined), flexShrink: 0 }}
        aria-hidden={hasLabel ? undefined : true}
        dangerouslySetInnerHTML={{ __html: b.body }}
      />
    );
  },
);

// Wrap an original icon component. defaultSize matches the source library's default
// (Phosphor = "1em", Lucide = 24) so omitting `size` behaves identically. Forwards
// refs so call sites that ref an icon keep working.
export function makeIcon(
  iconKey: string,
  Original: React.ComponentType<AnyProps>,
  defaultSize: number | string = "1em",
): React.ComponentType<AnyProps> {
  const AppIcon = React.forwardRef<SVGSVGElement, AnyProps>(function AppIcon(props, ref) {
    const mode = useIconMode();
    if (mode === "solar" && SOLAR[iconKey]) return <SolarSvg iconKey={iconKey} props={props} defaultSize={defaultSize} ref={ref} />;
    const O = Original as React.ComponentType<AnyProps & { ref?: React.Ref<SVGSVGElement> }>;
    return <O {...props} ref={ref} />;
  });
  AppIcon.displayName = `AppIcon(${iconKey})`;
  return AppIcon as unknown as React.ComponentType<AnyProps>;
}
