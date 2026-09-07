"use client";

// Pipeline at a glance — horizontal property-card pipeline.
//
// Six high-level stages (Just in / Moving / Legal work / Nearly there /
// Exchanged / Completed), each a card showing its real count and, where it has
// files, one real property preview (thumbnail + address + status) with a
// "+N more". Counts, samples and photos all derive from getHubPipelineStages
// (nothing hardcoded); the sample photo is signed upstream in PipelineStagesSlot.
//
// Progressive reveal: a stage the pipeline has reached is unlocked (shows its
// count, 0 included); the next unreached stage gets an "Up next" treatment;
// later unreached stages stay ghosted ("Not reached yet"). "Reached" is derived
// as the furthest stage with any files — since files only move forward, an empty
// middle stage below a populated later one stays unlocked.

import Link from "next/link";
import {
  FolderOpen, MagnifyingGlass, ChatCircleDots, CheckSquare, ArrowsClockwise, Key,
  Hourglass, Lock, ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import type { HubPipelineStages, PipelineSample } from "@/lib/services/hub";
import { GlassCard } from "@/components/glass/GlassCard";

const FALLBACK = "/property-photo-fallback.png";

type CardDef = {
  key: string;
  label: string;
  sub: string | null;
  status: string;
  tint: string;
  accent: string;
  Icon: typeof FolderOpen;
  count: number;
  sample: PipelineSample | null;
  // Deep-link to a filtered files view — only where that plumbing already
  // exists (Completed maps to the status filter). Null = no filtered route.
  filesHref: string | null;
};

export function PipelineAtAGlance({
  stages,
  signedPhotos,
}: {
  stages: HubPipelineStages;
  signedPhotos: Record<string, string>;
}) {
  const cards: CardDef[] = [
    { key: "justIn",    label: "Just in",      sub: "New & onboarding",       status: "New",       tint: "rgba(16,185,129,0.06)", accent: "#0d9488", Icon: FolderOpen,      count: stages.new.count + stages.onboarding.count, sample: stages.new.sample ?? stages.onboarding.sample, filesHref: null },
    { key: "moving",    label: "Moving",       sub: "Searches & early legals", status: "Searches",  tint: "rgba(59,130,246,0.06)", accent: "#2563eb", Icon: MagnifyingGlass, count: stages.searches.count,  sample: stages.searches.sample,  filesHref: null },
    { key: "legal",     label: "Legal work",   sub: "Enquiries",               status: "Enquiries", tint: "rgba(99,102,241,0.06)", accent: "#4f46e5", Icon: ChatCircleDots,  count: stages.enquiries.count, sample: stages.enquiries.sample, filesHref: null },
    { key: "nearly",    label: "Nearly there", sub: "Ready to exchange",        status: "Ready",     tint: "rgba(245,158,11,0.07)", accent: "#b45309", Icon: CheckSquare,     count: stages.ready.count,     sample: stages.ready.sample,     filesHref: null },
    { key: "exchanged", label: "Exchanged",    sub: null,                      status: "Exchanged", tint: "rgba(139,92,246,0.06)", accent: "#7c3aed", Icon: ArrowsClockwise, count: stages.exchanging.count, sample: stages.exchanging.sample, filesHref: null },
    { key: "completed", label: "Completed",    sub: null,                      status: "Completed", tint: "rgba(16,185,129,0.07)", accent: "#047857", Icon: Key,             count: stages.completed.count,  sample: stages.completed.sample,  filesHref: "/agent/transactions?filter=completed" },
  ];

  // Active sales = everything not yet completed (buckets 1–5).
  const activeFiles = cards.slice(0, 5).reduce((s, c) => s + c.count, 0);

  // Furthest reached = highest index with any files. Everything up to it is
  // unlocked; the next is "up next"; later stages stay ghosted.
  let furthest = -1;
  cards.forEach((c, i) => { if (c.count > 0) furthest = i; });

  const photoFor = (s: PipelineSample | null) =>
    s?.photoStoragePath ? (signedPhotos[s.photoStoragePath] ?? FALLBACK) : FALLBACK;

  return (
    <GlassCard glassId="hub-pipeline-glance" label="Hub · Pipeline at a glance" defaultVariant="v22" style={{ padding: "20px 24px", borderRadius: "var(--agent-radius-xl)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <p className="agent-eyebrow" style={{ marginBottom: 6 }}>Pipeline at a glance</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--agent-text-primary)" }}>
            {activeFiles} active {activeFiles === 1 ? "sale" : "sales"}
          </p>
          <p className="agent-card-subtitle" style={{ marginTop: 4 }}>Here&apos;s where every file sits right now.</p>
        </div>
        <Link href="/agent/transactions" className="agent-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap", textDecoration: "none" }}>
          View files <ArrowRight size={13} weight="bold" />
        </Link>
      </div>

      {/* Stage cards */}
      <div className="pipe-grid">
        {cards.map((c, i) => {
          if (i <= furthest) return <ReachedCard key={c.key} c={c} photo={photoFor(c.sample)} />;
          if (i === furthest + 1) return <UpNextCard key={c.key} c={c} />;
          return <GhostCard key={c.key} c={c} />;
        })}
      </div>
    </GlassCard>
  );
}

function ReachedCard({ c, photo }: { c: CardDef; photo: string }) {
  const moreCount = c.count - 1;
  return (
    <div className="pipe-card pipe-card-reached" style={{ background: c.tint }}>
      <div className="pipe-card-top">
        <span className="pipe-card-label">{c.label}</span>
        <span className="pipe-icon" style={{ background: `${c.accent}1f`, color: c.accent }}>
          <c.Icon size={15} weight="regular" />
        </span>
      </div>
      <div className="pipe-count">{c.count}</div>
      {c.sub && <div className="pipe-sub">{c.sub}</div>}

      {c.sample ? (
        <>
          <Link href={`/agent/transactions/${c.sample.id}`} className="pipe-prop">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" aria-hidden className="pipe-thumb" />
            <span className="pipe-prop-text">
              <span className="pipe-addr" data-sensitive="true">{c.sample.propertyAddress.split(",")[0].trim()}</span>
              <span className="pipe-status"><span className="pipe-dot" style={{ background: c.accent }} />{c.status}</span>
            </span>
          </Link>
          {moreCount > 0 && (
            c.filesHref
              ? <Link href={c.filesHref} className="pipe-more pipe-more-link">+{moreCount} more</Link>
              : <span className="pipe-more">+{moreCount} more</span>
          )}
        </>
      ) : (
        <div className="pipe-empty">Nothing here right now.</div>
      )}
    </div>
  );
}

function UpNextCard({ c }: { c: CardDef }) {
  return (
    <div className="pipe-card pipe-card-upnext">
      <div className="pipe-card-top">
        <span className="pipe-card-label">{c.label}</span>
      </div>
      <div className="pipe-upnext-body">
        <span className="pipe-upnext-badge"><Hourglass size={13} weight="regular" /> Up next</span>
        <p className="pipe-upnext-hint">Your sales move here as they progress.</p>
      </div>
    </div>
  );
}

function GhostCard({ c }: { c: CardDef }) {
  return (
    <div className="pipe-card pipe-card-ghost">
      <div className="pipe-card-top">
        <span className="pipe-card-label pipe-label-ghost">{c.label}</span>
      </div>
      <div className="pipe-ghost-body">
        <Lock size={16} weight="regular" />
        <span>Not reached yet</span>
      </div>
    </div>
  );
}
