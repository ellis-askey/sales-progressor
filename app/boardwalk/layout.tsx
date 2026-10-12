// Boardwalk Forms — root layout for the /boardwalk surface.
// Brand-true to boardwalkpropertyco.com: stone + charcoal + blush/sage, serif
// display headings. Their real typefaces (blacker-pro-display and
// brandon-grotesque) are Adobe Fonts and can't be bundled, so we load the
// closest Google matches — DM Serif Display and Jost — behind CSS variables;
// boardwalk.css names the Adobe families first in each stack so the genuine
// fonts win automatically if their Typekit kit is ever added.
// Session gating happens in the nested (app) layout, not here, so
// /boardwalk/login and /boardwalk/reset stay reachable.

import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Jost } from "next/font/google";
import "./boardwalk.css";

const display = DM_Serif_Display({
  variable: "--font-bw-display",
  subsets: ["latin"],
  weight: "400",
});

const sans = Jost({
  variable: "--font-bw-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Boardwalk Forms",
    template: "%s · Boardwalk Forms",
  },
  description: "Beautiful forms, built around your business.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f3f0ee",
};

export default function BoardwalkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`bw-scope ${display.variable} ${sans.variable}`} style={{ minHeight: "100vh" }}>
      {children}
    </div>
  );
}
