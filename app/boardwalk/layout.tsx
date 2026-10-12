// Boardwalk Forms — root layout for the /boardwalk surface.
// Visually independent from every TSP surface: its own fonts (Fraunces +
// Figtree), its own scoped CSS token system (boardwalk.css), no agent/command
// imports. Session gating happens in the nested (app) layout, not here, so
// /boardwalk/login and /boardwalk/reset stay reachable.

import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./boardwalk.css";

const display = Fraunces({
  variable: "--font-bw-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const sans = Figtree({
  variable: "--font-bw-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Boardwalk Forms",
    template: "%s · Boardwalk Forms",
  },
  description: "Beautiful forms for Boardwalk.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#faf8f4",
};

export default function BoardwalkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`bw-scope ${display.variable} ${sans.variable}`} style={{ minHeight: "100vh" }}>
      {children}
    </div>
  );
}
