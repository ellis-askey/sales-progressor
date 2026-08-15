// Updates tab loading state (LOADING-L1, 2026-08-15). Edge pulse only, no
// skeletons — see app/portal/[token]/loading.tsx for the rationale.

export default function PortalUpdatesLoading() {
  return <div aria-hidden className="portal-edge-pulse" />;
}
