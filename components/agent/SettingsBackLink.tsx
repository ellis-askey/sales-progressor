"use client";

// The "Back" affordance for the settings areas (critique #187). Renders a real
// anchor (accessible, with a sensible fallback href so it works without JS), but
// on click routes to the page you were last on before entering settings
// (readReturnPath), rather than always the hub. Styling is driven entirely by
// the className passed in, so it drops into the existing back-link CSS unchanged.

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { readReturnPath } from "@/lib/agent/return-path";

export function SettingsBackLink({
  label,
  className,
  arrowClassName,
  arrowSize = 14,
  fallbackHref = "/agent/hub",
  onNavigate,
}: {
  label: string;
  className?: string;
  arrowClassName?: string;
  arrowSize?: number;
  fallbackHref?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <a
      href={fallbackHref}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigate?.();
        router.push(readReturnPath(fallbackHref));
      }}
    >
      <ArrowLeft weight="bold" className={arrowClassName} style={{ width: arrowSize, height: arrowSize }} />
      {label}
    </a>
  );
}
