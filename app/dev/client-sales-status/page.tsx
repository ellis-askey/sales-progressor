"use client";

// /dev/client-sales-status — PREVIEW of the proposed status pills on a client's
// (agency's) Sales list. Renders the exact `.aw-salerow` markup + styles from
// AgencyWorkspace, with the updated salePill. Final scheme:
//   Active (gray) · On hold (amber) · Exchanged (blue) · Completed (green) ·
//   Withdrawn (red). Drafts are filtered out of the list. Mock data only.

import { useState } from "react";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";

type SaleStatus = "draft" | "active" | "on_hold" | "completed" | "withdrawn";
type Sale = { id: string; address: string; status: SaleStatus; exchanged?: boolean };

// Mock sales covering every state the list can show. Fictional addresses only.
// Drafts are deliberately excluded — half-created sales are filtered out of the
// client's Sales list (consistent with the metrics, which don't count drafts).
const SALES: Sale[] = [
  { id: "1", address: "12 Walnut Tree Close, Berkhamsted, HP4 2AB", status: "active" },
  { id: "2", address: "8 Mandeville Rise, Tring, HP23 4DE", status: "active", exchanged: true },
  { id: "3", address: "3 Shrublands Road, Aylesbury, HP20 1TY", status: "on_hold" },
  { id: "4", address: "27 Gossoms End, Northchurch, HP4 1EH", status: "active" },
  { id: "5", address: "14 Station Approach, Cheddington, LU7 0SR", status: "completed" },
  { id: "6", address: "5 Cowper Court, Markyate, AL3 8PQ", status: "withdrawn" },
];

// Proposed pill logic. Exchanged is derived from exchangedAt (not a status), and
// only matters for an active sale — the terminal states are checked first.
function salePill(status: SaleStatus, exchanged?: boolean): { label: string; cls: string } {
  if (status === "completed") return { label: "Completed", cls: "done" };
  if (status === "withdrawn") return { label: "Withdrawn", cls: "withdrawn" };
  if (status === "on_hold") return { label: "On hold", cls: "hold" };
  if (status === "draft") return { label: "Draft", cls: "muted" }; // filtered upstream; here for safety
  if (exchanged) return { label: "Exchanged", cls: "exchanged" };
  return { label: "Active", cls: "active" };
}

function splitAddress(a: string): { main: string; sub: string | null } {
  const i = a.indexOf(",");
  if (i === -1) return { main: a, sub: null };
  const sub = a.slice(i + 1).trim();
  return { main: a.slice(0, i).trim(), sub: sub || null };
}

export default function ClientSalesStatusPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const dark = theme === "dark";

  return (
    <div className={`csroot ${dark ? "t-dark" : "t-light"}`} data-theme={theme}>
      <style>{CSS}</style>

      <div className="cswrap">
        <header className="cshead">
          <h1>Client sales &mdash; status pills</h1>
          <p>
            The Sales list on a client&rsquo;s page, with the proposed tags: Active (gray), On hold (amber), Exchanged (blue),
            Completed (green), Withdrawn (red). Drafts are hidden from the list.
          </p>
        </header>

        <div className="csctrls">
          <div className="seg">
            <button className={!dark ? "on" : ""} onClick={() => setTheme("light")}>Light</button>
            <button className={dark ? "on" : ""} onClick={() => setTheme("dark")}>Dark</button>
          </div>
        </div>

        {/* The agency "Sales" panel, mimicking AgencyWorkspace's card. */}
        <div className="aw-card">
          <div className="aw-sales-hdr"><h4>Sales</h4></div>
          <div>
            {SALES.map((s) => {
              const p = salePill(s.status, s.exchanged);
              const { main, sub } = splitAddress(s.address);
              return (
                <a key={s.id} href="#" onClick={(e) => e.preventDefault()} className="aw-salerow">
                  <span className="aw-salephoto"><span className="property-photo-fallback" aria-hidden /></span>
                  <span className="aw-saleinfo">
                    <span className="ad">{main}</span>
                    {sub && <span className="aw-salesub">{sub}</span>}
                  </span>
                  <span className={`aw-spill ${p.cls}`}>{p.label}</span>
                  <CaretRight size={15} weight="bold" className="aw-salechev" />
                </a>
              );
            })}
          </div>
        </div>

        <p className="csnote">
          Precedence when more than one could apply: Completed &rarr; Withdrawn &rarr; On hold &rarr; Exchanged &rarr; Active. Drafts are hidden.
        </p>
      </div>
    </div>
  );
}

const CSS = `
.csroot { min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; transition: background 180ms ease, color 180ms ease; }
.t-light {
  --agent-bg:#F3EEE6; --agent-surface-elevated:#ffffff;
  --agent-text-primary:#2A2320; --agent-text-secondary:#5C544C; --agent-text-muted:#8A8178;
  --agent-border-subtle:rgba(45,24,16,0.08); --agent-border-default:rgba(45,24,16,0.12);
  --agent-coral-deep:#F04E2C; --agent-coral-rgb:240,78,44; --agent-success:#2E9E6B;
  --agent-glass-bg:rgba(45,24,16,0.05);
  --pill-active-bg:rgba(113,118,128,0.14); --pill-active-fg:#5E636B;
  --pill-hold-bg:rgba(201,125,26,0.15); --pill-hold-fg:#9A5B0E;
  --pill-exch-bg:rgba(37,99,235,0.12); --pill-exch-fg:#1D4ED8;
  --pill-wdr-bg:rgba(220,38,38,0.11); --pill-wdr-fg:#C92A2A;
  background:
    radial-gradient(1000px 500px at 12% -10%, rgba(240,78,44,0.08), transparent 60%),
    var(--agent-bg);
  color: var(--agent-text-primary);
}
.t-dark {
  --agent-bg:#0e131a; --agent-surface-elevated:#1a2029;
  --agent-text-primary:#e8edf3; --agent-text-secondary:#b4bcc8; --agent-text-muted:#8a93a1;
  --agent-border-subtle:rgba(255,255,255,0.08); --agent-border-default:rgba(255,255,255,0.13);
  --agent-coral-deep:#FF6B4A; --agent-coral-rgb:255,107,74; --agent-success:#4ade80;
  --agent-glass-bg:rgba(255,255,255,0.07);
  --pill-active-bg:rgba(161,167,180,0.18); --pill-active-fg:#CDD3DD;
  --pill-hold-bg:rgba(251,191,36,0.16); --pill-hold-fg:#FBBF24;
  --pill-exch-bg:rgba(59,130,246,0.20); --pill-exch-fg:#93C5FD;
  --pill-wdr-bg:rgba(248,113,113,0.18); --pill-wdr-fg:#F8A9A9;
  background:
    radial-gradient(1000px 500px at 12% -10%, rgba(255,107,74,0.12), transparent 60%),
    var(--agent-bg);
  color: var(--agent-text-primary);
}

.cswrap { max-width: 620px; margin: 0 auto; padding: 40px 20px 100px; }
.cshead h1 { font-size: 22px; font-weight: 650; letter-spacing: -0.02em; margin: 0 0 8px; }
.cshead p { font-size: 13.5px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 22px; }

.csctrls { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.seg { display: inline-flex; background: var(--agent-surface-elevated); border: 1px solid var(--agent-border-default); border-radius: 10px; padding: 3px; gap: 2px; }
.seg button { appearance: none; border: none; background: none; font: inherit; font-size: 12.5px; font-weight: 550; color: var(--agent-text-secondary); padding: 6px 13px; border-radius: 7px; cursor: pointer; transition: all 140ms ease; }
.seg button:hover { color: var(--agent-text-primary); }
.seg button.on { background: rgba(var(--agent-coral-rgb), 0.14); color: var(--agent-coral-deep); }

.aw-card { background: var(--agent-surface-elevated); border: 1px solid var(--agent-border-subtle); border-radius: 16px; padding: 18px 18px 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.06); }
.aw-sales-hdr { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
.aw-sales-hdr h4 { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--agent-text-primary); }

/* Copied verbatim from AgencyWorkspace.tsx so the preview is exact. */
.aw-salerow { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--agent-border-subtle); text-decoration: none; transition: padding .15s; }
.aw-salerow:first-of-type { border-top: 0; }
.aw-salerow:hover { padding-left: 4px; }
.aw-salephoto { flex: none; width: 42px; height: 42px; border-radius: 9px; overflow: hidden; background: var(--agent-border-subtle); }
.aw-salephoto .property-photo-fallback { display: block; width: 100%; height: 100%; object-fit: cover; background: linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.18), rgba(var(--agent-coral-rgb),0.05)); }
.aw-saleinfo { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.aw-salerow .ad { font-size: 13px; font-weight: 600; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aw-salesub { font-size: 11.5px; color: var(--agent-text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aw-salechev { color: var(--agent-text-muted); flex-shrink: 0; }
.aw-spill { font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
.aw-spill.done { background: rgba(47,125,83,0.14); color: var(--agent-success); }
.aw-spill.muted { background: var(--agent-glass-bg); color: var(--agent-text-muted); }
.aw-spill.active { background: var(--pill-active-bg); color: var(--pill-active-fg); }
.aw-spill.hold { background: var(--pill-hold-bg); color: var(--pill-hold-fg); }
.aw-spill.exchanged { background: var(--pill-exch-bg); color: var(--pill-exch-fg); }
.aw-spill.withdrawn { background: var(--pill-wdr-bg); color: var(--pill-wdr-fg); }

.csnote { font-size: 11.5px; color: var(--agent-text-muted); line-height: 1.5; margin: 16px 2px 0; }
`;
