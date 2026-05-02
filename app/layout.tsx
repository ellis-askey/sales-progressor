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

export const metadata: Metadata = {
  title: "Sales Progressor",
  description: "Transaction management for residential property sales",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider session={session}>
          <PostHogProvider>
            <CookieConsentBanner />
            {children}
          </PostHogProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
