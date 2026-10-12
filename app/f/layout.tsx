// Public form runner layout — loads the Boardwalk font variables the runner's
// theme stacks reference (DM Serif Display / Jost stand-ins for Boardwalk's
// Adobe faces; see app/boardwalk/layout.tsx). No chrome: each form paints its
// own full-screen theme. Deliberately exposes nothing about the dashboard.

import type { Metadata } from "next";
import { DM_Serif_Display, Jost } from "next/font/google";

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
  robots: { index: false, follow: false },
};

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${sans.variable}`}>{children}</div>;
}
