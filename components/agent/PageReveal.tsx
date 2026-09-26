"use client";

// Content entrance for agent pages. Unlike a layout-level wrapper (which mounts
// at NAVIGATION time — i.e. while the loading.tsx skeleton is showing, so the
// fade gets "used up" on the skeleton and the real content just snaps in), this
// lives INSIDE the page, below the Suspense boundary. It therefore mounts when
// the real content mounts — as the skeleton unmounts — so the content fades +
// rises into place with the same motion the skeleton entered with. Pure CSS,
// runs after paint, reduced-motion disables it: no impact on load speed.
//
// Skeletons carry the same .page-fade-up in components/loading/PageSkeletons so
// the two halves read as one continuous entrance.

export function PageReveal({ children }: { children: React.ReactNode }) {
  return <div className="page-fade-up">{children}</div>;
}
