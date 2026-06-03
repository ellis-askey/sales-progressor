// Next.js App Router auto-discovers this file and serves /robots.txt.
//
// portal.thesalesprogressor.co.uk is an authenticated product surface,
// NOT an SEO target — the marketing site at thesalesprogressor.co.uk is.
// We disallow the entire portal by default and explicitly allow the
// handful of pages that genuinely benefit from being indexable (legal
// pages people google for, plus login / register as lead-gen anchors).
//
// The marketing-site sitemap is the canonical entry point for crawlers;
// we point at it here rather than maintaining a portal-side sitemap.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Disallow the entire portal by default. Specific paths are
        // re-opened by the Allow list below.
        disallow: "/",
        allow: [
          "/billing-terms",
          "/cookie-policy",
          "/legal",
          "/login",
          "/register",
        ],
      },
    ],
    sitemap: "https://www.thesalesprogressor.co.uk/sitemap.xml",
    host: "https://portal.thesalesprogressor.co.uk",
  };
}
