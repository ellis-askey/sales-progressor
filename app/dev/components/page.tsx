"use client";

// Component preview page for two ported controls:
//  · Button    — uiarc.dev registry (MIT), components/arc/button
//  · LabelInput — Bencho (MIT), components/ui/LabelInput
// Live demos only; /dev convention: throwaway, delete when decided.

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { LabelInput } from "@/components/ui/LabelInput";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";

export default function ComponentsPreview() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [role, setRole] = useState("director");

  function save() {
    if (saving) return;
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); }, 1100);
  }

  return (
    <div
      data-theme="sunset"
      style={{
        minHeight: "100vh",
        background: "var(--agent-bg, #faf7f4)",
        color: "var(--agent-text-primary, #211d18)",
        fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
        padding: "48px 24px 140px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 820, display: "flex", flexDirection: "column", gap: 52 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Components</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--agent-text-secondary, #6b6258)", lineHeight: 1.6, maxWidth: 620 }}>
            Two ported controls, both on the agent token system so they track every theme. Button is from the
            uiarc.dev registry; LabelInput is from Bencho.
          </p>
        </header>

        {/* ── Button ───────────────────────────────────────── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead title="Button" note="components/arc/button · press spring, label width-morph, spinner on loading" />

          <Panel>
            <Label>Variants</Label>
            <Cluster>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </Cluster>
          </Panel>

          <Panel>
            <Label>Sizes</Label>
            <Cluster>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </Cluster>
          </Panel>

          <Panel>
            <Label>Loading — spinner, stays focusable, swallows clicks</Label>
            <Cluster>
              <Button variant="primary" loading={loadingDemo} onClick={() => setLoadingDemo(true)}>
                {loadingDemo ? "Working" : "Start"}
              </Button>
              <Button variant="secondary" onClick={() => setLoadingDemo(false)}>Reset</Button>
            </Cluster>
          </Panel>

          <Panel>
            <Label>Label morph — the width springs as the label changes</Label>
            <Cluster>
              <Button variant="primary" loading={saving} onClick={save}>
                {saved ? "Saved" : "Save draft"}
              </Button>
              <Button variant="ghost" onClick={() => setSaved(false)}>Edit again</Button>
            </Cluster>
          </Panel>

          <Panel>
            <Label>Disabled — outlined variants keep their shape</Label>
            <Cluster>
              <Button variant="primary" disabled>Primary</Button>
              <Button variant="secondary" disabled>Secondary</Button>
              <Button variant="ghost" disabled>Ghost</Button>
              <Button variant="danger" disabled>Danger</Button>
            </Cluster>
          </Panel>
        </section>

        {/* ── RadioGroup ───────────────────────────────────── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead title="Radio group" note="components/arc/radio-group · one highlight glides to the chosen row, the dot springs in; the register's coral gradient as the fill" />
          <Panel>
            <div style={{ maxWidth: 360, width: "100%" }}>
              <RadioGroup
                label="What's your role?"
                name="demo-role"
                value={role}
                onValueChange={setRole}
                options={[
                  { value: "director", label: "Director", description: "Manage your agency, view all sales and oversee your team." },
                  { value: "negotiator", label: "Negotiator", description: "View your sales and request support from your sales progressor." },
                  { value: "progressor", label: "Sales progressor", description: "Run progression for the sales you're assigned." },
                ]}
              />
            </div>
          </Panel>
        </section>

        {/* ── LabelInput ───────────────────────────────────── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead title="Label input" note="components/ui/LabelInput · the label is the placeholder until you focus, then lifts into the outline" />
          <Panel>
            <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
              <LabelInput field="Email" />
              <LabelInput field="Password" />
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted, #8a8178)" }}>{note}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 24,
        borderRadius: 18,
        background: "var(--agent-surface-elevated, #fff)",
        border: "1px solid var(--agent-border-default, rgba(33,29,24,0.08))",
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--agent-text-muted, #8a8178)" }}>
      {children}
    </span>
  );
}

function Cluster({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>{children}</div>;
}
