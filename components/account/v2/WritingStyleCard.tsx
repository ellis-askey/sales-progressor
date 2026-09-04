"use client";

// components/account/v2/WritingStyleCard.tsx
//
// "Your writing style" card for the Account/Profile page. Makes the chase voice
// learning visible and controllable: it explains (in plain English, with the
// privacy note) that we learn how this person edits AI-drafted chases, shows the
// style we've learned so far, and lets them reset it. Per-user; the profile is
// this user's own (lib/chase/voice-profile.ts).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenNib } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { resetVoiceProfileAction } from "@/app/actions/chase-voice";

const secondaryBtn: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12.5, fontWeight: 500, color: "#374151", background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, cursor: "pointer",
};
const primaryBtn: React.CSSProperties = { padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export function WritingStyleCard({ profile, builtAt }: { profile: string | null; builtAt: string | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    await resetVoiceProfileAction().catch(() => null);
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  const updated = builtAt ? formatDate(builtAt) : "";

  return (
    <AccountCard
      icon={<PenNib size={18} weight="bold" />}
      title="Your writing style"
      subtitle="How we tailor AI-drafted chases to sound more like you."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 620 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#374151" }}>
          When you edit an AI-drafted chase before sending it, we quietly learn from the way you phrase
          things. After a few edits, future drafts will start to reflect your writing style, giving you
          less to change before hitting send.
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#374151" }}>
          If you send a draft without making any changes, we don&apos;t learn anything from it.
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, lineHeight: 1.6, color: "#6b7280" }}>
          We only learn how you write. Client names, property addresses and firm names are removed before
          your edits are analysed, and none of those details are stored here.
        </p>

        {profile ? (
          <div
            style={{
              background: "rgba(226,69,42,0.05)",
              border: "0.5px solid rgba(226,69,42,0.18)",
              borderRadius: 12,
              padding: "13px 15px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-coral-deep, #E2452A)", marginBottom: 8 }}>
              What we&apos;ve learned so far{updated ? ` · updated ${updated}` : ""}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.65, color: "#1f2937", whiteSpace: "pre-wrap" }}>
              {profile}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "rgba(0,0,0,0.02)",
              border: "0.5px dashed rgba(0,0,0,0.14)",
              borderRadius: 12,
              padding: "13px 15px",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#6b7280",
            }}
          >
            <span style={{ display: "block", fontWeight: 600, color: "#4b5563", marginBottom: 3 }}>
              We haven&apos;t learned your style yet.
            </span>
            Make a few edits to AI-drafted chases before sending them and, as we start to pick up your
            style, you&apos;ll see it appear here.
          </div>
        )}

        {profile && (
          !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="account-btn-secondary account-press"
              style={{ ...secondaryBtn, alignSelf: "flex-start" }}
            >
              Reset my style
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#111827" }}>Start fresh? We&apos;ll relearn from your next edits.</span>
              <button type="button" onClick={reset} disabled={busy} className="account-btn-primary" style={primaryBtn}>
                {busy ? "Resetting…" : "Yes, reset"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="account-btn-secondary account-press" style={secondaryBtn}>
                Cancel
              </button>
            </div>
          )
        )}
      </div>
    </AccountCard>
  );
}
