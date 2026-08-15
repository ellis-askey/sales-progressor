// Portal loading state (LOADING-L1, chosen 2026-08-15). No skeletons: the
// shell (header, nav, ambient wash) is already mounted by the layout, so while
// the page resolves we show only a subtle blue pulse around the screen edge.
// When the real content arrives it fades gently up into place (.portal-fade-in
// on the page root). See app/globals.css for the keyframes.

export default function PortalHomeLoading() {
  return <div aria-hidden className="portal-edge-pulse" />;
}
