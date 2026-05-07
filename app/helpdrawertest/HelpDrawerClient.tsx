"use client";

import { useState, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import Fuse from "fuse.js";

export type Article = {
  slug: string;
  title: string;
  section: string;
  sectionLabel: string;
  content: string;
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
  "00-getting-started": "Getting Started",
  "01-running-your-pipeline": "Running Your Pipeline",
  "02-property-file": "The Property File",
  "03-milestones": "Milestones",
  "04-reminders-and-chasing": "Reminders & Chasing",
  "05-portal": "Client Portal",
  "06-team": "Team Management",
  "07-notifications": "Notifications & Email",
};

export function HelpDrawerClient({ articles }: { articles: Article[] }) {
  const [selected, setSelected] = useState<string>(articles[0]?.slug ?? "");
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () => new Fuse(articles, { keys: ["title", "content"], threshold: 0.35, includeScore: true }),
    [articles]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, articles]);

  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const sec of SECTION_ORDER) map.set(sec, []);
    for (const a of filtered) {
      if (!map.has(a.section)) map.set(a.section, []);
      map.get(a.section)!.push(a);
    }
    return map;
  }, [filtered]);

  const currentArticle = useMemo(
    () => articles.find((a) => a.slug === selected),
    [articles, selected]
  );

  const handleSelect = useCallback((slug: string) => {
    setSelected(slug);
  }, []);

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "hsl(38 60% 97%)",
      color: "#1a1a1a",
    }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 280,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.70)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        overflowY: "auto",
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          position: "sticky",
          top: 0,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          zIndex: 10,
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#FF6B4A", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Help Library
          </p>
          {/* Search */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "7px 10px",
              fontSize: 13,
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.8)",
              outline: "none",
              color: "#1a1a1a",
            }}
          />
        </div>

        {/* Article tree */}
        <nav style={{ padding: "8px 0 24px" }}>
          {SECTION_ORDER.map((sec) => {
            const items = grouped.get(sec) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={sec} style={{ marginBottom: 4 }}>
                <p style={{
                  margin: 0,
                  padding: "8px 16px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#999",
                }}>
                  {SECTION_LABELS[sec] ?? sec}
                </p>
                {items.map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => handleSelect(a.slug)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 16px 6px 20px",
                      fontSize: 13,
                      fontWeight: selected === a.slug ? 600 : 400,
                      color: selected === a.slug ? "#FF6B4A" : "#3a3a3a",
                      background: selected === a.slug ? "rgba(255,107,74,0.08)" : "transparent",
                      border: "none",
                      borderLeft: selected === a.slug ? "2px solid #FF6B4A" : "2px solid transparent",
                      cursor: "pointer",
                      lineHeight: 1.4,
                      transition: "background 120ms, color 120ms",
                    }}
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p style={{ padding: "16px", fontSize: 13, color: "#999", margin: 0 }}>
              No articles match your search.
            </p>
          )}
        </nav>
      </aside>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflowY: "auto",
        padding: "40px 60px",
        maxWidth: 800,
      }}>
        {currentArticle ? (
          <article>
            {/* Breadcrumb */}
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#999" }}>
              {SECTION_LABELS[currentArticle.section] ?? currentArticle.section}
            </p>

            {/* Rendered markdown */}
            <div style={{ lineHeight: 1.7 }}>
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a", margin: "0 0 20px", lineHeight: 1.25 }}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 style={{ fontSize: 17, fontWeight: 650, color: "#1a1a1a", margin: "32px 0 10px", paddingTop: 24, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 style={{ fontSize: 14, fontWeight: 650, color: "#333", margin: "24px 0 8px" }}>
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p style={{ margin: "0 0 14px", fontSize: 14, color: "#3a3a3a" }}>
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ margin: "0 0 14px", paddingLeft: 22, fontSize: 14, color: "#3a3a3a" }}>
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ margin: "0 0 14px", paddingLeft: 22, fontSize: 14, color: "#3a3a3a" }}>
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li style={{ margin: "0 0 6px" }}>{children}</li>
                  ),
                  table: ({ children }) => (
                    <div style={{ overflowX: "auto", margin: "0 0 20px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead style={{ background: "rgba(255,107,74,0.06)" }}>{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 650, color: "#555", borderBottom: "2px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", verticalAlign: "top", color: "#3a3a3a" }}>
                      {children}
                    </td>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.startsWith("language-");
                    if (isBlock) {
                      return (
                        <pre style={{ background: "#f6f4f0", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "14px 16px", overflowX: "auto", margin: "0 0 16px", fontSize: 12, lineHeight: 1.6 }}>
                          <code>{children}</code>
                        </pre>
                      );
                    }
                    return (
                      <code style={{ background: "rgba(255,107,74,0.08)", color: "#c0392b", borderRadius: 4, padding: "2px 5px", fontSize: "0.9em", fontFamily: "ui-monospace, monospace" }}>
                        {children}
                      </code>
                    );
                  },
                  strong: ({ children }) => (
                    <strong style={{ fontWeight: 650, color: "#1a1a1a" }}>{children}</strong>
                  ),
                  a: ({ children, href }) => {
                    const handleLinkClick = (e: React.MouseEvent) => {
                      if (!href) return;
                      // Internal cross-links: try to find matching article
                      const filename = href.replace(/^\.\.\/[^/]+\//, "").replace(/^\.\//, "").replace(/\.md$/, "");
                      const targetSlug = articles.find(
                        (a) => a.slug.endsWith(filename) || a.slug === filename
                      )?.slug;
                      if (targetSlug) {
                        e.preventDefault();
                        handleSelect(targetSlug);
                      }
                    };
                    return (
                      <a
                        href={href ?? "#"}
                        onClick={handleLinkClick}
                        style={{ color: "#FF6B4A", textDecoration: "underline", textDecorationColor: "rgba(255,107,74,0.35)", cursor: "pointer" }}
                      >
                        {children}
                      </a>
                    );
                  },
                  blockquote: ({ children }) => (
                    <blockquote style={{ borderLeft: "3px solid #FF6B4A", paddingLeft: 16, margin: "0 0 16px", color: "#666" }}>
                      {children}
                    </blockquote>
                  ),
                  hr: () => (
                    <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.08)", margin: "28px 0" }} />
                  ),
                }}
              >
                {currentArticle.content}
              </ReactMarkdown>
            </div>
          </article>
        ) : (
          <p style={{ color: "#999", fontSize: 14 }}>Select an article from the sidebar.</p>
        )}
      </main>
    </div>
  );
}
