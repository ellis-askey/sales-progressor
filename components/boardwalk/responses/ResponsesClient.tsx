"use client";

// Response management: analytics strip (views → starts → completions +
// completion rate), searchable table, per-response drawer with file links,
// CSV export, and deletion.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnswerValue, FormDefinition, Question, ResponseMeta } from "@/lib/forms/types";
import { formatAnswerForDisplay } from "@/lib/forms/csv";
import { formsApi } from "@/lib/forms/client";
import { BwButton, BwModal, useBwToast } from "../ui";

interface ResponseRow {
  id: string;
  answers: Record<string, AnswerValue>;
  meta: ResponseMeta | null;
  submittedAt: string;
}

interface Stats {
  totalResponses: number;
  last30Days: { views: number; starts: number; completions: number };
  completionRate: number | null;
  daily: { date: string; views: number; starts: number; completions: number }[];
}

interface ResponseDetail extends ResponseRow {
  files: { id: string; questionId: string; fileName: string; mimeType: string; sizeBytes: number; url: string | null }[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResponsesClient({
  formId,
  title,
  status,
  definition,
  responseCount,
}: {
  formId: string;
  title: string;
  status: string;
  definition: FormDefinition;
  responseCount: number;
}) {
  const { toast } = useBwToast();
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [detail, setDetail] = useState<ResponseDetail | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = useMemo(() => definition.questions.filter((q) => q.type !== "statement"), [definition]);
  // Table shows the first few columns; the drawer shows everything.
  const columns = questions.slice(0, 4);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        if (search.trim()) params.set("search", search.trim());
        const res = await formsApi<{ responses: ResponseRow[]; nextCursor: string | null }>(
          `/api/forms/${formId}/responses?${params}`
        );
        setRows((prev) => (cursor ? [...prev, ...res.responses] : res.responses));
        setNextCursor(res.nextCursor);
      } catch (err) {
        toast((err as Error).message, "error");
      } finally {
        setLoading(false);
      }
    },
    [formId, search, toast]
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    void formsApi<Stats>(`/api/forms/${formId}/stats`).then(setStats).catch(() => {});
  }, [formId]);

  async function openDetail(id: string) {
    try {
      const res = await formsApi<ResponseDetail>(`/api/forms/${formId}/responses/${id}`);
      setDetail(res);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setBusy(true);
    try {
      await formsApi(`/api/forms/${formId}/responses/${deleteId}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== deleteId));
      setDeleteId(null);
      setDetail(null);
      toast("Response removed.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1060, width: "100%", margin: "0 auto", padding: "26px 20px 80px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Link href={`/boardwalk/typeform/${formId}`} className="bw-btn bw-btn-ghost bw-btn-sm">
          ← Back to editor
        </Link>
        <h1 className="bw-display" style={{ fontSize: 22, margin: 0, flex: 1 }}>
          {title}
        </h1>
        <a className="bw-btn bw-btn-secondary bw-btn-sm" href={`/api/forms/${formId}/responses/export`} download>
          ⬇ Export CSV
        </a>
      </div>

      {/* Analytics strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 }}>
        <StatTile label="Total responses" value={String(responseCount)} />
        <StatTile label="Views · 30 days" value={String(stats?.last30Days.views ?? "–")} />
        <StatTile label="Starts · 30 days" value={String(stats?.last30Days.starts ?? "–")} />
        <StatTile
          label="Completion rate"
          value={stats?.completionRate !== null && stats !== null ? `${stats.completionRate}%` : "–"}
          hint={stats?.completionRate === null ? "Needs a few starts first" : undefined}
        />
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input
          className="bw-input bw-input-sm"
          placeholder="Search answers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>

      {/* Table */}
      {loading && rows.length === 0 ? (
        <div className="bw-card" style={{ padding: 40, textAlign: "center", color: "var(--bw-ink-faint)" }}>Loading responses…</div>
      ) : rows.length === 0 ? (
        <div className="bw-card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>📭</div>
          <h3 className="bw-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
            {search ? "Nothing matches that search" : "No responses yet"}
          </h3>
          <p className="bw-hint" style={{ margin: 0 }}>
            {search
              ? "Try different words. The search covers every answer."
              : status === "published"
                ? "Share the link and responses will appear here the moment they arrive."
                : "Publish the form to start collecting responses."}
          </p>
        </div>
      ) : (
        <div className="bw-card" style={{ overflow: "hidden" }}>
          <div className="bw-scroll" style={{ overflowX: "auto" }}>
            <table className="bw-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Submitted</th>
                  {columns.map((q) => (
                    <th key={q.id}>{q.title || "Untitled"}</th>
                  ))}
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => void openDetail(r.id)} style={{ cursor: "pointer" }}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--bw-ink-soft)" }}>{formatDate(r.submittedAt)}</td>
                    {columns.map((q) => (
                      <td key={q.id}>
                        <span style={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {formatAnswerForDisplay(q, r.answers[q.id]) || <span style={{ color: "var(--bw-ink-faint)" }}>–</span>}
                        </span>
                      </td>
                    ))}
                    <td style={{ textAlign: "right", color: "var(--bw-ink-faint)" }}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div style={{ padding: 12, textAlign: "center", borderTop: "1px solid var(--bw-line)" }}>
              <BwButton size="sm" loading={loading} onClick={() => void load(nextCursor)}>
                Load more
              </BwButton>
            </div>
          )}
        </div>
      )}

      {/* ── Detail drawer (modal) ── */}
      <BwModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Response · ${formatDate(detail.submittedAt)}` : "Response"}
        width={620}
        footer={
          detail ? (
            <>
              <BwButton variant="danger" onClick={() => setDeleteId(detail.id)}>Remove response</BwButton>
              <BwButton onClick={() => setDetail(null)}>Close</BwButton>
            </>
          ) : undefined
        }
      >
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {questions.map((q) => (
              <AnswerBlock key={q.id} q={q} value={detail.answers[q.id]} files={detail.files.filter((f) => f.questionId === q.id)} />
            ))}
            {detail.meta?.hidden && Object.keys(detail.meta.hidden).length > 0 && (
              <div style={{ borderTop: "1px solid var(--bw-line)", paddingTop: 12 }}>
                <p className="bw-label">Hidden fields</p>
                {Object.entries(detail.meta.hidden).map(([k, v]) => (
                  <p key={k} style={{ fontSize: 13, margin: "2px 0", fontFamily: "monospace" }}>
                    {k} = {v}
                  </p>
                ))}
              </div>
            )}
            {typeof detail.meta?.durationSeconds === "number" && (
              <p className="bw-hint" style={{ margin: 0 }}>
                Completed in {detail.meta.durationSeconds < 60 ? `${detail.meta.durationSeconds}s` : `${Math.round(detail.meta.durationSeconds / 60)}m`}
              </p>
            )}
          </div>
        )}
      </BwModal>

      {/* Delete confirm */}
      <BwModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Remove this response?"
        footer={
          <>
            <BwButton onClick={() => setDeleteId(null)}>Keep it</BwButton>
            <BwButton variant="primary" style={{ background: "var(--bw-red)" }} loading={busy} onClick={confirmDelete}>
              Remove
            </BwButton>
          </>
        }
      >
        <p style={{ fontSize: 14, margin: 0 }}>The response and any uploaded files will be removed permanently.</p>
      </BwModal>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bw-card" style={{ padding: "16px 18px" }}>
      <p className="bw-kicker" style={{ fontSize: 10, margin: "0 0 6px" }}>{label}</p>
      <p className="bw-display" style={{ fontSize: 28, margin: 0, lineHeight: 1 }}>{value}</p>
      {hint && <p className="bw-hint" style={{ margin: "4px 0 0" }}>{hint}</p>}
    </div>
  );
}

function AnswerBlock({
  q,
  value,
  files,
}: {
  q: Question;
  value: AnswerValue | undefined;
  files: { id: string; fileName: string; url: string | null; sizeBytes: number }[];
}) {
  const display = formatAnswerForDisplay(q, value);
  return (
    <div>
      <p style={{ fontSize: 12.5, fontWeight: 650, color: "var(--bw-ink-soft)", margin: "0 0 3px" }}>{q.title || "Untitled question"}</p>
      {files.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((f) =>
            f.url ? (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: "var(--bw-green-deep)", textDecoration: "underline" }}>
                📎 {f.fileName} ({Math.max(1, Math.round(f.sizeBytes / 1024))} KB)
              </a>
            ) : (
              <span key={f.id} style={{ fontSize: 14, color: "var(--bw-ink-faint)" }}>📎 {f.fileName} (unavailable)</span>
            )
          )}
        </div>
      ) : (
        <p style={{ fontSize: 14.5, margin: 0, whiteSpace: "pre-wrap" }}>
          {display || <span style={{ color: "var(--bw-ink-faint)" }}>Not answered</span>}
        </p>
      )}
    </div>
  );
}
