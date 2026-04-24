"use client";

import { useState } from "react";
import {
  CheckCircle, WarningCircle, Info, Warning,
  X, MagnifyingGlass, ArrowRight, Trash,
  SmileyWink, FolderOpen, Plus,
} from "@phosphor-icons/react";

/* ─── Section wrapper ──────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <p className="agent-eyebrow" style={{ marginBottom: 20 }}>{title}</p>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {label && <p style={{ fontSize: 11, color: "var(--agent-text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function SystemPreviewPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [tab, setTab] = useState("all");
  const [inputVal, setInputVal] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <p className="agent-eyebrow" style={{ marginBottom: 6 }}>Agent Design System</p>
        <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
          Component Library
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: "var(--agent-text-body)", color: "var(--agent-text-secondary)" }}>
          Every component, every state. The source of truth for all agent pages.
        </p>
      </div>

      {/* ── Colour tokens ─────────────────────────────────────────────────────── */}
      <Section title="Colour tokens">
        <Row label="Backgrounds">
          {[
            ["--agent-bg-base",  "#FFF5EC", "bg-base"],
            ["--agent-bg-mid",   "#FFE8D4", "bg-mid"],
            ["--agent-bg-warm",  "#FFDABD", "bg-warm"],
            ["--agent-bg-deep",  "#FFCBA4", "bg-deep"],
            ["--agent-bg-paper", "#FFFBF5", "bg-paper"],
          ].map(([, hex, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, background: hex, border: "0.5px solid var(--agent-border-default)", marginBottom: 6 }} />
              <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-muted)" }}>{label}</p>
              <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-disabled)", fontFamily: "monospace" }}>{hex}</p>
            </div>
          ))}
        </Row>
        <Row label="Coral / brand">
          {[
            ["#FFD4C2", "pale"],
            ["#FFB18F", "light"],
            ["#FF8A65", "coral"],
            ["#FF6B4A", "deep"],
            ["#E55B3D", "darker"],
          ].map(([hex, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, background: hex, marginBottom: 6 }} />
              <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-muted)" }}>{label}</p>
            </div>
          ))}
        </Row>
        <Row label="Semantic">
          {[
            ["var(--agent-success)", "success", "var(--agent-success-bg)"],
            ["var(--agent-warning)", "warning", "var(--agent-warning-bg)"],
            ["var(--agent-danger)",  "danger",  "var(--agent-danger-bg)"],
            ["var(--agent-info)",    "info",    "var(--agent-info-bg)"],
          ].map(([color, label, bg]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, background: bg as string, border: `1.5px solid ${color}`, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: color as string }} />
              </div>
              <p style={{ margin: 0, fontSize: 10, color: "var(--agent-text-muted)" }}>{label}</p>
            </div>
          ))}
        </Row>
      </Section>

      {/* ── Surfaces ──────────────────────────────────────────────────────────── */}
      <Section title="Surfaces">
        <Row>
          <div className="agent-glass" style={{ padding: "20px 24px", minWidth: 180 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Glass</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>50% white, blur 24px</p>
          </div>
          <div className="agent-glass-strong" style={{ padding: "20px 24px", minWidth: 180 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Glass strong</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>70% white, blur 24px</p>
          </div>
          <div className="agent-glass-subtle" style={{ padding: "20px 24px", minWidth: 180 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Glass subtle</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>35% white, blur 16px</p>
          </div>
          <div className="agent-surface" style={{ padding: "20px 24px", minWidth: 180 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Solid surface</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>For data-dense areas</p>
          </div>
          <div className="agent-surface-elevated" style={{ padding: "20px 24px", minWidth: 180 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Elevated</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>Modals, dropdowns</p>
          </div>
        </Row>
      </Section>

      {/* ── Typography ────────────────────────────────────────────────────────── */}
      <Section title="Typography">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { size: "var(--agent-text-display)", label: "Display — 32px", weight: "var(--agent-weight-semibold)", tracking: "var(--agent-tracking-tight)" },
            { size: "var(--agent-text-h1)",      label: "H1 — 28px",      weight: "var(--agent-weight-semibold)", tracking: "var(--agent-tracking-tight)" },
            { size: "var(--agent-text-h2)",      label: "H2 — 22px",      weight: "var(--agent-weight-medium)"   },
            { size: "var(--agent-text-h3)",      label: "H3 — 17px",      weight: "var(--agent-weight-medium)"   },
            { size: "var(--agent-text-h4)",      label: "H4 — 15px",      weight: "var(--agent-weight-medium)"   },
            { size: "var(--agent-text-body)",    label: "Body — 14px",     weight: "var(--agent-weight-regular)"  },
            { size: "var(--agent-text-body-sm)", label: "Body sm — 13px",  weight: "var(--agent-weight-regular)"  },
            { size: "var(--agent-text-caption)", label: "Caption — 12px",  weight: "var(--agent-weight-regular)"  },
            { size: "var(--agent-text-micro)",   label: "Micro — 11px",    weight: "var(--agent-weight-medium)"   },
          ].map(({ size, label, weight, tracking }) => (
            <p key={label} style={{ margin: 0, fontSize: size, fontWeight: weight, color: "var(--agent-text-primary)", letterSpacing: tracking ?? 0, lineHeight: "var(--agent-line-tight)" }}>
              {label}
            </p>
          ))}
          <p className="agent-eyebrow">Eyebrow — 10px uppercase</p>
        </div>
      </Section>

      {/* ── Buttons ───────────────────────────────────────────────────────────── */}
      <Section title="Buttons">
        <Row label="Primary — sizes">
          <button className="agent-btn agent-btn-primary agent-btn-sm">Small</button>
          <button className="agent-btn agent-btn-primary agent-btn-md">Default</button>
          <button className="agent-btn agent-btn-primary agent-btn-lg">Large</button>
          <button className="agent-btn agent-btn-primary agent-btn-md" disabled>Disabled</button>
          <button className="agent-btn agent-btn-primary agent-btn-md" style={{ pointerEvents: "none" }}>
            <span className="agent-btn-spinner" /> Loading
          </button>
        </Row>
        <Row label="Secondary">
          <button className="agent-btn agent-btn-secondary agent-btn-sm">Small</button>
          <button className="agent-btn agent-btn-secondary agent-btn-md">Default</button>
          <button className="agent-btn agent-btn-secondary agent-btn-lg">Large</button>
          <button className="agent-btn agent-btn-secondary agent-btn-md" disabled>Disabled</button>
        </Row>
        <Row label="Ghost">
          <button className="agent-btn agent-btn-ghost agent-btn-sm">Small</button>
          <button className="agent-btn agent-btn-ghost agent-btn-md">Default</button>
          <button className="agent-btn agent-btn-ghost agent-btn-md" disabled>Disabled</button>
        </Row>
        <Row label="Destructive">
          <button className="agent-btn agent-btn-danger agent-btn-md">
            <Trash style={{ width: 15, height: 15 }} />
            Delete
          </button>
          <button className="agent-btn agent-btn-danger agent-btn-md" disabled>Disabled</button>
        </Row>
        <Row label="Icon buttons">
          <button className="agent-btn agent-btn-primary agent-btn-icon-sm" title="Search">
            <MagnifyingGlass style={{ width: 15, height: 15 }} />
          </button>
          <button className="agent-btn agent-btn-primary agent-btn-icon-md" title="Search">
            <MagnifyingGlass style={{ width: 18, height: 18 }} />
          </button>
          <button className="agent-btn agent-btn-secondary agent-btn-icon-md" title="Search">
            <MagnifyingGlass style={{ width: 18, height: 18 }} />
          </button>
          <button className="agent-btn agent-btn-ghost agent-btn-icon-md" title="Close">
            <X style={{ width: 18, height: 18 }} />
          </button>
          <button className="agent-btn agent-btn-danger agent-btn-icon-md" title="Delete">
            <Trash style={{ width: 18, height: 18 }} />
          </button>
        </Row>
        <Row label="With icons">
          <button className="agent-btn agent-btn-primary agent-btn-md">
            <Plus style={{ width: 16, height: 16 }} weight="bold" />
            New Transaction
          </button>
          <button className="agent-btn agent-btn-secondary agent-btn-md">
            Continue
            <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
        </Row>
      </Section>

      {/* ── Form inputs ───────────────────────────────────────────────────────── */}
      <Section title="Form inputs">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 700 }}>
          <div>
            <label className="agent-label">Default</label>
            <input className="agent-input" placeholder="e.g. 14 Elmwood Avenue" value={inputVal} onChange={e => setInputVal(e.target.value)} />
          </div>
          <div>
            <label className="agent-label agent-label-required">Required field</label>
            <input className="agent-input" placeholder="Required" />
          </div>
          <div>
            <label className="agent-label">Small</label>
            <input className="agent-input agent-input-sm" placeholder="Small input" />
          </div>
          <div>
            <label className="agent-label">Large</label>
            <input className="agent-input agent-input-lg" placeholder="Large input" />
          </div>
          <div>
            <label className="agent-label">Error state</label>
            <input className="agent-input agent-input-error" defaultValue="bad value" />
            <p className="agent-helper-error">This field is required</p>
          </div>
          <div>
            <label className="agent-label">Success state</label>
            <input className="agent-input agent-input-success" defaultValue="valid@email.co.uk" />
            <p className="agent-helper-ok">Looks good</p>
          </div>
          <div>
            <label className="agent-label">Disabled</label>
            <input className="agent-input" placeholder="Not editable" disabled />
          </div>
          <div>
            <label className="agent-label">Read-only</label>
            <input className="agent-input" readOnly defaultValue="42 Church Street" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="agent-label">Textarea</label>
            <textarea className="agent-textarea" placeholder="Add notes about this transaction…" rows={3} />
            <p className="agent-helper">Optional — visible to your team</p>
          </div>
        </div>
      </Section>

      {/* ── Checkboxes & toggles ──────────────────────────────────────────────── */}
      <Section title="Controls">
        <Row label="Checkbox">
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <button
              role="checkbox"
              aria-checked={checked}
              onClick={() => setChecked(v => !v)}
              style={{
                width: 16, height: 16, borderRadius: 4, border: `0.5px solid ${checked ? "var(--agent-coral-deep)" : "var(--agent-border-strong)"}`,
                background: checked ? "var(--agent-coral-deep)" : "rgba(255,255,255,0.52)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, transition: "all var(--agent-transition-fast)",
              }}>
              {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            <span style={{ fontSize: 13, color: "var(--agent-text-primary)" }}>Checked: {checked ? "yes" : "no"}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.4 }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: "0.5px solid var(--agent-border-strong)", background: "rgba(255,255,255,0.52)" }} />
            <span style={{ fontSize: 13, color: "var(--agent-text-primary)" }}>Disabled unchecked</span>
          </label>
        </Row>
        <Row label="Toggle">
          <button
            role="switch"
            aria-checked={toggled}
            onClick={() => setToggled(v => !v)}
            style={{
              width: 36, height: 20, borderRadius: 10, padding: 2,
              background: toggled ? "var(--agent-coral-deep)" : "var(--agent-border-strong)",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center",
              transition: "background var(--agent-transition-base)",
            }}>
            <div style={{
              width: 16, height: 16, borderRadius: 8, background: "#fff",
              boxShadow: "0 1px 3px rgba(45,24,16,0.15)",
              transform: toggled ? "translateX(16px)" : "translateX(0)",
              transition: "transform var(--agent-transition-base)",
            }} />
          </button>
          <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>{toggled ? "On" : "Off"}</span>
        </Row>
      </Section>

      {/* ── Status pills ──────────────────────────────────────────────────────── */}
      <Section title="Status pills & badges">
        <Row label="Status">
          <span className="agent-pill agent-pill-active">Active</span>
          <span className="agent-pill agent-pill-hold">On Hold</span>
          <span className="agent-pill agent-pill-completed">Completed</span>
          <span className="agent-pill agent-pill-withdrawn">Withdrawn</span>
        </Row>
        <Row label="Count badges">
          <span className="agent-badge">12</span>
          <span className="agent-badge agent-badge-coral">3</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>Unread</span>
            <span className="agent-notif-dot" />
          </div>
        </Row>
        <Row label="Risk">
          {[
            ["var(--agent-success)", "Low risk"],
            ["var(--agent-warning)", "Medium risk"],
            ["var(--agent-danger)",  "High risk"],
          ].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: color as string, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>{label}</span>
            </div>
          ))}
        </Row>
      </Section>

      {/* ── Alerts ────────────────────────────────────────────────────────────── */}
      <Section title="Inline alerts">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 }}>
          <div className="agent-alert agent-alert-success">
            <CheckCircle weight="fill" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span><strong>Transaction created</strong> — The file has been set up and milestones are ready.</span>
          </div>
          <div className="agent-alert agent-alert-danger">
            <WarningCircle weight="fill" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span><strong>Action required</strong> — Exchange deadline is tomorrow and mortgage hasn't confirmed.</span>
          </div>
          <div className="agent-alert agent-alert-warning">
            <Warning weight="fill" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span><strong>Possible delay</strong> — Management pack hasn't been ordered yet.</span>
          </div>
          <div className="agent-alert agent-alert-info">
            <Info weight="fill" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span>Completion is provisionally set for 14 August.</span>
          </div>
        </div>
      </Section>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Section title="Tabs">
        <div className="agent-glass agent-tab-bar" style={{ display: "inline-flex" }}>
          {[
            { key: "all",       label: "All",       count: 24 },
            { key: "active",    label: "Active",    count: 18 },
            { key: "hold",      label: "On Hold",   count: 4  },
            { key: "completed", label: "Completed", count: 2  },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              className="agent-tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}>
              {label}
              <span className={`agent-badge${tab === key ? " agent-badge-coral" : ""}`}>{count}</span>
            </button>
          ))}
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: "var(--agent-text-muted)" }}>Active tab: {tab}</p>
      </Section>

      {/* ── Avatars ───────────────────────────────────────────────────────────── */}
      <Section title="Avatars">
        <Row label="Sizes">
          <div className="agent-avatar agent-avatar-xs">EA</div>
          <div className="agent-avatar agent-avatar-sm">EA</div>
          <div className="agent-avatar agent-avatar-md">EA</div>
          <div className="agent-avatar agent-avatar-lg">EA</div>
        </Row>
        <Row label="Group (stacked)">
          <div style={{ display: "flex" }}>
            {["EA", "JB", "MK"].map((i, idx) => (
              <div key={i} className="agent-avatar agent-avatar-sm"
                style={{ marginLeft: idx === 0 ? 0 : -8, border: "2px solid var(--agent-bg-base)", zIndex: 3 - idx }}>
                {i}
              </div>
            ))}
            <div className="agent-avatar agent-avatar-sm"
              style={{ marginLeft: -8, background: "var(--agent-glass-bg-subtle)", color: "var(--agent-text-secondary)", border: "2px solid var(--agent-bg-base)", fontSize: 10, zIndex: 0 }}>
              +4
            </div>
          </div>
        </Row>
      </Section>

      {/* ── Skeletons ─────────────────────────────────────────────────────────── */}
      <Section title="Skeletons (loading)">
        <div className="agent-glass-strong" style={{ borderRadius: 12, padding: 20, maxWidth: 440 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div className="agent-skeleton" style={{ width: 40, height: 40, borderRadius: "50%" }} />
            <div style={{ flex: 1 }}>
              <div className="agent-skeleton" style={{ height: 13, borderRadius: 4, marginBottom: 6, width: "60%" }} />
              <div className="agent-skeleton" style={{ height: 11, borderRadius: 4, width: "40%" }} />
            </div>
          </div>
          {[1, 0.7, 0.85].map((w, i) => (
            <div key={i} className="agent-skeleton" style={{ height: 12, borderRadius: 4, marginBottom: 8, width: `${w * 100}%` }} />
          ))}
        </div>
      </Section>

      {/* ── Spinners ──────────────────────────────────────────────────────────── */}
      <Section title="Spinners">
        <Row>
          <div className="agent-spinner agent-spinner-sm" />
          <div className="agent-spinner agent-spinner-md" />
          <div className="agent-spinner agent-spinner-lg" />
          <button className="agent-btn agent-btn-primary agent-btn-md" style={{ pointerEvents: "none" }}>
            <span className="agent-btn-spinner" /> Saving…
          </button>
        </Row>
      </Section>

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      <Section title="Empty state">
        <div className="agent-glass" style={{ maxWidth: 380, borderRadius: 16 }}>
          <div className="agent-empty">
            <FolderOpen className="agent-empty-icon" weight="light" />
            <p className="agent-empty-title">No files yet</p>
            <p className="agent-empty-desc">Create your first transaction to start tracking a sale from offer to keys.</p>
            <button className="agent-btn agent-btn-primary agent-btn-md" style={{ marginTop: 8 }}>
              <Plus style={{ width: 16, height: 16 }} weight="bold" />
              New Transaction
            </button>
          </div>
        </div>
      </Section>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      <Section title="Toast notifications">
        <Row>
          <button className="agent-btn agent-btn-secondary agent-btn-md" onClick={() => { setToastVisible(true); setTimeout(() => setToastVisible(false), 3800); }}>
            Show toast
          </button>
        </Row>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380, marginTop: 16 }}>
          {[
            { type: "success", icon: <CheckCircle weight="fill" style={{ width: 18, height: 18, color: "var(--agent-success)", flexShrink: 0 }} />, title: "Transaction created", desc: "14 Elmwood Avenue has been set up." },
            { type: "error",   icon: <WarningCircle weight="fill" style={{ width: 18, height: 18, color: "var(--agent-danger)", flexShrink: 0 }} />,  title: "Failed to save",       desc: "Check your connection and try again." },
            { type: "warning", icon: <Warning weight="fill" style={{ width: 18, height: 18, color: "var(--agent-warning)", flexShrink: 0 }} />, title: "Exchange in 2 days",  desc: "Mortgage confirmation still pending." },
            { type: "info",    icon: <Info weight="fill" style={{ width: 18, height: 18, color: "var(--agent-info)", flexShrink: 0 }} />,    title: "Portal invitation sent", desc: "Client will receive an email shortly." },
          ].map(({ type, icon, title, desc }) => (
            <div key={type} className={`agent-toast agent-toast-${type}`}>
              {icon}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>{title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>{desc}</p>
              </div>
              <button className="agent-btn agent-btn-ghost agent-btn-icon-sm" style={{ width: 24, height: 24, flexShrink: 0 }}>
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      <Section title="Modal">
        <Row>
          <button className="agent-btn agent-btn-primary agent-btn-md" onClick={() => setModalOpen(true)}>
            Open modal
          </button>
          <button className="agent-btn agent-btn-danger agent-btn-md" onClick={() => setModalOpen(true)}>
            Confirm delete
          </button>
        </Row>
      </Section>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <Section title="Table">
        <div className="agent-glass-strong" style={{ borderRadius: 12, overflow: "hidden" }}>
          <table className="agent-table">
            <thead>
              <tr>
                {["Property", "Status", "Price", "Assignee", "Exchange"].map(h => (
                  <th key={h} className="agent-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { address: "14 Elmwood Avenue, Bristol", status: "active",    price: "£485,000", assignee: "EA", date: "14 Aug" },
                { address: "7 The Maltings, Bath",       status: "hold",      price: "£320,000", assignee: "JB", date: "TBC"    },
                { address: "22 Park Road, Clifton",      status: "active",    price: "£620,000", assignee: "EA", date: "2 Sep"  },
                { address: "3 Harbour View, Bristol",    status: "completed", price: "£295,000", assignee: "MK", date: "Done"   },
              ].map((row, i) => (
                <tr key={i} className={`agent-tr${i === 0 ? " agent-tr-selected" : ""}`}>
                  <td className="agent-td">
                    <p style={{ margin: 0 }}>{row.address}</p>
                  </td>
                  <td className="agent-td">
                    <span className={`agent-pill agent-pill-${row.status === "hold" ? "hold" : row.status === "completed" ? "completed" : "active"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="agent-td">{row.price}</td>
                  <td className="agent-td">
                    <div className="agent-avatar agent-avatar-sm">{row.assignee}</div>
                  </td>
                  <td className="agent-td agent-td-sm">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Nav items ─────────────────────────────────────────────────────────── */}
      <Section title="Nav items (sidebar)">
        <div className="agent-glass" style={{ width: 200, borderRadius: 12, padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { label: "My Files",     active: true  },
            { label: "Completions",  active: false },
            { label: "Analytics",    active: false },
            { label: "Settings",     active: false, disabled: true },
          ].map(({ label, active, disabled }) => (
            <button key={label}
              className={`agent-nav-item${active ? " agent-nav-item-active" : ""}`}
              disabled={disabled}
              style={disabled ? { color: "var(--agent-text-disabled)", cursor: "not-allowed" } : {}}>
              <FolderOpen style={{ width: 17, height: 17 }} weight={active ? "fill" : "regular"} />
              <span style={{ fontSize: 13 }}>{label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Smile sign-off ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 24, borderTop: "0.5px solid var(--agent-border-subtle)", marginTop: 8 }}>
        <SmileyWink style={{ width: 20, height: 20, color: "var(--agent-coral-deep)" }} weight="fill" />
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
          All components shown above. Every interactive element has rest, hover, focus, active, and disabled states.
        </p>
      </div>

      {/* ── Toast (live) ──────────────────────────────────────────────────────── */}
      {toastVisible && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: "var(--agent-z-toast)" as unknown as number }}>
          <div className="agent-toast agent-toast-success" style={{ animation: "agent-toast-in 200ms var(--agent-ease) both" }}>
            <CheckCircle weight="fill" style={{ width: 18, height: 18, color: "var(--agent-success)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)" }}>Toast is working</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>Auto-dismisses after 3.8 seconds</p>
            </div>
            <button className="agent-btn agent-btn-ghost agent-btn-icon-sm" onClick={() => setToastVisible(false)} style={{ width: 24, height: 24, flexShrink: 0 }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal (live) ──────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="agent-backdrop" onClick={() => setModalOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="agent-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "var(--agent-text-h3)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", lineHeight: "var(--agent-line-tight)" }}>
                  Confirm action
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: "var(--agent-line-base)" }}>
                  This will permanently delete the transaction and cannot be undone.
                </p>
              </div>
              <button className="agent-btn agent-btn-ghost agent-btn-icon-sm" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28, flexShrink: 0, marginTop: -2 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="agent-label agent-label-required">Reason for removal</label>
              <textarea className="agent-textarea" placeholder="Briefly explain why this is being removed…" rows={3} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="agent-btn agent-btn-ghost agent-btn-md" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="agent-btn agent-btn-danger agent-btn-md" onClick={() => setModalOpen(false)}>
                <Trash style={{ width: 15, height: 15 }} />
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
