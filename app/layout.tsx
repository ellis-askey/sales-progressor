// app/layout.tsx
// Root layout — wraps all pages with session provider and base styles.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { CookieConsentBanner } from "@/components/analytics/CookieConsentBanner";
import { getSession } from "@/lib/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata strategy for portal.thesalesprogressor.co.uk:
//
// 1. metadataBase is set so any relative URLs used by next/og or
//    per-page metadata resolve against the right host.
// 2. robots defaults to noindex/nofollow on every page. Public legal
//    pages (billing-terms, cookie-policy, legal) and the login/register
//    entry points override this with their own `robots: { index: true,
//    follow: true }` in their metadata exports. This belt-and-braces
//    the same intent expressed in app/robots.ts — robots.txt is a
//    suggestion to crawlers, the meta tag travels with each page.
// 3. openGraph + twitter cards mean shares of any portal URL render a
//    branded preview. The OG image at app/opengraph-image.png is
//    auto-injected by the App Router across every page.
export const metadata: Metadata = {
  metadataBase: new URL("https://portal.thesalesprogressor.co.uk"),
  title: {
    default: "Sales Progressor",
    template: "%s · Sales Progressor",
  },
  description: "Transaction management for residential property sales.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    siteName: "Sales Progressor",
    title: "Sales Progressor",
    description:
      "Transaction management for residential property sales. Structured progression, automated client updates, real-time agent visibility.",
    url: "https://portal.thesalesprogressor.co.uk",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sales Progressor",
    description:
      "Transaction management for residential property sales.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isInternalStaff = session?.user?.role === "admin" || session?.user?.role === "sales_progressor" || session?.user?.role === "superadmin";

  return (
    // suppressHydrationWarning: the ThemeModeBoot inline script mutates
    // <html> (data-theme + elevra-bg class) BEFORE hydration to avoid a
    // theme flash, so React's attribute check on this one element must be
    // silenced. Children are still fully hydration-checked.
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider session={session}>
          <PostHogProvider>
            {!isInternalStaff && <CookieConsentBanner />}
            {children}
          </PostHogProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
