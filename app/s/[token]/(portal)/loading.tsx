// Tab loading state: the same screen-edge pulse the client portal uses (no
// skeletons). Stilled under reduced motion by the global rule.
export default function SolicitorTabLoading() {
  return <div aria-hidden className="portal-edge-pulse" />;
}
