// app/not-found.tsx

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #1e293b 0%, #1e3a5f 45%, #0f172a 100%)" }}>
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-4">404</p>
        <h1 className="text-2xl font-semibold text-white mb-2">Page not found</h1>
        <p className="text-sm text-blue-200/60 mb-8">
          This page doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium text-white transition-colors shadow-sm"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
