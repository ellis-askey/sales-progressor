// Public form runner layout — loads the Boardwalk font variables the runner's
// theme stacks reference. No chrome: each form paints its own full-screen
// theme. Deliberately exposes nothing about the dashboard.

import type { Metadata } from "next";
import { Fraunces, Figtree } from "next/font/google";

const display = Fraunces({
  variable: "--font-bw-display",
  subsets: ["latin"],
});

const sans = Figtree({
  variable: "--font-bw-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${sans.variable}`}>{children}</div>;
}
