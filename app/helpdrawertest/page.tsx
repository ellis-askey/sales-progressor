import fs from "fs";
import path from "path";
import { HelpSidebar, type ArticleMeta } from "./HelpSidebar";
import { HelpContent } from "./HelpContent";
import "../../app/agent/styles/themes.css";
import "../../app/agent/styles/agent-system.css";

// ── File loading ─────────────────────────────────────────────────────────────

const HELP_DIR = path.join(process.cwd(), "docs", "help");

function titleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function loadMeta(): ArticleMeta[] {
  const metas: ArticleMeta[] = [];
  const dirs = fs
    .readdirSync(HELP_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  for (const section of dirs) {
    const files = fs
      .readdirSync(path.join(HELP_DIR, section))
      .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
      .sort();

    for (const file of files) {
      const content = fs.readFileSync(path.join(HELP_DIR, section, file), "utf8");
      metas.push({
        slug: `${section}/${file.replace(/\.mdx$/, "")}`,
        title: titleFromContent(content),
        section,
      });
    }
  }
  return metas;
}

function loadContent(slug: string): string {
  const [section, file] = slug.split("/");
  const filePath = path.join(HELP_DIR, section, `${file}.mdx`);
  if (!fs.existsSync(filePath)) return "# Article not found\n\nThis article could not be loaded.";
  return fs.readFileSync(filePath, "utf8");
}

// ── TOC extraction ────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractHeadings(content: string): { text: string; id: string }[] {
  return [...content.matchAll(/^## (.+)$/gm)].map((m) => ({
    text: m[1].replace(/\*[^*]*\*/g, "").replace(/⭐/g, "").trim(),
    id: slugify(m[1]),
  }));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HelpDrawerPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug: rawSlug } = await searchParams;
  const articles = loadMeta();
  const selectedSlug = rawSlug && articles.some((a) => a.slug === rawSlug) ? rawSlug : (articles[0]?.slug ?? "");
  const content = selectedSlug ? loadContent(selectedSlug) : "";
  const selected = articles.find((a) => a.slug === selectedSlug);
  const headings = content ? extractHeadings(content) : [];

  return (
    <div
      data-theme="sunset"
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#FFF5EC",
      }}
    >
      <HelpSidebar articles={articles} selectedSlug={selectedSlug} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <main style={{
          flex: 1,
          overflowY: "auto",
          padding: "40px 48px 80px",
          background: "#FFFFFF",
        }}>
          <div style={{ maxWidth: 700 }}>
            {selected && (
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "rgba(45,24,16,0.40)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {selected.section.replace(/^\d+-/, "").replace(/-/g, " ")}
              </p>
            )}
            {content && <HelpContent source={content} />}
          </div>
        </main>

        {headings.length > 2 && (
          <aside style={{
            width: 192,
            flexShrink: 0,
            overflowY: "auto",
            padding: "48px 24px 40px 0",
            background: "#FFFFFF",
            borderLeft: "0.5px solid rgba(45,24,16,0.10)",
          }}>
            <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 700, color: "rgba(45,24,16,0.35)", letterSpacing: "0.07em", textTransform: "uppercase", paddingLeft: 16 }}>
              On this page
            </p>
            <nav>
              {headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  style={{
                    display: "block",
                    padding: "5px 16px",
                    fontSize: 12,
                    color: "rgba(45,24,16,0.55)",
                    textDecoration: "none",
                    lineHeight: 1.45,
                    borderLeft: "2px solid transparent",
                  }}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}
