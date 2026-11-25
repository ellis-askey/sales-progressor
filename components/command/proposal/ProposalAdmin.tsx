"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProposalOverview, InvitationLink } from "@/lib/proposal/analytics";

// Founder-only analytics + administration for the Boardwalk proposal microsite.
// Utilitarian Command Centre styling (dark, hairline borders, blue accent).
// Never reachable by Nick or Jack — this lives entirely inside /command.

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(s: number | null): string {
  if (!s) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function ProposalAdmin({
  overview,
  links,
  origin,
}: {
  overview: ProposalOverview;
  links: InvitationLink[];
  origin: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const res = await fetch("/api/command/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error ?? "Action failed.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(token: string) {
    const url = `${origin}/proposal/boardwalk?i=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy the invitation link:", url);
    }
  }

  const maxViews = Math.max(1, ...overview.sections.map((s) => s.views));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Boardwalk proposal</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Private prospectus at <code className="text-neutral-400">/proposal/boardwalk</code> · access &amp; engagement analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overview.revoked ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-950 text-red-300 border border-red-900">Proposal is OFF</span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-900">Live · epoch {overview.epoch}</span>
          )}
        </div>
      </div>

      {!overview.migrated && (
        <div className="bg-amber-950/40 border border-amber-900 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-amber-300">Analytics tables not migrated yet</p>
          <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
            The proposal is live and the password gate works on the built-in default. Apply the{" "}
            <code>20261124000000_add_proposal_microsite</code> migration (staging first) to activate invitation links, access
            analytics and password rotation.
          </p>
        </div>
      )}

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Authenticated visits" value={overview.totals.authVisits} />
        <Stat label="Distinct sessions" value={overview.totals.distinctSessions} />
        <Stat label="Reached the close" value={overview.totals.reachedClose} />
        <Stat label="PDF downloads" value={overview.totals.pdfDownloads} />
        <Stat label="Return visits" value={overview.totals.returnVisits} />
        <Stat label="Avg session (approx)" value={fmtDuration(overview.avgSessionSeconds)} />
        <Stat label="Failed logins (7d)" value={overview.totals.failedAttempts7d} tone={overview.totals.failedAttempts7d > 10 ? "warn" : undefined} />
      </div>
      <p className="text-[11px] text-neutral-600">
        Headline figures exclude your own review link. Session duration is an approximate engagement signal, not proof of
        reading time. An invitation identifies which link was used, not necessarily who used it.
      </p>

      {/* Invitations */}
      <Card title="Invitation links">
        {links.length === 0 ? (
          <p className="text-xs text-neutral-500">No invitations yet. {overview.migrated ? "" : "Apply the migration, then reload."}
            {overview.migrated && (
              <button onClick={() => act("seed_invitations")} className="ml-2 text-blue-400 hover:text-blue-300" disabled={busy !== null}>Seed default links</button>
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-neutral-500 text-left">
                  <th className="pb-2 font-semibold">Recipient</th>
                  <th className="pb-2 font-semibold">Sessions</th>
                  <th className="pb-2 font-semibold">First seen</th>
                  <th className="pb-2 font-semibold">Last seen</th>
                  <th className="pb-2 font-semibold">Progress</th>
                  <th className="pb-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const stat = overview.invitations.find((i) => i.id === l.id);
                  return (
                    <tr key={l.id} className="border-t border-neutral-800">
                      <td className="py-2.5">
                        <span className="text-neutral-200 font-medium">{l.label}</span>
                        {l.isOwner && <span className="ml-2 text-[10px] text-neutral-500 uppercase">excluded</span>}
                        {l.revoked && <span className="ml-2 text-[10px] text-red-400 uppercase">revoked</span>}
                      </td>
                      <td className="py-2.5 text-neutral-400 tabular-nums">{stat?.sessions ?? 0}</td>
                      <td className="py-2.5 text-neutral-500 text-xs">{fmtDate(stat?.firstSeen ?? null)}</td>
                      <td className="py-2.5 text-neutral-500 text-xs">{fmtDate(stat?.lastSeen ?? null)}</td>
                      <td className="py-2.5 text-xs">
                        <span className={stat?.reachedClose ? "text-emerald-400" : "text-neutral-600"}>● close</span>
                        <span className={"ml-2 " + (stat?.downloadedPdf ? "text-blue-400" : "text-neutral-600")}>● pdf</span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => copyLink(l.token)} className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300">
                            {copied === l.token ? "Copied" : "Copy link"}
                          </button>
                          <button
                            onClick={() => act("set_invitation_revoked", { invitationId: l.id, revoked: !l.revoked })}
                            disabled={busy !== null}
                            className={"text-xs px-2 py-1 rounded " + (l.revoked ? "bg-emerald-900/50 text-emerald-300 hover:bg-emerald-900" : "bg-red-950/60 text-red-300 hover:bg-red-900/60")}
                          >
                            {l.revoked ? "Restore" : "Revoke"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section engagement */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Section engagement">
          <div className="space-y-2">
            {overview.sections.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 w-40 shrink-0 truncate">{s.label}</span>
                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(s.views / maxViews) * 100}%` }} />
                </div>
                <span className="text-xs text-neutral-500 tabular-nums w-16 text-right">{s.views} · {s.expands}↕</span>
              </div>
            ))}
            <p className="text-[11px] text-neutral-600 pt-1">Views · expands per section.</p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Calculators explored">
            {overview.calculators.length === 0 ? (
              <p className="text-xs text-neutral-500">None yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {overview.calculators.map((c) => (
                  <li key={c.detail} className="flex justify-between text-sm">
                    <span className="text-neutral-300">{c.detail}</span>
                    <span className="text-neutral-500 tabular-nums">{c.opens}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card title="Devices">
              <Breakdown rows={overview.devices.map((d) => ({ label: d.device, count: d.count }))} />
            </Card>
            <Card title="Regions">
              <Breakdown rows={overview.countries.map((c) => ({ label: c.country, count: c.count }))} />
            </Card>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <Card title="Recent activity">
        {overview.timeline.length === 0 ? (
          <p className="text-xs text-neutral-500">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-1.5 max-h-80 overflow-y-auto">
            {overview.timeline.map((t, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                <span className="text-neutral-600 tabular-nums w-24 shrink-0">{fmtDate(t.at)}</span>
                <span className="text-neutral-300 w-32 shrink-0 truncate">{t.invitation}</span>
                <span className="text-blue-400 w-32 shrink-0">{t.kind}</span>
                <span className="text-neutral-500 truncate">{t.section ?? t.detail ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Controls */}
      <Card title="Access control">
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-2">Rotate password (invalidates every live session)</label>
            <div className="flex gap-2">
              <input
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New access password"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200"
              />
              <button
                onClick={() => { if (newPw.trim().length >= 4) { act("rotate_password", { password: newPw.trim() }); setNewPw(""); } }}
                disabled={busy !== null || newPw.trim().length < 4}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium"
              >
                Rotate
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button onClick={() => act("revoke_all_sessions")} disabled={busy !== null} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm">
              Sign everyone out
            </button>
            {overview.revoked ? (
              <button onClick={() => act("set_revoked", { revoked: false })} disabled={busy !== null} className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium">
                Turn proposal back on
              </button>
            ) : (
              <button onClick={() => { if (confirm("Turn the whole proposal off? Nobody will be able to open it until you turn it back on.")) act("set_revoked", { revoked: true }); }} disabled={busy !== null} className="px-3 py-2 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-200 text-sm font-medium">
                Turn proposal off
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "warn" }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <div className={"text-2xl font-semibold tabular-nums " + (tone === "warn" ? "text-amber-400" : "text-neutral-100")}>{value}</div>
      <div className="text-[11px] text-neutral-500 mt-0.5">{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-neutral-300 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Breakdown({ rows }: { rows: { label: string; count: number }[] }) {
  if (rows.length === 0) return <p className="text-xs text-neutral-500">—</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.label} className="flex justify-between text-sm">
          <span className="text-neutral-300 capitalize">{r.label}</span>
          <span className="text-neutral-500 tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
