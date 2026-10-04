"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renderSpecimenAction, setSpecimenReviewed, setBucketEnabledAction, type RenderResult } from "./actions";
import { DEFAULT_SCENARIO, AUDIENCE_LABEL, LOCKED_BUCKETS, type Scenario, type EmailCategory, type IdentityTier, type AudienceBucket } from "@/lib/command/email-catalogue/scenario";
import type { SpecimenMeta } from "@/lib/command/email-catalogue/registry";

// A file-driven email (no fixed bucket) belongs to all three "who runs the file"
// buckets, so the filter shows it under any of them.
const FILE_BUCKETS: ReadonlySet<AudienceBucket> = new Set(["free_agency", "tsp_outsourced", "external_progression"]);
function matchesBucket(meta: SpecimenMeta, filter: AudienceBucket | "all"): boolean {
  if (filter === "all") return true;
  if (meta.bucket) return meta.bucket === filter;
  return FILE_BUCKETS.has(filter);
}
const BUCKET_ORDER: AudienceBucket[] = ["platform_admin", "tsp_outsourced", "free_agency", "progression_invite", "external_progression"];

const CATEGORY_ORDER: EmailCategory[] = ["client", "solicitor", "provider", "agent", "internal", "perfected"];
const CATEGORY_LABEL: Record<EmailCategory, string> = {
  client: "Client (buyer / seller)",
  solicitor: "Solicitor",
  provider: "Surveyor firms",
  agent: "Agent notifications",
  internal: "Internal",
  perfected: "Agent-facing (signed off)",
  chain: "Chain",
  platform: "Platform",
};

const MILESTONE_CODES = ["VM3", "VM7", "VM18", "VM19", "PM5", "PM9", "PM14", "PM25", "PM26"];

// Review state for one email, resolved on the server (DB-backed).
export type ReviewInfo = { reviewedAt: string; by: string | null; stale: boolean };

const AMBER = "#f59e0b";

function whenLabel(iso: string): string {
  // Compact "4 Oct" style; avoids locale surprises in the dark CC chrome.
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// Standard preview widths. Desktop = full pane (email max-width centres itself).
type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTHS: Record<Device, number | null> = { desktop: null, tablet: 768, mobile: 390 };

const ACCENT = "#2563eb";
const BORDER = "#262626";
const GREEN = "#22c55e";

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={{ background: active ? ACCENT : "transparent", color: active ? "#fff" : "#a3a3a3" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// One rung of the sender ladder: active rung marked, label chip, the variable
// (template) form, the filled example beneath it, and the condition.
function Tier({ t }: { t: IdentityTier }) {
  const showExample = t.value !== t.template;
  return (
    <div className="flex gap-2.5 py-2" style={{ opacity: t.active ? 1 : 0.72 }}>
      <span className="w-3 shrink-0 text-[12px] leading-6 text-center" style={{ color: t.active ? GREEN : "#3a3a3a" }}>
        {t.active ? "●" : "○"}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
            style={{ background: t.active ? "rgba(34,197,94,0.14)" : "#1a1a1a", color: t.active ? GREEN : "#737373" }}
          >
            {t.label}
          </span>
          <span className="text-[13px] font-mono text-neutral-100 break-all">{t.template}</span>
        </div>
        {showExample && <div className="text-[11px] font-mono text-neutral-500 mt-0.5 break-all">e.g. {t.value}</div>}
        <div className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">{t.condition}</div>
      </div>
    </div>
  );
}

export type CoverageSummary = {
  total: number;
  catalogued: number;
  missing: { kind: string; note?: string }[];
  brokenRefs: { kind: string; specimenId: string }[];
};

export function EmailCatalogue({ specimens, initialReviews, bucketStates, coverage }: { specimens: SpecimenMeta[]; initialReviews: Record<string, ReviewInfo>; bucketStates: Record<AudienceBucket, boolean>; coverage: CoverageSummary }) {
  const router = useRouter();
  const [savingBucket, setSavingBucket] = useState<AudienceBucket | null>(null);

  function toggleBucket(b: AudienceBucket, next: boolean) {
    if (LOCKED_BUCKETS.has(b) || savingBucket) return;
    setSavingBucket(b);
    void setBucketEnabledAction(b, next).then((r) => {
      setSavingBucket(null);
      if (r.ok) router.refresh();
    });
  }

  const [selectedId, setSelectedId] = useState<string>(specimens[0]?.id ?? "");
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingReview, setSavingReview] = useState(false);
  // Review state comes from the DB (shared + auditable). reviewed = set of ids.
  const reviews = initialReviews;
  const reviewed = useMemo(() => new Set(Object.keys(reviews)), [reviews]);
  const staleCount = useMemo(() => Object.values(reviews).filter((r) => r.stale).length, [reviews]);
  // Preview width. Defaults to desktop and is NOT persisted (fresh load = desktop);
  // stays put as you move between emails within a session, for a polish sweep.
  const [device, setDevice] = useState<Device>("desktop");
  const [bucketFilter, setBucketFilter] = useState<AudienceBucket | "all">("all");
  const deviceWidth = DEVICE_WIDTHS[device];

  const selected = useMemo(() => specimens.find((s) => s.id === selectedId), [specimens, selectedId]);

  const grouped = useMemo(() => {
    const map = new Map<EmailCategory, SpecimenMeta[]>();
    for (const s of specimens) {
      if (!matchesBucket(s, bucketFilter)) continue;
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [specimens, bucketFilter]);

  function toggleReviewed(id: string) {
    if (savingReview) return;
    const next = !reviewed.has(id);
    setSavingReview(true);
    void setSpecimenReviewed(id, next).then((r) => {
      setSavingReview(false);
      if (r.ok) router.refresh();
    });
  }

  useEffect(() => {
    if (!selectedId) return;
    startTransition(async () => {
      const r = await renderSpecimenAction(selectedId, scenario);
      setResult(r);
    });
  }, [selectedId, scenario]);

  const has = (axis: string) => selected?.axes.includes(axis as never) ?? false;
  const isReviewed = selectedId ? reviewed.has(selectedId) : false;
  const selectedReview = selectedId ? reviews[selectedId] : undefined;
  const isStale = selectedReview?.stale ?? false;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[22px] font-semibold text-neutral-100">Email catalogue</div>
        <div className="text-[12px] text-neutral-400 flex items-center gap-3">
          <span>
            Reviewed <span className="text-neutral-100 font-semibold">{reviewed.size}</span> / {specimens.length}
          </span>
          {staleCount > 0 && (
            <span style={{ color: AMBER }}>{staleCount} need re-review</span>
          )}
        </div>
      </div>
      <p className="mb-6 text-[13px] text-neutral-400 max-w-2xl">
        Every email the portal can send, rendered from the real builders under the scenario you pick.
        Tick each one once you&apos;ve reviewed and OK&apos;d it. Preview data only, nothing is sent.
      </p>

      {/* Completeness: every taxonomy'd agent/system email kind is accounted for
          (enforced at the type level). Shows how many map to a catalogue email and
          flags any not yet catalogued, so a new email can't silently skip here. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <span className="text-neutral-400">
          Coverage: <span className="text-neutral-100 font-semibold">{coverage.catalogued}</span> / {coverage.total} email kinds catalogued
        </span>
        {coverage.missing.length > 0 && (
          <span style={{ color: AMBER }}>
            {coverage.missing.length} not yet catalogued: {coverage.missing.map((m) => m.kind).join(", ")}
          </span>
        )}
        {coverage.brokenRefs.length > 0 && (
          <span style={{ color: "#f87171" }}>
            broken refs: {coverage.brokenRefs.map((b) => `${b.kind}→${b.specimenId}`).join(", ")}
          </span>
        )}
        {coverage.missing.length === 0 && coverage.brokenRefs.length === 0 && (
          <span style={{ color: GREEN }}>all mapped ✓</span>
        )}
      </div>

      {/* "Who it's for" filter — the five audience buckets the on/off switches act
          on. A file-driven email (client/solicitor/on-file) shows under any of the
          three file buckets, since who it's for follows who runs the file. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 mr-1">Who it&apos;s for</span>
        {(["all", ...BUCKET_ORDER] as const).map((b) => {
          const active = bucketFilter === b;
          const count = b === "all" ? specimens.length : specimens.filter((s) => matchesBucket(s, b)).length;
          const label = b === "all" ? "All" : AUDIENCE_LABEL[b];
          return (
            <button
              key={b}
              onClick={() => setBucketFilter(b)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5"
              style={{ background: active ? ACCENT : "#111", border: `1px solid ${active ? ACCENT : BORDER}`, color: active ? "#fff" : "#a3a3a3" }}
            >
              {label}
              <span className="text-[10px]" style={{ color: active ? "rgba(255,255,255,0.7)" : "#525252" }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Sending switches — the platform kill switches. Off = those emails stop
          sending immediately (locked buckets can't be switched off). */}
      <div className="mb-6 p-4 rounded-lg" style={{ background: "#111", border: `1px solid ${BORDER}` }}>
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2.5">Sending switches — turn a whole bucket off platform-wide</div>
        <div className="flex flex-wrap gap-2">
          {BUCKET_ORDER.map((b) => {
            const locked = LOCKED_BUCKETS.has(b);
            const on = bucketStates[b];
            const saving = savingBucket === b;
            return (
              <div key={b} className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "#0a0a0a", border: `1px solid ${on ? BORDER : "#7f1d1d"}` }}>
                <span className="text-[12px]" style={{ color: on ? "#e5e5e5" : "#f87171" }}>{AUDIENCE_LABEL[b]}</span>
                {locked ? (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: "#1a1a1a", color: "#737373" }}>always on</span>
                ) : (
                  <button
                    onClick={() => toggleBucket(b, !on)}
                    disabled={saving}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded transition-colors"
                    style={{ background: on ? "rgba(34,197,94,0.14)" : "rgba(248,113,113,0.14)", color: on ? GREEN : "#f87171", border: `1px solid ${on ? GREEN : "#f87171"}`, opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? "…" : on ? "On" : "Off"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-neutral-500 mt-2.5">Off = those emails stop sending immediately. Security emails (TSP admin) can&apos;t be switched off.</div>
      </div>

      <div className="flex gap-6" style={{ minHeight: 640 }}>
        {/* Left — specimen list */}
        <div className="w-72 shrink-0 space-y-5">
          {grouped.map((g) => (
            <div key={g.category}>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center justify-between">
                <span>{CATEGORY_LABEL[g.category]}</span>
                <span className="text-neutral-600">{g.items.filter((s) => reviewed.has(s.id)).length}/{g.items.length}</span>
              </div>
              <div className="space-y-1">
                {g.items.map((s) => {
                  const active = s.id === selectedId;
                  const done = reviewed.has(s.id);
                  const stale = reviews[s.id]?.stale ?? false;
                  const dotColor = stale ? AMBER : done ? GREEN : "transparent";
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2"
                      style={{ background: active ? "#15233f" : "transparent", border: `1px solid ${active ? ACCENT : "transparent"}` }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px]"
                        style={{ background: dotColor, border: done || stale ? "none" : `1px solid ${BORDER}`, color: "#0a0a0a" }}
                        title={stale ? "Reviewed, but the copy changed; needs re-review" : done ? "Reviewed & OK'd" : "Not reviewed"}
                      >
                        {stale ? "!" : done ? "✓" : ""}
                      </span>
                      <span className="text-[13px] text-neutral-100">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right — scenario + render */}
        <div className="flex-1 min-w-0">
          {/* Header: name + Reviewed toggle */}
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="text-[15px] font-semibold text-neutral-100">{selected?.name}</div>
            <div className="flex items-center gap-3 shrink-0">
              {isReviewed && selectedReview && (
                <span className="text-[11px] text-neutral-500">
                  {isStale ? "last reviewed" : "reviewed"} {whenLabel(selectedReview.reviewedAt)}
                  {selectedReview.by ? ` · ${selectedReview.by}` : ""}
                </span>
              )}
              <button
                onClick={() => selectedId && toggleReviewed(selectedId)}
                disabled={savingReview}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                style={{
                  background: isStale ? "rgba(245,158,11,0.12)" : isReviewed ? "rgba(34,197,94,0.12)" : "#111",
                  border: `1px solid ${isStale ? AMBER : isReviewed ? GREEN : BORDER}`,
                  color: isStale ? AMBER : isReviewed ? GREEN : "#a3a3a3",
                  opacity: savingReview ? 0.6 : 1,
                }}
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center text-[10px]"
                  style={{ background: isStale ? AMBER : isReviewed ? GREEN : "transparent", border: isReviewed || isStale ? "none" : `1px solid ${BORDER}`, color: "#0a0a0a" }}
                >
                  {isStale ? "!" : isReviewed ? "✓" : ""}
                </span>
                {savingReview ? "Saving…" : isStale ? "Needs re-review" : isReviewed ? "Reviewed & OK'd" : "Mark reviewed"}
              </button>
            </div>
          </div>

          {/* Scenario toolbar */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 rounded-lg mb-4" style={{ background: "#111", border: `1px solid ${BORDER}` }}>
            {(has("fileType") || (selected && !selected.bucket)) && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">File</span>
                <Seg
                  value={scenario.fileType}
                  onChange={(v) => setScenario((s) => ({ ...s, fileType: v }))}
                  options={[
                    { value: "self_managed", label: "Self-managed" },
                    { value: "outsourced", label: "Outsourced (us)" },
                    { value: "outsourced_external", label: "External business" },
                  ]}
                />
              </label>
            )}
            {has("side") && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Side</span>
                <Seg
                  value={scenario.side}
                  onChange={(v) => setScenario((s) => ({ ...s, side: v }))}
                  options={[
                    { value: "vendor", label: "Vendor" },
                    { value: "purchaser", label: "Buyer" },
                  ]}
                />
              </label>
            )}
            {has("theme") && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Brand</span>
                <Seg
                  value={scenario.theme}
                  onChange={(v) => setScenario((s) => ({ ...s, theme: v }))}
                  options={[
                    { value: "coral", label: "Coral" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
              </label>
            )}
            {has("milestoneCode") && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Milestone</span>
                <select
                  value={scenario.milestoneCode}
                  onChange={(e) => setScenario((s) => ({ ...s, milestoneCode: e.target.value }))}
                  className="px-2 py-1.5 text-[12px] rounded-md text-neutral-200"
                  style={{ background: "#0a0a0a", border: `1px solid ${BORDER}` }}
                >
                  {MILESTONE_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!selected?.axes.length && <span className="text-[11px] text-neutral-500">This email doesn&apos;t vary by scenario.</span>}
          </div>

          {/* Identity panel — ranked sender ladder (best case → fallbacks) */}
          <div className="p-4 rounded-lg mb-4" style={{ background: "#111", border: `1px solid ${BORDER}` }}>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">From</div>
            {result?.ok ? (
              result.fromTiers.map((t, i) => <Tier key={i} t={t} />)
            ) : (
              <div className="text-[13px] text-neutral-500 py-2">…</div>
            )}

            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              Reply-to
            </div>
            {result?.ok ? (
              result.replyToTiers.map((t, i) => <Tier key={i} t={t} />)
            ) : (
              <div className="text-[13px] text-neutral-500 py-2">…</div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-3 mt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Signature</div>
                <div className="text-[13px] text-neutral-200">{result?.ok ? result.signature : "…"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Brand theme</div>
                <div className="text-[13px] text-neutral-200">{result?.ok ? result.themeLabel : "…"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Who it&apos;s for</div>
                <div className="text-[13px] text-neutral-200 flex items-center gap-1.5">
                  {result?.ok ? result.bucketLabel : "…"}
                  {result?.ok && result.bucketLocked && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: "#1a1a1a", color: "#737373" }}>
                      always on
                    </span>
                  )}
                  {result?.ok && !result.bucketLocked && bucketStates[result.bucket] === false && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(248,113,113,0.14)", color: "#f87171" }}>
                      switched off
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {selected && (
            <p className="mb-3 text-[12px] text-neutral-500">
              <span className="text-neutral-300">Fires:</span> {selected.trigger}
            </p>
          )}

          {/* Render */}
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <div className="px-4 py-2.5 text-[12px] text-neutral-300 flex items-center justify-between gap-4" style={{ background: "#141414", borderBottom: `1px solid ${BORDER}` }}>
              <span className="truncate">
                <span className="text-neutral-500">Subject:</span> {result?.ok ? result.subject : pending ? "Rendering…" : ""}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {deviceWidth && <span className="text-[11px] text-neutral-500 font-mono">{deviceWidth}px</span>}
                <Seg
                  value={device}
                  onChange={setDevice}
                  options={[
                    { value: "desktop", label: "Desktop" },
                    { value: "tablet", label: "Tablet" },
                    { value: "mobile", label: "Mobile" },
                  ]}
                />
              </div>
            </div>
            {result && !result.ok ? (
              <div className="p-6 text-[13px] text-red-400" style={{ background: "#fff" }}>
                Could not render: {result.error}
              </div>
            ) : (
              <div style={{ background: "#0a0a0a", display: "flex", justifyContent: "center", padding: deviceWidth ? 20 : 0 }}>
                <iframe
                  title="email-preview"
                  sandbox=""
                  srcDoc={result?.ok ? result.html : ""}
                  style={{
                    width: deviceWidth ?? "100%",
                    maxWidth: "100%",
                    height: 720,
                    background: "#fff",
                    border: deviceWidth ? `1px solid ${BORDER}` : "none",
                    borderRadius: deviceWidth ? 12 : 0,
                    display: "block",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
