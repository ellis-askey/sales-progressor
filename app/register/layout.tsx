// Server-component layout sits above the client-rendered register page
// so we can export `metadata` (clients can't). Only purpose is to
// override the root layout's default robots-noindex so the signup page
// is discoverable via search — a lead-gen anchor.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an agency account",
  description:
    "Set up your estate agency on Sales Progressor and start managing residential property sales with automated client updates and structured progression.",
  robots: { index: true, follow: true },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
