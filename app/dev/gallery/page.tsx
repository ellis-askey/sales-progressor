// /dev/gallery — canonical primitive showcase + visual regression target.
//
// Blocked in production at the page level. Renders every approved
// primitive in every state at desktop AND mobile widths. The page is
// the **Phase 2 acceptance gate** per docs/BUILD_PLAN.md — founder
// walks every primitive on desktop and on a real phone before Phase 3
// (surface remediation) begins.
//
// Visual regression in CI ([Law 18](../../../CLAUDE.md#law-18--visual--behavioural-regression-in-ci))
// captures `toHaveScreenshot()` of every gallery state. Any unexplained
// pixel diff blocks the PR.
//
// As primitives ship, each gets a section/route under /dev/gallery/<name>
// linked from this index.

import Link from "next/link";
import { notFound } from "next/navigation";

const PRIMITIVES: Array<{ name: string; path: string; status: string }> = [
  { name: "Card", path: "/dev/gallery/card", status: "shipped 2026-06-26" },
  // Future: Button, Banner, Pill, Modal, Drawer, Accordion, Skeleton, Toast
];

export default function GalleryIndex() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Dev only · blocked in production
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Canonical primitives
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Every primitive in <code className="text-sm bg-slate-200 px-1 rounded">components/ui/</code>{" "}
            rendered in every state. This page is the Phase 2 acceptance gate.
          </p>
        </header>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Shipped ({PRIMITIVES.length})
          </h2>
          <ul className="space-y-2">
            {PRIMITIVES.map((p) => (
              <li key={p.name}>
                <Link
                  href={p.path}
                  className="block p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
