"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as examples from "./examples";

// ── Types ─────────────────────────────────────────────────────────────────────

type ComponentCall = { name: string; props: Record<string, string> };

type Segment =
  | { type: "markdown"; content: string }
  | { type: "component"; name: string; props: Record<string, string> }
  | { type: "component-group"; components: ComponentCall[] };

// ── Parser ────────────────────────────────────────────────────────────────────

// Matches self-closing JSX like <FooExample bar="baz" /> or <FooExample />
const COMPONENT_RE = /<([A-Z][A-Za-z0-9]*)\s*([^>]*?)\s*\/>/g;

// Matches <div className="example-wrapper">...</div> (non-greedy, single-level)
const WRAPPER_RE = /<div\s+className="example-wrapper">([\s\S]*?)<\/div>/g;

function parseProps(raw: string): Record<string, string> {
  const props: Record<string, string> = {};
  const attrRe = /(\w+)=["']([^"']*)["']|(\w+)=\{([^}]*)\}|(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(raw)) !== null) {
    if (m[1] && m[2] !== undefined) props[m[1]] = m[2];
    else if (m[3] && m[4] !== undefined) props[m[3]] = m[4];
    else if (m[5]) props[m[5]] = "true";
  }
  return props;
}

function parseComponentCalls(source: string): ComponentCall[] {
  const calls: ComponentCall[] = [];
  COMPONENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COMPONENT_RE.exec(source)) !== null) {
    calls.push({ name: m[1], props: parseProps(m[2]) });
  }
  return calls;
}

function parseSegments(source: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  // First pass: detect example-wrapper groups
  WRAPPER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WRAPPER_RE.exec(source)) !== null) {
    const before = source.slice(lastIndex, match.index);
    if (before.trim()) {
      // Within the before-text, still parse any standalone component calls
      extractSegmentsFromText(before, segments);
    }

    const inner = match[1];
    const calls = parseComponentCalls(inner);
    if (calls.length === 1) {
      segments.push({ type: "component", name: calls[0].name, props: calls[0].props });
    } else if (calls.length > 1) {
      segments.push({ type: "component-group", components: calls });
    }

    lastIndex = match.index + match[0].length;
  }

  const tail = source.slice(lastIndex);
  if (tail.trim()) extractSegmentsFromText(tail, segments);

  return segments;
}

// Within a block of text that has no example-wrapper divs, extract standalone component calls
function extractSegmentsFromText(text: string, out: Segment[]): void {
  COMPONENT_RE.lastIndex = 0;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = COMPONENT_RE.exec(text)) !== null) {
    const before = text.slice(lastIdx, m.index);
    if (before.trim()) out.push({ type: "markdown", content: before });
    out.push({ type: "component", name: m[1], props: parseProps(m[2]) });
    lastIdx = m.index + m[0].length;
  }

  const tail = text.slice(lastIdx);
  if (tail.trim()) out.push({ type: "markdown", content: tail });
}

// ── Slug helper (must match page.tsx) ─────────────────────────────────────────

function slugify(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Wrappers ──────────────────────────────────────────────────────────────────

function ExampleWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: "24px 0", padding: "20px",
      background: "rgba(255,245,236,0.60)",
      border: "0.5px solid rgba(255,138,101,0.20)",
      borderRadius: 12, display: "flex", gap: 12, flexWrap: "wrap",
    }}>
      {children}
    </div>
  );
}

// ── Markdown styled components ────────────────────────────────────────────────

const mdComponents: Record<string, React.ComponentType<React.HTMLAttributes<HTMLElement>>> = {
  h1: (p) => <h1 {...p} style={{ fontSize: 24, fontWeight: 700, color: "#2D1810", margin: "0 0 18px", lineHeight: 1.2, letterSpacing: "-0.01em" }} />,
  h2: ({ children, ...p }) => {
    const text = String(children ?? "");
    const id = slugify(text);
    // Detect milestone code prefix: "VM1 — Name" or "PM25 — Name ⭐ Note"
    const milestoneMatch = text.match(/^([VP]M\d+)\s+[—\-]\s+(.+)$/);
    if (milestoneMatch) {
      const [, code, name] = milestoneMatch;
      return (
        <div id={id} style={{ margin: "32px 0 10px", paddingTop: 24, borderTop: "0.5px solid rgba(45,24,16,0.08)" }}>
          <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#FF6B4A", background: "rgba(255,107,74,0.10)", border: "0.5px solid rgba(255,107,74,0.25)", borderRadius: 5, padding: "2px 7px", letterSpacing: "0.05em", marginBottom: 5 }}>{code}</span>
          <h2 {...p} style={{ margin: 0, fontSize: 16, fontWeight: 650 as never, color: "#2D1810", lineHeight: 1.3 }}>{name}</h2>
        </div>
      );
    }
    return <h2 id={id} {...p} style={{ fontSize: 16, fontWeight: 650 as never, color: "#2D1810", margin: "32px 0 10px", paddingTop: 24, borderTop: "0.5px solid rgba(45,24,16,0.08)", lineHeight: 1.3 }}>{children}</h2>;
  },
  h3: (p) => <h3 {...p} style={{ fontSize: 14, fontWeight: 650 as never, color: "#3a2010", margin: "22px 0 8px", lineHeight: 1.3 }} />,
  p: (p) => <p {...p} style={{ margin: "0 0 13px", fontSize: 14, color: "#5A3A28", lineHeight: 1.7 }} />,
  ul: (p) => <ul {...p} style={{ margin: "0 0 13px", paddingLeft: 20, fontSize: 14, color: "#5A3A28" }} />,
  ol: (p) => <ol {...p} style={{ margin: "0 0 13px", paddingLeft: 20, fontSize: 14, color: "#5A3A28" }} />,
  li: (p) => <li {...p} style={{ margin: "0 0 5px", lineHeight: 1.65 }} />,
  table: (p) => (
    <div style={{ overflowX: "auto", margin: "0 0 18px" }}>
      <table {...p} style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} />
    </div>
  ),
  thead: (p) => <thead {...p} style={{ background: "rgba(255,107,74,0.05)" }} />,
  th: (p) => <th {...p} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#5A3A28", borderBottom: "2px solid rgba(45,24,16,0.10)", whiteSpace: "nowrap", fontSize: 12 }} />,
  td: (p) => <td {...p} style={{ padding: "8px 12px", borderBottom: "0.5px solid rgba(45,24,16,0.07)", verticalAlign: "top", color: "#5A3A28" }} />,
  code: ({ children, className, ...p }: React.HTMLAttributes<HTMLElement>) => {
    if (className?.startsWith("language-")) {
      return (
        <pre style={{ background: "#FFFBF5", border: "0.5px solid rgba(45,24,16,0.10)", borderRadius: 8, padding: "12px 14px", overflowX: "auto", margin: "0 0 16px", fontSize: 12, lineHeight: 1.65 }}>
          <code className={className} {...p}>{children}</code>
        </pre>
      );
    }
    return <code {...p} style={{ background: "rgba(255,107,74,0.08)", color: "#C73E3E", borderRadius: 4, padding: "2px 5px", fontSize: "0.88em", fontFamily: "ui-monospace, monospace" }}>{children}</code>;
  },
  strong: (p) => <strong {...p} style={{ fontWeight: 700, color: "#2D1810" }} />,
  a: ({ href, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...p} style={{ color: "#FF6B4A", textDecoration: "none", fontWeight: 500, borderBottom: "0.5px solid rgba(255,107,74,0.35)" }}>
      {children}
    </a>
  ),
  blockquote: (p) => <blockquote {...p} style={{ borderLeft: "3px solid #FF8A65", paddingLeft: 14, margin: "0 0 14px", color: "rgba(45,24,16,0.65)" }} />,
  hr: () => <hr style={{ border: "none", borderTop: "0.5px solid rgba(45,24,16,0.10)", margin: "26px 0" }} />,
};

// ── Component renderer ────────────────────────────────────────────────────────

const componentMap = examples as Record<string, ((props: Record<string, string>) => React.ReactNode) | undefined>;

function renderComponentByName(name: string, props: Record<string, string>) {
  const Comp = componentMap[name] as ((p: Record<string, string>) => React.ReactNode) | undefined;
  if (!Comp) return <p style={{ color: "#C73E3E", fontSize: 12 }}>Unknown component: {name}</p>;
  return <Comp {...props} />;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function HelpContent({ source }: { source: string }) {
  const segments = parseSegments(source);

  return (
    <div>
      {segments.map((seg, i) => {
        if (seg.type === "markdown") {
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={mdComponents as never}>
              {seg.content}
            </ReactMarkdown>
          );
        }
        if (seg.type === "component") {
          return (
            <ExampleWrapper key={i}>
              {renderComponentByName(seg.name, seg.props)}
            </ExampleWrapper>
          );
        }
        // component-group
        return (
          <ExampleWrapper key={i}>
            {seg.components.map((c, j) => <span key={j}>{renderComponentByName(c.name, c.props)}</span>)}
          </ExampleWrapper>
        );
      })}
    </div>
  );
}
