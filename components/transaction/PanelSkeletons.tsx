// Quiet file-detail loading fallbacks (2026-10-18 load-in bloom). Skeletons
// retired app-wide: the URL commits instantly, a calm empty shell holds the
// space (so property → property navigation never shows one file's content under
// another's URL), and the real content blooms in (.agent-bloom) as it streams.
// See docs/reference/MOTION_GUIDE.md "Content load-in (bloom)". Signatures are
// unchanged so every Suspense fallback + tab loading.tsx keeps compiling.

export function SidebarPanelSkeleton() {
  return <div aria-hidden="true" style={{ minHeight: 320 }} />;
}

// Route-level fallback for the whole file page: a calm on-brand shell that
// holds the viewport while the file streams, then content blooms in.
export function FilePageSkeleton() {
  return <div className="glass-page agent-page" aria-hidden="true" style={{ minHeight: "100vh" }} />;
}

export function TabPanelSkeleton(_props: { rows?: number; withHero?: boolean } = {}) {
  return <div aria-hidden="true" style={{ minHeight: 240 }} />;
}
