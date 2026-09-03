// /dev/sheets — internal QA + design-review environment for every drawer,
// modal and in-page notification on the agent/internal side of the app.
//
// Rebuilt 2026-09-03 from the old file-detail-only gallery into a data-driven
// catalogue: search, type/verification filters, per-component state inspection,
// and localStorage-backed "verified" marks. Every card mounts the REAL
// production component with edge-case fixture data against the real app
// background (see layout.tsx). Registry lives in _registry/*.
//
// Dev-only: blocked in production so a harness that can fire component actions
// against demo IDs never ships to real users.
"use client";

import { notFound } from "next/navigation";
import { SheetsCatalogue } from "./_components/SheetsCatalogue";

export default function DevSheetsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SheetsCatalogue />;
}
