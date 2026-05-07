"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as examples from "./examples";

// ── Types ─────────────────────────────────────────────────────────────────────

type ComponentCall = { name: string; props: Record<string, string> };

type Segment =
  | { type: "markdown"; content: string }
  | { type: "component"; name: string; props: Record<string, string> }
  | { type: "component-group"; components: ComponentCall[] }
  | { type: "caption"; content: string }
  | { type: "helpsplit"; leftMarkdown: string; rightComponent: ComponentCall | null; caption: string | null };

// ── Parser ────────────────────────────────────────────────────────────────────

// Matches self-closing JSX like <FooExample bar="baz" /> or <FooExample />
const COMPONENT_RE = /<([A-Z][A-Za-z0-9]*)\s*([^>]*?)\s*\/>/g;

// Matches <div className="example-wrapper">...</div> (non-greedy, single-level)
const WRAPPER_RE = /<div\s+className="example-wrapper">([\s\S]*?)<\/div>/g;

// Matches <HelpSplit>...</HelpSplit> — two-column layout block
const HELPSPLIT_RE = /<HelpSplit>([\s\S]*?)<\/HelpSplit>/g;

// Matches <p className="caption">...</p> — explicit screenshot caption syntax
const CAPTION_RE = /<p\s+className="caption">([\s\S]*?)<\/p>/g;

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

  // Collect top-level wrapper blocks (example-wrapper and HelpSplit) sorted by position
  type WrapperToken = { index: number; length: number; emit: () => Segment | null };
  const wrappers: WrapperToken[] = [];

  WRAPPER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WRAPPER_RE.exec(source)) !== null) {
    const inner = m[1];
    const idx = m.index;
    const len = m[0].length;
    wrappers.push({
      index: idx, length: len,
      emit: () => {
        const calls = parseComponentCalls(inner);
        if (calls.length === 1) return { type: "component", name: calls[0].name, props: calls[0].props };
        if (calls.length > 1) return { type: "component-group", components: calls };
        return null;
      },
    });
  }

  HELPSPLIT_RE.lastIndex = 0;
  while ((m = HELPSPLIT_RE.exec(source)) !== null) {
    const inner = m[1];
    const idx = m.index;
    const len = m[0].length;
    wrappers.push({
      index: idx, length: len,
      emit: () => {
        const textMatch  = inner.match(/<HelpSplitText>([\s\S]*?)<\/HelpSplitText>/);
        const visualMatch = inner.match(/<HelpSplitVisual>([\s\S]*?)<\/HelpSplitVisual>/);
        const capMatch   = inner.match(/<p\s+className="caption">([\s\S]*?)<\/p>/);
        const leftMarkdown   = textMatch   ? textMatch[1].trim()  : "";
        const rightCalls     = visualMatch ? parseComponentCalls(visualMatch[1]) : [];
        const rightComponent = rightCalls.length > 0 ? rightCalls[0] : null;
        const caption        = capMatch    ? capMatch[1].trim()   : null;
        return { type: "helpsplit", leftMarkdown, rightComponent, caption };
      },
    });
  }

  wrappers.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const w of wrappers) {
    const before = source.slice(lastIndex, w.index);
    if (before.trim()) extractSegmentsFromText(before, segments);
    const seg = w.emit();
    if (seg) segments.push(seg);
    lastIndex = w.index + w.length;
  }

  const tail = source.slice(lastIndex);
  if (tail.trim()) extractSegmentsFromText(tail, segments);

  return segments;
}

// Within a block of text (no example-wrapper divs), extract standalone components and captions
// in document order by collecting all matches then sorting by position.
function extractSegmentsFromText(text: string, out: Segment[]): void {
  type Token = { index: number; length: number; segment: Segment };
  const tokens: Token[] = [];

  COMPONENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COMPONENT_RE.exec(text)) !== null) {
    tokens.push({
      index: m.index,
      length: m[0].length,
      segment: { type: "component", name: m[1], props: parseProps(m[2]) },
    });
  }

  CAPTION_RE.lastIndex = 0;
  let c: RegExpExecArray | null;
  while ((c = CAPTION_RE.exec(text)) !== null) {
    tokens.push({
      index: c.index,
      length: c[0].length,
      segment: { type: "caption", content: c[1].trim() },
    });
  }

  tokens.sort((a, b) => a.index - b.index);

  let lastIdx = 0;
  for (const { index, length, segment } of tokens) {
    const before = text.slice(lastIdx, index);
    if (before.trim()) out.push({ type: "markdown", content: before });
    out.push(segment);
    lastIdx = index + length;
  }

  const tail = text.slice(lastIdx);
  if (tail.trim()) out.push({ type: "markdown", content: tail });
}

// ── Text extraction (for td content checks) ──────────────────────────────────

function getNodeText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return getNodeText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
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
        <div id={id} style={{ margin: "32px 0 10px", paddingTop: 24, borderTop: "1px solid rgba(255,107,74,0.38)" }}>
          <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#FF6B4A", background: "rgba(255,107,74,0.10)", border: "0.5px solid rgba(255,107,74,0.25)", borderRadius: 5, padding: "2px 7px", letterSpacing: "0.05em", marginBottom: 5 }}>{code}</span>
          <h2 {...p} style={{ margin: 0, fontSize: 16, fontWeight: 650 as never, color: "#2D1810", lineHeight: 1.3 }}>{name}</h2>
        </div>
      );
    }
    return <h2 id={id} {...p} style={{ fontSize: 16, fontWeight: 650 as never, color: "#2D1810", margin: "32px 0 10px", paddingTop: 24, borderTop: "1px solid rgba(255,107,74,0.38)", lineHeight: 1.3 }}>{children}</h2>;
  },
  h3: (p) => <h3 {...p} style={{ fontSize: 14, fontWeight: 650 as never, color: "#3a2010", margin: "22px 0 8px", lineHeight: 1.3 }} />,
  p: (p) => <p {...p} style={{ margin: "0 0 13px", fontSize: 14, color: "#5A3A28", lineHeight: 1.7 }} />,
  ul: (p) => <ul {...p} className="help-ul" style={{ listStyle: "none", paddingLeft: 0, margin: "0 0 13px", fontSize: 14, color: "#5A3A28" }} />,
  ol: (p) => <ol {...p} className="help-ol" style={{ listStyle: "none", paddingLeft: 0, margin: "0 0 13px", fontSize: 14, color: "#5A3A28", counterReset: "step" }} />,
  li: (p) => <li {...p} style={{ lineHeight: 1.65 }} />,
  table: (p) => (
    <div style={{ overflowX: "auto", margin: "0 0 18px" }}>
      <table {...p} style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} />
    </div>
  ),
  thead: (p) => <thead {...p} style={{ background: "rgba(45,24,16,0.04)" }} />,
  th: ({ style, ...p }) => (
    <th {...p} style={{ padding: "8px 12px", textAlign: style?.textAlign ?? "left", fontWeight: 700, color: "#5A3A28", borderBottom: "2px solid rgba(45,24,16,0.10)", whiteSpace: "nowrap", fontSize: 12 }} />
  ),
  td: ({ style, children, ...p }) => {
    const text = getNodeText(children).trim();
    const isCheck = text === "✓";
    const isDash = text === "—";
    return (
      <td {...p} style={{
        padding: "8px 12px",
        textAlign: style?.textAlign ?? "left",
        borderBottom: "0.5px solid rgba(45,24,16,0.07)",
        verticalAlign: "top",
        color: isCheck ? "#FF6B4A" : isDash ? "rgba(45,24,16,0.25)" : "#5A3A28",
        fontWeight: isCheck ? 700 : 400,
      }}>{children}</td>
    );
  },
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
  img: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img
      src={src}
      alt={alt ?? ""}
      style={{
        display: "block",
        maxWidth: "100%",
        height: "auto",
        margin: "20px 0 6px",
        borderRadius: 6,
      }}
    />
  ),
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
      <style>{`
        .help-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          margin: 24px 0;
          align-items: start;
        }
        @media (max-width: 768px) {
          .help-split { grid-template-columns: 1fr; }
        }
        .help-ul > li {
          position: relative;
          padding-left: 1.375rem;
          margin-bottom: 0.45rem;
          line-height: 1.65;
        }
        .help-ul > li::before {
          content: "";
          position: absolute;
          left: 0.25rem;
          top: 0.57rem;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(var(--agent-coral-rgb), 0.75);
        }
        .help-ol > li {
          position: relative;
          padding-left: 1.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.65;
          counter-increment: step;
        }
        .help-ol > li::before {
          content: counter(step) ".";
          position: absolute;
          left: 0;
          top: 0;
          font-weight: 600;
          font-size: 14px;
          color: rgb(var(--agent-coral-rgb));
        }
      `}</style>
      {segments.map((seg, i) => {
        if (seg.type === "markdown") {
          return (
            <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={mdComponents as never}>
              {seg.content}
            </ReactMarkdown>
          );
        }
        if (seg.type === "caption") {
          return (
            <p key={i} style={{
              margin: "0 0 20px",
              fontSize: 12,
              color: "rgba(45,24,16,0.40)",
              fontStyle: "italic",
              textAlign: "center",
            }}>
              {seg.content}
            </p>
          );
        }
        if (seg.type === "component") {
          return (
            <ExampleWrapper key={i}>
              {renderComponentByName(seg.name, seg.props)}
            </ExampleWrapper>
          );
        }
        if (seg.type === "helpsplit") {
          return (
            <div key={i} className="help-split">
              {/* Left column — prose */}
              <div>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as never}>
                  {seg.leftMarkdown}
                </ReactMarkdown>
              </div>
              {/* Right column — live component + caption */}
              <div>
                {seg.rightComponent && renderComponentByName(seg.rightComponent.name, seg.rightComponent.props)}
                {seg.caption && (
                  <p style={{
                    margin: "8px 0 0",
                    fontSize: 12,
                    color: "rgba(45,24,16,0.40)",
                    fontStyle: "italic",
                    textAlign: "center",
                  }}>
                    {seg.caption}
                  </p>
                )}
              </div>
            </div>
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
