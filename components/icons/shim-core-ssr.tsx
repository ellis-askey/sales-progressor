// SERVER-SAFE icon shim core — deliberately NO "use client". Used by the shim for
// files that import from @phosphor-icons/react/dist/ssr (server components). A Solar
// icon is a plain inline <svg>, so these render entirely on the server with ZERO
// added client JS — server rendering is fully preserved. Because there's no React
// context here (context is client-only), this renders Solar whenever the migration
// flag is on, REGARDLESS of where it's used — so it must only be used by files that
// never render inside an excluded area (verified by the import-graph scan). Shared-
// with-excluded files use the context-based client shim instead. The kill-switch
// still works: ICON_MIGRATION_ENABLED is a static constant readable on the server.

import * as React from "react";
import { SOLAR } from "./solar-map.generated";
import { ICON_MIGRATION_ENABLED } from "./flag";

type AnyProps = Record<string, unknown>;

const SolarSvg = React.forwardRef<SVGSVGElement, { iconKey: string; props: AnyProps; defaultSize: number | string }>(
  function SolarSvg({ iconKey, props, defaultSize }, ref) {
    const b = SOLAR[iconKey];
    const { size, color, className, style } = props as { size?: number | string; color?: string; className?: string; style?: React.CSSProperties };
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

// Server-renderable wrapper: Solar when the flag is on, else the original SSR icon.
// No hooks, no context — safe in server components.
export function makeServerIcon(
  iconKey: string,
  Original: React.ComponentType<AnyProps>,
  defaultSize: number | string = "1em",
): React.ComponentType<AnyProps> {
  const AppIcon = React.forwardRef<SVGSVGElement, AnyProps>(function AppIcon(props, ref) {
    if (ICON_MIGRATION_ENABLED && SOLAR[iconKey]) return <SolarSvg iconKey={iconKey} props={props} defaultSize={defaultSize} ref={ref} />;
    const O = Original as React.ComponentType<AnyProps & { ref?: React.Ref<SVGSVGElement> }>;
    return <O {...props} ref={ref} />;
  });
  AppIcon.displayName = `AppServerIcon(${iconKey})`;
  return AppIcon as unknown as React.ComponentType<AnyProps>;
}
