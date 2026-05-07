"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArticleMeta = {
  slug: string;
  title: string;
  section: string;
};

// ── Config ────────────────────────────────────────────────────────────────────

const SECTION_ORDER = [
  "00-getting-started",
  "01-running-your-pipeline",
  "02-property-file",
  "03-milestones",
  "04-reminders-and-chasing",
  "05-portal",
  "06-team",
  "07-notifications",
];

const SECTION_LABELS: Record<string, string> = {
  "00-getting-started":       "Getting Started",
  "01-running-your-pipeline": "Running Your Pipeline",
  "02-property-file":         "The Property File",
  "03-milestones":            "Milestones",
  "04-reminders-and-chasing": "Reminders & Chasing",
  "05-portal":                "Client Portal",
  "06-team":                  "Team Management",
  "07-notifications":         "Notifications & Email",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function HelpSidebar({
  articles,
  selectedSlug,
}: {
  articles: ArticleMeta[];
  selectedSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () => new Fuse(articles, { keys: ["title"], threshold: 0.4 }),
    [articles]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, articles]);

  const grouped = useMemo(() => {
    const map = new Map<string, ArticleMeta[]>();
    for (const sec of SECTION_ORDER) map.set(sec, []);
    for (const a of filtered) {
      if (!map.has(a.section)) map.set(a.section, []);
      map.get(a.section)!.push(a);
    }
    return map;
  }, [filtered]);

  function navigate(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("slug", slug);
    router.push(`?${params.toString()}`);
  }

  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      borderRight: "0.5px solid rgba(45,24,16,0.10)",
      background: "#FFF5EC",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ padding: "24px 16px 12px" }}>
        <p style={{
          margin: "0 0 12px",
          fontSize: 11,
          fontWeight: 700,
          color: "rgba(45,24,16,0.45)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          Help library
        </p>
        {/* Search */}
        <input
          type="text"
          placeholder="Search articles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "7px 10px",
            fontSize: 12,
            border: "0.5px solid rgba(45,24,16,0.18)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.72)",
            outline: "none",
            color: "#2D1810",
          }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "4px 0 32px" }}>
        {SECTION_ORDER.map((sec) => {
          const items = grouped.get(sec) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={sec} style={{ marginBottom: 4 }}>
              <p style={{
                margin: 0,
                padding: "10px 16px 4px",
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(45,24,16,0.40)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>
                {SECTION_LABELS[sec] ?? sec}
              </p>
              {items.map((a) => {
                const active = a.slug === selectedSlug;
                return (
                  <button
                    key={a.slug}
                    onClick={() => navigate(a.slug)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 16px",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? "#FF6B4A" : "#5A3A28",
                      background: active ? "rgba(255,107,74,0.08)" : "none",
                      border: "none",
                      borderLeft: active ? "2px solid #FF6B4A" : "2px solid transparent",
                      cursor: "pointer",
                      lineHeight: 1.4,
                    }}
                  >
                    {a.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
