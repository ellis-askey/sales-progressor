import type { FeedUpdate } from "@/lib/platform-updates/feed";
import type { PlatformUpdateCategory } from "@prisma/client";

// Agent-app "What's new" feed. Read-only, published updates only (the server
// filters by audience + status before this renders). Warm, product-feed feel in
// the agent palette: a subtle category chip, a clear title, a concise line, a
// quiet date, and an optional integrated screenshot. Newest first.

const CATEGORY: Record<PlatformUpdateCategory, { label: string; color: string; bg: string; border: string }> = {
  new_feature: { label: "New feature", color: "#1b7a50", bg: "rgba(31,138,91,0.10)", border: "rgba(31,138,91,0.26)" },
  improvement: { label: "Improvement", color: "#2160a0", bg: "rgba(37,99,168,0.10)", border: "rgba(37,99,168,0.24)" },
  moved: { label: "Moved", color: "#8a5a05", bg: "rgba(154,100,0,0.12)", border: "rgba(154,100,0,0.26)" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function WhatsNewFeed({ updates }: { updates: FeedUpdate[] }) {
  if (updates.length === 0) {
    return (
      <p style={{ fontSize: 14, color: "var(--agent-text-muted)", textAlign: "center", padding: "40px 0" }}>
        Nothing new just yet. We&apos;ll post here when something changes.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {updates.map((u) => {
        const cat = CATEGORY[u.category] ?? CATEGORY.improvement;
        return (
          <article
            key={u.id}
            style={{
              background: "var(--agent-surface-elevated, #fff)",
              border: "1px solid var(--agent-border-subtle, rgba(45,24,16,0.08))",
              borderRadius: 16,
              padding: "20px 22px",
              boxShadow: "0 1px 2px rgba(45,24,16,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <span
                style={{
                  display: "inline-flex", alignItems: "center",
                  fontSize: 11.5, fontWeight: 700, letterSpacing: "0.01em",
                  color: cat.color, background: cat.bg, border: `1px solid ${cat.border}`,
                  borderRadius: 999, padding: "3px 11px",
                }}
              >
                {cat.label}
              </span>
              <time
                dateTime={u.publishedAt}
                style={{ fontSize: 12, color: "var(--agent-text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {fmtDate(u.publishedAt)}
              </time>
            </div>

            <h2 style={{ margin: "0 0 7px", fontSize: 18, fontWeight: 740, letterSpacing: "-0.01em", color: "var(--agent-text-primary)", textWrap: "balance" }}>
              {u.title}
            </h2>

            {u.body && (
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--agent-text-secondary)", maxWidth: "62ch" }}>
                {u.body}
              </p>
            )}

            {u.imageUrl && (
              <div style={{ marginTop: 15 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.imageUrl}
                  alt=""
                  style={{
                    display: "block", width: "100%", maxWidth: 520, maxHeight: 320,
                    objectFit: "cover", borderRadius: 11,
                    border: "1px solid var(--agent-border-subtle, rgba(45,24,16,0.08))",
                  }}
                />
              </div>
            )}

            {u.linkUrl && (
              <div style={{ marginTop: 15 }}>
                <a
                  href={u.linkUrl}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 13.5, fontWeight: 600, color: "var(--agent-coral-deep, #C2410C)",
                    textDecoration: "none",
                  }}
                >
                  Take me there
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
