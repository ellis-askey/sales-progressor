// /dev/icon-migration-qa — verification harness for the Solar migration. Renders
// the REAL production shims (@/components/icons/ph + lu) — the exact components the
// dashboards now use — both inside and outside the dashboard <IconModeProvider>,
// at the real sizes/colours, plus the kept exceptions. Dev-only. This tests the
// actual migration render path (not a mock). Full assembled-screen QA still needs
// an authenticated login.
"use client";

import * as React from "react";
import { IconModeProvider } from "@/components/icons/shim-core";
import {
  House, EnvelopeSimple, CalendarBlank, Bell, Trash, MagnifyingGlass, UsersThree, ListChecks,
  LinkSimple, Gear, Plus, PencilSimple, CheckCircle, Warning, Clock, Phone, ArrowRight, CaretDown,
  // newly-mapped (previously dynamic/unmapped):
  Scales, ShoppingBag, SignIn, Compass, ChartLineUp, CheckSquare, EnvelopeOpen, Files, MinusCircle,
  // kept exceptions / no Solar:
  X, CircleNotch, WhatsappLogo, CurrencyGbp, Circle, HandTap, Gavel, Robot, Voicemail, CircleDashed,
} from "@/components/icons/ph";
import { HelpCircle, ChevronRight, Contrast, FlaskConical, Sun, Moon, MessageCircle, Mail } from "@/components/icons/lu";

const SET: [string, React.ComponentType<any>][] = [
  ["House", House], ["EnvelopeSimple", EnvelopeSimple], ["CalendarBlank", CalendarBlank], ["Bell", Bell],
  ["Trash", Trash], ["MagnifyingGlass", MagnifyingGlass], ["UsersThree", UsersThree], ["ListChecks", ListChecks],
  ["LinkSimple", LinkSimple], ["Gear", Gear], ["Plus", Plus], ["PencilSimple", PencilSimple],
  ["CheckCircle", CheckCircle], ["Warning", Warning], ["Clock", Clock], ["Phone", Phone],
  ["ArrowRight", ArrowRight], ["CaretDown", CaretDown], ["HelpCircle", HelpCircle], ["ChevronRight", ChevronRight],
];
const MAPPED2: [string, React.ComponentType<any>][] = [
  ["Scales", Scales], ["ShoppingBag", ShoppingBag], ["SignIn", SignIn], ["Compass", Compass], ["ChartLineUp", ChartLineUp],
  ["CheckSquare", CheckSquare], ["EnvelopeOpen", EnvelopeOpen], ["Files", Files], ["MinusCircle", MinusCircle],
  ["Sun", Sun], ["Moon", Moon], ["MessageCircle", MessageCircle], ["Mail", Mail],
];
const KEPT: [string, React.ComponentType<any>][] = [
  ["X", X], ["CircleNotch", CircleNotch], ["WhatsappLogo", WhatsappLogo], ["CurrencyGbp", CurrencyGbp],
  ["Circle", Circle], ["HandTap", HandTap], ["Contrast", Contrast], ["FlaskConical", FlaskConical],
  ["Gavel", Gavel], ["Robot", Robot], ["Voicemail", Voicemail], ["CircleDashed", CircleDashed],
];
const SIZES = [14, 16, 18, 20, 24, 32];

function Row({ items }: { items: [string, React.ComponentType<any>][] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-end" }}>
      {items.map(([name, C]) => (
        <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <C size={26} />
          <span style={{ fontSize: 10, color: "#64748b" }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 40, maxWidth: 1100, margin: "0 auto", color: "#0f172a" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Icon migration — render verification</h1>
      <p style={{ color: "#475569", fontSize: 14 }}>The real production shims. Left column = outside provider (must stay CURRENT). Right = inside the dashboard provider (SOLAR). Kept exceptions must look identical in both.</p>

      <h2 style={{ fontSize: 15, marginTop: 28 }}>Current (no provider) — should be today&rsquo;s icons</h2>
      <div style={{ border: "1px solid #e7eaf0", borderRadius: 12, padding: 18 }}><Row items={SET} /></div>

      <h2 style={{ fontSize: 15, marginTop: 28 }}>Solar (inside dashboard provider)</h2>
      <IconModeProvider mode="solar">
        <div style={{ border: "1px solid #e7eaf0", borderRadius: 12, padding: 18 }}><Row items={SET} /></div>

        <h2 style={{ fontSize: 15, marginTop: 28 }}>Newly-mapped (dynamic/unmapped → Solar)</h2>
        <div style={{ border: "1px solid #e7eaf0", borderRadius: 12, padding: 18 }}><Row items={MAPPED2} /></div>

        <h2 style={{ fontSize: 15, marginTop: 28 }}>Kept exceptions / no Solar (inside provider — must stay original)</h2>
        <div style={{ border: "1px solid #e7eaf0", borderRadius: 12, padding: 18 }}><Row items={KEPT} /></div>

        <h2 style={{ fontSize: 15, marginTop: 28 }}>Size preservation (House, 14–32px)</h2>
        <div style={{ border: "1px solid #e7eaf0", borderRadius: 12, padding: 18, display: "flex", gap: 20, alignItems: "flex-end" }}>
          {SIZES.map((s) => <div key={s} style={{ textAlign: "center" }}><House size={s} /><div style={{ fontSize: 10, color: "#64748b" }}>{s}px</div></div>)}
        </div>

        <h2 style={{ fontSize: 15, marginTop: 28 }}>Colour inheritance + explicit colour</h2>
        <div style={{ border: "1px solid #e7eaf0", borderRadius: 12, padding: 18, display: "flex", gap: 24, alignItems: "center" }}>
          <span style={{ color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 6 }}><Bell size={20} /> inherits grey</span>
          <span style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle size={20} /> inherits green</span>
          <span style={{ color: "#d97706", display: "inline-flex", alignItems: "center", gap: 6 }}><Warning size={20} /> inherits amber</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash size={20} color="#ef4444" /> explicit red</span>
          <span className="text-blue-600" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Gear size={20} /> via className</span>
        </div>

        <h2 style={{ fontSize: 15, marginTop: 28 }}>In-context mini (nav / button / status)</h2>
        <div style={{ border: "1px solid #e7eaf0", borderRadius: 12, padding: 18, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 13, color: "#0f172a", fontWeight: 600 }}><House size={19} /> Properties</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#ff6b4a", color: "#fff", padding: "8px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}><Plus size={15} color="#fff" /> New sale</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f1f5f9", padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "#16a34a" }}><CheckCircle size={14} /> Exchanged</span>
        </div>
      </IconModeProvider>
    </div>
  );
}
