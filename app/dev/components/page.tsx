"use client";
// TSP Design System — permanent headquarters.
//
// The canonical system we build from the real, shipped app, one reviewed
// decision at a time. This is the "law-in-waiting": once we've been through the
// whole product it becomes the single source of truth, and the forward Liquid
// Glass system (/dev/design-system) — the migration source — is retired.
//
// This file is intentionally thin: the dev-only gate plus the workspace shell.
// The IA, entry architecture and styling live in ./_ds. Durable records live in
// docs/design-system/. The previous uiarc component gallery is preserved as a
// raw source at /dev/components/gallery.
//
// Dev-only: blocks in production, matching the /dev convention (middleware
// excludes /dev; each page self-gates with this NODE_ENV check).

import { notFound } from "next/navigation";
import { Workspace } from "./_ds/Workspace";

export default function DesignSystemHQ() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Workspace />;
}
