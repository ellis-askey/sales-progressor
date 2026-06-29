// /dev/gallery/skeleton — Skeleton primitive showcase.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SkeletonGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main style={{ minHeight: "100vh", padding: "48px 32px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
        <header>
          <Link href="/dev/gallery" style={{
            fontSize: 13,
            color: "var(--agent-text-muted)",
            textDecoration: "none",
          }}>
            ← All primitives
          </Link>
          <h1 style={{
            margin: "8px 0 0",
            fontSize: 32,
            fontWeight: 700,
            color: "var(--agent-text-primary)",
            letterSpacing: "var(--agent-tracking-tight)",
          }}>
            Skeleton
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Loading state placeholder. Four variants: line, block, circle, card. Shimmer animation honours <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>prefers-reduced-motion</code> via the <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>agent-shimmer</code> keyframe.
          </p>
        </header>

        <Section title="Line" subtitle="single-line text placeholder; default width 100%, height 12px">
          <div data-testid="skel-line-default" style={{ marginBottom: 8 }}>
            <Skeleton variant="line" />
          </div>
          <div data-testid="skel-line-80" style={{ marginBottom: 8 }}>
            <Skeleton variant="line" width="80%" />
          </div>
          <div data-testid="skel-line-40">
            <Skeleton variant="line" width="40%" />
          </div>
        </Section>

        <Section title="Block" subtitle="rectangular content area; default 100% × 80px">
          <div data-testid="skel-block-default" style={{ marginBottom: 12 }}>
            <Skeleton variant="block" />
          </div>
          <div data-testid="skel-block-custom">
            <Skeleton variant="block" width="50%" height={140} />
          </div>
        </Section>

        <Section title="Circle" subtitle="avatar, role icon, status badge; default 32px">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div data-testid="skel-circle-24"><Skeleton variant="circle" width={24} /></div>
            <div data-testid="skel-circle-32"><Skeleton variant="circle" /></div>
            <div data-testid="skel-circle-48"><Skeleton variant="circle" width={48} /></div>
            <div data-testid="skel-circle-64"><Skeleton variant="circle" width={64} /></div>
          </div>
        </Section>

        <Section title="Card" subtitle="full card placeholder; renders circle avatar + 3 lines inside a glass-card">
          <div data-testid="skel-card">
            <Skeleton variant="card" />
          </div>
        </Section>

        <Section title="Composition" subtitle="real-world use: stand in for a contact row while loading">
          <div data-testid="skel-row" className="glass-card rounded-[12px]" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Skeleton variant="circle" width={36} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton variant="line" width="50%" />
                <Skeleton variant="line" width="30%" />
              </div>
              <Skeleton variant="block" width={72} height={28} />
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--agent-text-muted)",
      }}>
        {title}
      </p>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--agent-text-secondary)" }}>
        {subtitle}
      </p>
      {children}
    </section>
  );
}
