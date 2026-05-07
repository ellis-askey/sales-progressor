"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";

export type ArticleMeta = {
  slug: string;
  title: string;
  section: string;
};

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
  "00-getting-started":      "Getting Started",
  "01-running-your-pipeline":"Running Your Pipeline",
  "02-property-file":        "The Property File",
  "03-milestones":           "Milestones",
  "04-reminders-and-chasing":"Reminders & Chasing",
  "05-portal":               "Client Portal",
  "06-team":                 "Team Management",
  "07-notifications":        "Notifications & Email",
};

export function HelpSidebar({
  articles,
  selectedSlug,
}: {
  articles: ArticleMeta[];
  selectedSlug: string;
}) {
  const router = useRouter();
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
    router.push(`?slug=${encodeURIComponent(slug)}`, { scroll: false });
  }

  return (
    <aside style={{
      width: 272,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      borderRight: "0.5px solid rgba(45,24,16,0.10)",
      background: "rgba(255,255,255,0.65)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      overflowY: "auto",
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 14px 12px",
        borderBottom: "0.5px solid rgba(45,24,16,0.08)",
        position: "sticky", top: 0,
        background: "rgba(255,255,255,0.90)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        zIndex: 10,
      }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#FF6B4A", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Help
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "7px 10px",
            fontSize: 13,
            border: "0.5px solid rgba(45,24,16,0.15)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.80)",
            outline: "none",
            color: "#2D1810",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Tree */}
      <nav style={{ padding: "8px 0 32px" }}>
        {SECTION_ORDER.map((sec) => {
          const items = grouped.get(sec) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={sec} style={{ marginBottom: 2 }}>
              <p style={{
                margin: 0, padding: "8px 14px 3px",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
                textTransform: "uppercase", color: "rgba(45,24,16,0.40)",
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
                      display: "block", width: "100%", textAlign: "left",
                      padding: "5px 14px 5px 18px",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? "#FF6B4A" : "#5A3A28",
                      background: active ? "rgba(255,107,74,0.07)" : "transparent",
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: "none",
                      borderLeft: active ? "2px solid #FF6B4A" : "2px solid transparent",
                      cursor: "pointer",
                      lineHeight: 1.45,
                      transition: "background 100ms, color 100ms",
                      fontFamily: "inherit",
                    }}
                  >
                    {a.title}
                  </button>
                );
              })}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ padding: "16px 14px", fontSize: 13, color: "rgba(45,24,16,0.40)", margin: 0 }}>
            No articles match.
          </p>
        )}
      </nav>
    </aside>
  );
}
